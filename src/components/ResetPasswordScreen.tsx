import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { validatePasswordStrength, PASSWORD_REQUIREMENTS_HINT } from '../lib/passwordValidation';
import {
  clearPasswordRecoveryPending,
  clearPasswordRecoveryUrl,
  getAuthCallbackError,
  initAuthFromUrl,
  isPasswordRecoveryPending,
} from '../lib/passwordRecovery';
import { formatAuthFailure } from '../lib/signupEmailVerify';
import { supabase } from '../lib/supabase';
import { useLocale } from '../context/LocaleContext';

interface ResetPasswordScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function ResetPasswordScreen({ onBack, onSuccess }: ResetPasswordScreenProps) {
  const { authT } = useLocale();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    let cancelled = false;

    const ensureRecoverySession = async () => {
      const callbackError = getAuthCallbackError();
      if (callbackError) {
        if (!cancelled) {
          setError(formatAuthFailure(callbackError, '重設連結無效或已過期，請重新申請忘記密碼。'));
          setCheckingSession(false);
        }
        return;
      }

      try {
        await initAuthFromUrl();
      } catch (err) {
        if (!cancelled) {
          setError(formatAuthFailure(err, '重設連結無效或已過期，請重新申請忘記密碼。'));
          setCheckingSession(false);
        }
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session || isPasswordRecoveryPending()) {
        setSessionReady(Boolean(session));
        if (!session) {
          setError('重設連結無效或已過期，請重新申請忘記密碼。');
        }
      } else {
        setError('重設連結無效或已過期，請重新申請忘記密碼。');
      }
      setCheckingSession(false);
    };

    void ensureRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || (session && isPasswordRecoveryPending())) {
        setSessionReady(true);
        setError('');
        setCheckingSession(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setInfo('');
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('重設連結無效或已過期，請重新申請忘記密碼。');
      }

      const passwordError = validatePasswordStrength(password);
      if (passwordError) {
        throw new Error(passwordError);
      }

      if (password !== confirmPassword) {
        throw new Error('兩次輸入的密碼不一致。');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      clearPasswordRecoveryPending();
      clearPasswordRecoveryUrl();
      setInfo('密碼已成功更新。');
      setTimeout(() => {
        onSuccess();
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重設密碼失敗，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    clearPasswordRecoveryPending();
    clearPasswordRecoveryUrl();
    onBack();
  };

  return (
    <div className="mx-auto min-h-screen w-full min-w-0 max-w-xl overflow-x-hidden bg-white">
      <div className="border-b p-4">
        <button type="button" onClick={handleBack} className="flex items-center gap-2 text-gray-600 hover:text-black">
          <ArrowLeft className="w-5 h-5" />
          <span>{authT.backToSignIn}</span>
        </button>
      </div>

      <div className="min-w-0 px-4 py-10 sm:px-6 sm:py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl mb-2">{authT.resetPasswordTitle}</h1>
          <p className="text-gray-600">請輸入並確認你的新密碼。</p>
        </div>

        {checkingSession ? (
          <p className="text-center text-sm text-gray-500">正在驗證重設連結…</p>
        ) : !sessionReady ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-red-500">{error || '重設連結無效或已過期，請重新申請忘記密碼。'}</p>
            <Button type="button" variant="outline" onClick={handleBack}>
              {authT.backToSignIn}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block mb-2 text-sm text-gray-700">新密碼</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12"
                autoComplete="new-password"
              />
              <p className="mt-1.5 text-xs text-gray-500">{PASSWORD_REQUIREMENTS_HINT}</p>
            </div>

            <div>
              <label className="block mb-2 text-sm text-gray-700">{authT.confirmPassword}</label>
              <Input
                type="password"
                placeholder={authT.confirmPasswordPlaceholder}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-12"
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full h-12 bg-black text-white hover:bg-gray-800" disabled={loading}>
              {loading ? '更新中...' : '更新密碼'}
            </Button>
          </form>
        )}

        {sessionReady && error ? <p className="mt-4 text-sm text-red-500 text-center">{error}</p> : null}
        {info ? <p className="mt-4 text-sm text-green-600 text-center">{info}</p> : null}
      </div>
    </div>
  );
}
