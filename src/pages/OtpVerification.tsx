import React, { useState, useRef, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const OtpVerification: React.FC = () => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  const handleVerify = () => {
    const code = otp.join('');
    if (code.length !== 6) {
      toast.error('Please enter the complete 6-digit code');
      return;
    }
    toast.success('Verification successful!');
    navigate('/lobby');
  };

  const handleResend = () => {
    toast.info('OTP resent to your email');
  };

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
        <p className="text-muted-foreground mb-6">
          We've sent a <strong className="text-foreground">6-digit code</strong> to your email.
          <br />Enter it below to unlock access.
        </p>

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
              className="w-12 h-14 md:w-14 md:h-16 text-center text-2xl font-bold bg-black/30 border-2 border-border rounded-lg focus:border-primary focus:outline-none transition-colors"
            />
          ))}
        </div>

        <Button
          onClick={handleVerify}
          className="w-full gradient-primary text-primary-foreground font-bold py-3 mb-4"
        >
          VERIFY & DEPLOY
        </Button>

        <div className="flex justify-center gap-2 text-sm text-muted-foreground">
          <span>Didn't receive it?</span>
          <button
            onClick={handleResend}
            className="text-primary hover:underline font-medium"
          >
            Resend OTP
          </button>
        </div>
      </section>
    </div>
  );
};

export default OtpVerification;
