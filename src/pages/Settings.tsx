import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { ArrowLeft } from 'lucide-react';
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
    <div className="min-h-screen">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 h-[70px] bg-surface/95 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-6 z-50">
        <Button variant="outline" size="sm" onClick={() => navigate('/lobby')}>
          <ArrowLeft className="mr-2" size={16} />
          Back to Lobby
        </Button>
        <h1 className="font-orbitron text-xl font-bold text-primary">SETTINGS</h1>
        <div className="w-32" />
      </header>

      <main className="pt-[90px] pb-10 px-4 max-w-3xl mx-auto">
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

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <Button onClick={handleSave} className="gradient-primary px-8">
            Save Settings
          </Button>
          <Button onClick={handleReset} variant="destructive" className="px-8">
            Reset to Default
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Settings;
