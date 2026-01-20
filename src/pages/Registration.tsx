import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const Registration: React.FC = () => {
  const navigate = useNavigate();
  const { signUp, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/lobby');
    }
  }, [user, authLoading, navigate]);

  const validateForm = (): boolean => {
    if (!email.trim()) {
      toast.error('Please enter your email');
      return false;
    }

    if (!domain) {
      toast.error('Please select your domain');
      return false;
    }

    if (!username.trim()) {
      toast.error('Please enter a username');
      return false;
    }

    if (username.length < 3) {
      toast.error('Username must be at least 3 characters');
      return false;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      toast.error('Username can only contain letters, numbers, and underscores');
      return false;
    }

    if (!password) {
      toast.error('Please enter a password');
      return false;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return false;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const fullEmail = `${email}${domain}`;
    setIsLoading(true);

    try {
      const { error } = await signUp(fullEmail, password, username);
      
      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          toast.error('An account with this email already exists. Please login instead.');
        } else if (error.message.includes('invalid email')) {
          toast.error('Please enter a valid email address.');
        } else if (error.message.includes('weak password')) {
          toast.error('Password is too weak. Please use a stronger password.');
        } else {
          toast.error(error.message || 'Registration failed. Please try again.');
        }
        return;
      }

      toast.success('Registration successful! Please check your email for verification.');
      navigate('/otp', { state: { email: fullEmail, fromRegistration: true } });
    } catch (err) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      {/* Header */}
      <header className="text-center mb-8">
        <h1 className="font-orbitron text-4xl md:text-5xl font-bold text-primary mb-3 drop-shadow-lg">
          StudyGround:CodeZone
        </h1>
        <p className="text-muted-foreground text-lg">Register to enter the battlefield</p>
      </header>

      {/* Registration Form */}
      <section className="glass-panel p-8 w-full max-w-md">
        <h2 className="font-orbitron text-2xl font-bold text-center mb-6">Registration</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email + Domain */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-2 text-muted-foreground">Email</label>
              <Input
                type="text"
                placeholder="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="bg-black/30 border-border"
              />
            </div>
            <div>
              <label className="block text-sm mb-2 text-muted-foreground">Domain</label>
              <Select value={domain} onValueChange={setDomain} disabled={isLoading}>
                <SelectTrigger className="bg-black/30 border-border">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent className="bg-surface border-border">
                  <SelectItem value="@karunya.edu">@karunya.edu</SelectItem>
                  <SelectItem value="@karunya.edu.in">@karunya.edu.in</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm mb-2 text-muted-foreground">Username</label>
            <Input
              type="text"
              placeholder="Choose a unique username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              className="bg-black/30 border-border"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm mb-2 text-muted-foreground">Password</label>
            <Input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="bg-black/30 border-border"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm mb-2 text-muted-foreground">Confirm Password</label>
            <Input
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              className="bg-black/30 border-border"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full gradient-primary text-primary-foreground font-bold py-3"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                REGISTERING...
              </>
            ) : (
              'REGISTER'
            )}
          </Button>

          <div className="flex justify-center gap-2 text-sm text-muted-foreground">
            <span>Already have an account?</span>
            <Link to="/login" className="text-primary hover:underline">Login</Link>
          </div>
        </form>
      </section>
    </div>
  );
};

export default Registration;
