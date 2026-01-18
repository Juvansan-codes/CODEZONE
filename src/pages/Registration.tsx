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

const Registration: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [registerNumber, setRegisterNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    // Navigate to OTP verification
    navigate('/otp');
  };

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

          {/* Register Number */}
          <div>
            <label className="block text-sm mb-2 text-muted-foreground">Register Number</label>
            <Input
              type="text"
              placeholder="URK-YY-DPT-NNNN"
              value={registerNumber}
              onChange={(e) => setRegisterNumber(e.target.value)}
              required
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
              required
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
              required
              className="bg-black/30 border-border"
            />
          </div>

          <Button type="submit" className="w-full gradient-primary text-primary-foreground font-bold py-3">
            REGISTER
          </Button>

          <div className="flex justify-center gap-2 text-sm text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">Forgot password?</a>
            <span>•</span>
            <span>Already have an account?</span>
            <Link to="/login" className="text-primary hover:underline">Login</Link>
          </div>
        </form>
      </section>
    </div>
  );
};

export default Registration;
