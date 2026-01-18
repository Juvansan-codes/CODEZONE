import React, { useState } from 'react';
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

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For now, just navigate to lobby
    navigate('/lobby');
  };

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
                required
                className="bg-black/30 border-border"
              />
            </div>
            <div>
              <label className="block text-sm mb-2 text-muted-foreground">Domain</label>
              <Select value={domain} onValueChange={setDomain} required>
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
              required
              className="bg-black/30 border-border"
            />
          </div>

          <Button type="submit" className="w-full gradient-primary text-primary-foreground font-bold py-3">
            LOGIN
          </Button>

          <div className="flex justify-center gap-2 text-sm text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">Forgot password?</a>
            <span>•</span>
            <Link to="/register" className="hover:text-primary transition-colors">Create new account</Link>
          </div>
        </form>
      </section>
    </div>
  );
};

export default Login;
