import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/lobby';

  const { signIn, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate(from, { replace: true });
    }
  }, [user, authLoading, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }

    if (!domain) {
      toast.error('Please select your domain');
      return;
    }

    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    const fullEmail = `${email}${domain}`;
    setIsLoading(true);

    try {
      const { error } = await signIn(fullEmail, password);

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password. Please try again.');
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Please verify your email before logging in.');
          navigate('/otp', { state: { email: fullEmail } });
        } else {
          toast.error(error.message || 'Login failed. Please try again.');
        }
        return;
      }

      toast.success('Welcome back, soldier!');
      navigate(from, { replace: true });
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Header */}
      <header className="text-center mb-8">
        <h1 className="font-orbitron text-4xl md:text-5xl font-bold text-primary mb-3 drop-shadow-lg">
          StudyGround:CodeZone
        </h1>
        <p className="text-muted-foreground text-lg">Sign in to enter the battlefield</p>
      </header>

      {/* Login Form */}
      <section className="glass-panel p-8 w-full max-w-md">
        <h2 className="font-orbitron text-2xl font-bold text-center mb-6">Login</h2>

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

          <Button
            type="submit"
            className="w-full gradient-primary text-primary-foreground font-bold py-3"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                LOGGING IN...
              </>
            ) : (
              'LOGIN'
            )}
          </Button>

          <div className="flex justify-center gap-2 text-sm text-muted-foreground">
            <Link to="/forgot-password" className="hover:text-primary transition-colors">Forgot password?</Link>
            <span>•</span>
            <Link to="/register" className="hover:text-primary transition-colors">Create new account</Link>
          </div>
        </form>
      </section>
    </div>
  );
};

export default Login;
