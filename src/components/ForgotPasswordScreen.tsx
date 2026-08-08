import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { requestPasswordResetEmail } from '../lib/passwordRecovery';
import { formatAuthFailure, SIGNUP_RESEND_COOLDOWN_SEC } from '../lib/signupEmailVerify';
import { useLocale } from '../context/LocaleContext';
import thouseLogo from 'figma:asset/f0c80b0c66e9c54aea3881bdf7a4eb152cbc4c0b.png';

interface ForgotPasswordScreenProps {
  onBack: () => void;
}

export function ForgotPasswordScreen({ onBack }: ForgotPasswordScreenProps) {
  const { authT } = useLocale();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || cooldown > 0) return;
    try {
      setError('');
      if (!identifier.trim()) {
        throw new Error('請輸入你的電子郵件或用戶名稱。');
      }
      setLoading(true);
      await requestPasswordResetEmail(identifier);
      setSent(true);
      setCooldown(SIGNUP_RESEND_COOLDOWN_SEC);
    } catch (err) {
      setError(formatAuthFailure(err, '無法寄出重設密碼 email。'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full min-w-0 max-w-xl overflow-x-hidden bg-white">
      <div className="border-b p-4">
        <button type="button" onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-black">
          <ArrowLeft className="w-5 h-5" />
          <span>{authT.backToSignIn}</span>
        </button>
      </div>

      <div className="min-w-0 px-4 py-10 sm:px-6 sm:py-12">
        <div className="text-center mb-8">
          <img src={thouseLogo} alt={authT.brandAlt} className="w-20 h-20 mx-auto mb-4" />
          <h1 className="text-2xl mb-2">{authT.resetPasswordTitle}</h1>
          <p className="text-gray-600 text-sm">{authT.forgotPasswordDetail}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-gray-700">{authT.emailOrUsername}</label>
            <Input
              type="text"
              autoComplete="username"
              placeholder={authT.emailOrUsernamePlaceholder}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="h-12"
            />
          </div>
          <Button
            type="submit"
            className="w-full h-12 bg-black text-white hover:bg-gray-800"
            disabled={loading || cooldown > 0}
          >
            {cooldown > 0
              ? authT.format('resendCooldown', { seconds: cooldown })
              : authT.sendResetPasswordLink}
          </Button>
        </form>

        {sent ? <p className="mt-4 text-sm text-green-600 text-center">{authT.resetPasswordLinkSent}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-500 text-center">{error}</p> : null}
      </div>
    </div>
  );
}
