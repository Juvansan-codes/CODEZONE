import React, { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const OtpVerification: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const email = location.state?.email || '';
  const fromRegistration = location.state?.fromRegistration || false;

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/lobby');
    }
  }, [user, authLoading, navigate]);

  // Redirect if no email in state
  useEffect(() => {
    if (!email && !authLoading) {
      toast.error('No email provided. Please register first.');
      navigate('/register');
    }
  }, [email, navigate, authLoading]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length; i++) {
        newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);
      const focusIndex = Math.min(pastedData.length, 5);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      toast.error('Please enter the complete 6-digit code');
      return;
    }

    setIsVerifying(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup',
      });

      if (error) {
        if (error.message.includes('expired')) {
          toast.error('OTP has expired. Please request a new one.');
        } else if (error.message.includes('invalid')) {
          toast.error('Invalid OTP. Please check and try again.');
        } else {
          toast.error(error.message || 'Verification failed. Please try again.');
        }
        return;
      }

      toast.success('Email verified successfully! Welcome to the battlefield!');
      navigate('/lobby');
    } catch (err) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast.error('No email provided. Please register again.');
      navigate('/register');
      return;
    }

    setIsResending(true);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) {
        toast.error(error.message || 'Failed to resend OTP. Please try again.');
        return;
      }

      toast.success('A new OTP has been sent to your email');
      setOtp(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsResending(false);
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
        <p className="text-muted-foreground text-lg">Final Security Gate — Enter OTP to Proceed</p>
      </header>

      {/* OTP Card */}
      <section className="glass-panel p-8 w-full max-w-md text-center">
        <h2 className="font-orbitron text-2xl font-bold mb-4">Email Verification</h2>
        <p className="text-muted-foreground mb-2">
          We've sent a <strong className="text-foreground">6-digit code</strong> to:
        </p>
        <p className="text-primary font-medium mb-6 break-all">{email}</p>

        {/* OTP Inputs */}
        <div className="flex justify-center gap-2 md:gap-3 mb-6">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={isVerifying}
              className="w-12 h-14 md:w-14 md:h-16 text-center text-2xl font-bold bg-black/30 border-2 border-border rounded-lg focus:border-primary focus:outline-none transition-colors disabled:opacity-50"
            />
          ))}
        </div>

        <Button
          onClick={handleVerify}
          className="w-full gradient-primary text-primary-foreground font-bold py-3 mb-4"
          disabled={isVerifying || otp.some(d => !d)}
        >
          {isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              VERIFYING...
            </>
          ) : (
            'VERIFY & DEPLOY'
          )}
        </Button>

        <div className="flex justify-center gap-2 text-sm text-muted-foreground">
          <span>Didn't receive it?</span>
          <button
            onClick={handleResend}
            disabled={isResending}
            className="text-primary hover:underline font-medium disabled:opacity-50"
          >
            {isResending ? 'Sending...' : 'Resend OTP'}
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <button
            onClick={() => navigate('/register')}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            ← Back to Registration
          </button>
        </div>
      </section>
    </div>
  );
};

export default OtpVerification;
