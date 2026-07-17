import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SettingItemProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

const SettingItem: React.FC<SettingItemProps> = ({ label, description, children }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b border-border/50 last:border-0">
    <div className="flex-1">
      <p className="font-semibold">{label}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { gameData, settings, updateSettings } = useGame();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out');
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = confirm(
      "WARNING: Are you sure you want to permanently delete your account?\n\nThis will completely delete your progress, coins, gems, and profile. This action is irreversible."
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw error;

      toast.success("Account permanently deleted. We're sorry to see you go!");
      await signOut();
      navigate('/');
    } catch (err: any) {
      console.error("Account deletion failed:", err);
      toast.error("Failed to delete account. Please try again later.");
    }
  };

  const handleSave = () => {
    toast.success('Settings saved!');
  };

  const handleReset = () => {
    updateSettings({
      bgmEnabled: true,
      sfxEnabled: true,
      musicVolume: 35,
      sfxVolume: 50,
      autosave: true,
      notifications: true,
      hints: true,
      difficulty: 'medium',
      theme: 'dark',
      fpsCounter: false,
      animations: true,
      language: 'en',
      privacy: false,
    });
    toast.info('Settings reset to default');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-orbitron text-2xl md:text-3xl font-bold text-primary">SETTINGS</h1>
      </div>
        {/* Profile Section */}
        <section className="glass-panel p-6 mb-6">
          <h2 className="font-orbitron text-lg font-bold text-primary mb-5 pb-4 border-b border-border">Profile</h2>
          
          <div className="flex flex-col md:flex-row items-center gap-5 p-5 bg-black/30 rounded-lg mb-5">
            <div className="w-20 h-20 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-3xl">
              {gameData.username.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 text-center md:text-left">
              <p className="font-bold text-xl">{gameData.username}</p>
              <p className="text-sm text-muted-foreground">
                Level {gameData.level} • {gameData.coins.toLocaleString()} Coins • {gameData.gems.toLocaleString()} Gems
              </p>
            </div>
            <Button variant="outline">Edit Profile</Button>
          </div>
        </section>

        {/* Audio Section */}
        <section className="glass-panel p-6 mb-6">
          <h2 className="font-orbitron text-lg font-bold text-primary mb-5 pb-4 border-b border-border">Audio</h2>
          
          <SettingItem label="Background Music" description="Enable or disable background music">
            <Switch
              checked={settings.bgmEnabled}
              onCheckedChange={(checked) => updateSettings({ bgmEnabled: checked })}
            />
          </SettingItem>

          <SettingItem label="Sound Effects" description="Enable or disable sound effects">
            <Switch
              checked={settings.sfxEnabled}
              onCheckedChange={(checked) => updateSettings({ sfxEnabled: checked })}
            />
          </SettingItem>

          <SettingItem label="Music Volume" description="Adjust background music volume">
            <div className="w-48">
              <Slider
                value={[settings.musicVolume]}
                max={100}
                step={1}
                onValueChange={(val) => updateSettings({ musicVolume: val[0] })}
              />
              <p className="text-center text-sm text-primary mt-2">{settings.musicVolume}%</p>
            </div>
          </SettingItem>

          <SettingItem label="SFX Volume" description="Adjust sound effects volume">
            <div className="w-48">
              <Slider
                value={[settings.sfxVolume]}
                max={100}
                step={1}
                onValueChange={(val) => updateSettings({ sfxVolume: val[0] })}
              />
              <p className="text-center text-sm text-primary mt-2">{settings.sfxVolume}%</p>
            </div>
          </SettingItem>
        </section>

        {/* Gameplay Section */}
        <section className="glass-panel p-6 mb-6">
          <h2 className="font-orbitron text-lg font-bold text-primary mb-5 pb-4 border-b border-border">Gameplay</h2>
          
          <SettingItem label="Auto-save" description="Automatically save progress">
            <Switch
              checked={settings.autosave}
              onCheckedChange={(checked) => updateSettings({ autosave: checked })}
            />
          </SettingItem>

          <SettingItem label="Notifications" description="Show in-game notifications">
            <Switch
              checked={settings.notifications}
              onCheckedChange={(checked) => updateSettings({ notifications: checked })}
            />
          </SettingItem>

          <SettingItem label="Tutorial Hints" description="Display helpful hints during gameplay">
            <Switch
              checked={settings.hints}
              onCheckedChange={(checked) => updateSettings({ hints: checked })}
            />
          </SettingItem>

          <SettingItem label="Difficulty" description="Adjust gameplay difficulty">
            <Select
              value={settings.difficulty}
              onValueChange={(val) => updateSettings({ difficulty: val as 'easy' | 'medium' | 'hard' | 'expert' })}
            >
              <SelectTrigger className="w-40 bg-black/30 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface border-border">
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
              </SelectContent>
            </Select>
          </SettingItem>
        </section>

        {/* Display Section */}
        <section className="glass-panel p-6 mb-6">
          <h2 className="font-orbitron text-lg font-bold text-primary mb-5 pb-4 border-b border-border">Display</h2>
          
          <SettingItem label="FPS Counter" description="Show frames per second">
            <Switch
              checked={settings.fpsCounter}
              onCheckedChange={(checked) => updateSettings({ fpsCounter: checked })}
            />
          </SettingItem>

          <SettingItem label="Animations" description="Enable UI animations">
            <Switch
              checked={settings.animations}
              onCheckedChange={(checked) => updateSettings({ animations: checked })}
            />
          </SettingItem>
        </section>

        {/* Account Section */}
        <section className="glass-panel p-6 mb-6">
          <h2 className="font-orbitron text-lg font-bold text-primary mb-5 pb-4 border-b border-border">Account</h2>
          
          <SettingItem label="Language" description="Select your preferred language">
            <Select
              value={settings.language}
              onValueChange={(val) => updateSettings({ language: val })}
            >
              <SelectTrigger className="w-40 bg-black/30 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface border-border">
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
              </SelectContent>
            </Select>
          </SettingItem>

          <SettingItem label="Privacy Mode" description="Hide online status from friends">
            <Switch
              checked={settings.privacy}
              onCheckedChange={(checked) => updateSettings({ privacy: checked })}
            />
          </SettingItem>
        </section>

        {/* Danger Zone */}
        <section className="glass-panel p-6 mb-6 border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
          <h2 className="font-orbitron text-lg font-bold text-red-400 mb-5 pb-4 border-b border-red-500/20">Danger Zone</h2>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-border/50">
            <div>
              <p className="font-semibold text-foreground">Sign Out</p>
              <p className="text-sm text-muted-foreground">Sign out of your active session</p>
            </div>
            <Button variant="outline" className="border-border hover:bg-white/5" onClick={handleLogout}>
              Log Out
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
            <div>
              <p className="font-semibold text-red-400">Permanently Delete Account</p>
              <p className="text-sm text-muted-foreground">Delete all profile details, stats, and history permanently. This is irreversible.</p>
            </div>
            <Button variant="destructive" onClick={handleDeleteAccount}>
              Delete Account
            </Button>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <Button onClick={handleSave} className="gradient-primary px-8">
            Save Settings
          </Button>
          <Button onClick={handleReset} variant="destructive" className="px-8">
            Reset to Default
          </Button>
        </div>
    </div>
  );
};

export default Settings;
