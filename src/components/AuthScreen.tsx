import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { UserRole } from '../App';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from './ui/input-otp';
import { supabase } from '../lib/supabase';
import { AUTH_ROLE_STORAGE_KEY, getRoleFromMetadata } from '../lib/auth';
import { findEmailByUsername } from '../lib/profiles';
import { validateSignupEmailWithDatabase } from '../lib/signupEmailValidation';
import { validatePasswordStrength, PASSWORD_REQUIREMENTS_HINT } from '../lib/passwordValidation';
import {
  formatAuthFailure,
  isSignupEmailRateLimited,
  resendSignupVerification,
  signUpWithEmail,
  SIGNUP_RESEND_COOLDOWN_SEC,
  verifySignupEmailOtp,
  withAuthTimeout,
} from '../lib/signupEmailVerify';
import { useLocale } from '../context/LocaleContext';
import thouseLogo from 'figma:asset/f0c80b0c66e9c54aea3881bdf7a4eb152cbc4c0b.png';

interface AuthScreenProps {
  role: UserRole;
  onBack: () => void;
  onAuthSuccess: (role: UserRole) => void;
}

export function AuthScreen({ role, onBack, onAuthSuccess }: AuthScreenProps) {
  const { authT, commonT } = useLocale();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [signupPhase, setSignupPhase] = useState<'form' | 'verify-otp'>('form');
  const [pendingSignupEmail, setPendingSignupEmail] = useState('');
  const [signupEmailSent, setSignupEmailSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authInfo, setAuthInfo] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const startResendCooldown = () => setResendCooldown(SIGNUP_RESEND_COOLDOWN_SEC);

  const resetSignupFlow = () => {
    setSignupPhase('form');
    setPendingSignupEmail('');
    setSignupEmailSent(false);
    setOtpCode('');
    setResendCooldown(0);
  };

  const handleVerifyOtp = async () => {
    const code = otpCode.trim();
    if (code.length !== 6) {
      setAuthError('請輸入 6 位數驗證碼。');
      return;
    }

    try {
      setAuthError('');
      setAuthInfo('');
      setEmailLoading(true);
      const { role: verifiedRole } = await verifySignupEmailOtp(pendingSignupEmail, code);
      onAuthSuccess(verifiedRole ?? role ?? 'tenant');
    } catch (error) {
      setAuthError(formatAuthFailure(error, '驗證失敗，請稍後再試。'));
    } finally {
      setEmailLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingSignupEmail || resendCooldown > 0) return;
    try {
      setAuthError('');
      setAuthInfo('');
      setEmailLoading(true);
      await resendSignupVerification(pendingSignupEmail);
      setSignupEmailSent(true);
      startResendCooldown();
      setAuthInfo(authT.otpResent);
    } catch (error) {
      const message = formatAuthFailure(error, '無法重發驗證碼，請稍後再試。');
      if (isSignupEmailRateLimited(message)) {
        startResendCooldown();
      }
      setAuthError(message);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAuthError('');
      setAuthInfo('');
      setEmailLoading(true);
      localStorage.setItem(AUTH_ROLE_STORAGE_KEY, role ?? 'tenant');

      if (mode === 'signup') {
        if (!fullName.trim()) {
          throw new Error('請輸入名稱。');
        }
        const passwordError = validatePasswordStrength(password);
        if (passwordError) {
          throw new Error(passwordError);
        }
        if (password !== confirmPassword) {
          throw new Error('兩次輸入的密碼不一致。');
        }

        if (!username.trim()) {
          throw new Error('請輸入登入帳號。');
        }

        const normalizedUsername = username.trim().toLowerCase();
        const existingEmail = await withAuthTimeout(
          findEmailByUsername(normalizedUsername).catch(() => null),
          '檢查帳號逾時，請稍後再試。',
        );
        if (existingEmail) {
          throw new Error('此帳號名稱已被使用，請改用另一個登入帳號。');
        }

        const signupEmail = email.trim().toLowerCase();
        if (!signupEmail) {
          throw new Error('請輸入電子郵件。');
        }

        const emailCheck = await withAuthTimeout(
          validateSignupEmailWithDatabase(signupEmail),
          '檢查電郵逾時，請稍後再試。',
        );
        if (!emailCheck.ok) {
          throw new Error(emailCheck.message);
        }

        const signupRole = role ?? 'tenant';
        await signUpWithEmail({
          email: signupEmail,
          password,
          fullName: fullName.trim(),
          username: normalizedUsername,
          role: signupRole,
        });

        setPendingSignupEmail(signupEmail);
        setSignupPhase('verify-otp');
        setOtpCode('');
        setSignupEmailSent(false);
        setAuthInfo(authT.accountCreatedSendOtp);
        return;
      }

      const loginIdentifier = email.trim();
      const resolvedEmail = loginIdentifier.includes('@')
        ? loginIdentifier
        : await withAuthTimeout(
            findEmailByUsername(loginIdentifier),
            '登入逾時，請稍後再試。',
          );

      if (!resolvedEmail) {
        throw new Error('找不到這個用戶名稱，請檢查後再試。');
      }

      const { data, error } = await withAuthTimeout(
        supabase.auth.signInWithPassword({
          email: resolvedEmail,
          password,
        }),
        '登入逾時，請稍後再試。',
      );

      if (error) throw error;

      const metadataRole = getRoleFromMetadata(data.user.user_metadata);
      onAuthSuccess(metadataRole ?? role);
    } catch (error) {
      setAuthError(formatAuthFailure(error, mode === 'signup' ? '註冊失敗，請稍後再試。' : '登入失敗，請稍後再試。'));
    } finally {
      setEmailLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    try {
      setAuthError('');
      setAuthInfo('');

      if (!forgotPasswordEmail.trim()) {
        throw new Error('請輸入你的電子郵件。');
      }

      setEmailLoading(true);

      const loginIdentifier = forgotPasswordEmail.trim();
      const resolvedEmail = loginIdentifier.includes('@')
        ? loginIdentifier.toLowerCase()
        : await withAuthTimeout(
            findEmailByUsername(loginIdentifier),
            '查詢電郵逾時，請稍後再試。',
          );

      if (!resolvedEmail) {
        throw new Error('找不到此電子郵件，請檢查後再試。');
      }

      const { error } = await withAuthTimeout(
        supabase.auth.resetPasswordForEmail(resolvedEmail, {
          redirectTo: window.location.origin,
        }),
        '寄送重設密碼信逾時，請稍後再試。',
      );

      if (error) throw error;

      setAuthInfo('重設密碼連結已寄出，請到你的電子郵件收件匣查看。');
      setShowForgotPassword(false);
      setForgotPasswordEmail('');
    } catch (error) {
      setAuthError(formatAuthFailure(error, '無法寄出重設密碼 email。'));
    } finally {
      setEmailLoading(false);
    }
  };

  if (mode === 'signup' && signupPhase === 'verify-otp') {
    return (
      <div className="mx-auto min-h-screen w-full min-w-0 max-w-xl overflow-x-hidden bg-white">
        <div className="border-b p-4">
          <button
            type="button"
            onClick={() => {
              resetSignupFlow();
              setAuthError('');
              setAuthInfo('');
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-black"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{authT.backEditSignup}</span>
          </button>
        </div>

        <div className="min-w-0 px-4 py-10 sm:px-6 sm:py-12">
          <div className="text-center mb-8">
            <img src={thouseLogo} alt={authT.brandAlt} className="w-20 h-20 mx-auto mb-4" />
            <h1 className="text-2xl mb-2">{authT.verifyEmail}</h1>
            <p className="text-gray-600 text-sm">
              {signupEmailSent ? (
                <>
                  {authT.verifyEmailSentTo}
                  <br />
                  <strong>{pendingSignupEmail}</strong>
                  <br />
                  <span className="text-gray-500">{authT.verifyEmailHintSent}</span>
                </>
              ) : (
                <>
                  {authT.verifyEmailWillSendTo}
                  <br />
                  <strong>{pendingSignupEmail}</strong>
                  <br />
                  <span className="text-gray-500">{authT.verifyEmailHintPending}</span>
                </>
              )}
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              type="button"
              className="w-full h-12 bg-black text-white hover:bg-gray-800"
              disabled={emailLoading || otpCode.length !== 6}
              onClick={() => void handleVerifyOtp()}
            >
              {emailLoading ? authT.verifying : authT.confirmOtp}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full h-12"
              disabled={emailLoading || resendCooldown > 0}
              onClick={() => void handleResendOtp()}
            >
              {resendCooldown > 0
                ? authT.format('resendCooldown', { seconds: resendCooldown })
                : signupEmailSent
                  ? authT.resendOtp
                  : authT.sendOtp}
            </Button>
          </div>

          {authError ? <p className="mt-3 text-sm text-red-500 text-center">{authError}</p> : null}
          {authInfo ? <p className="mt-3 text-sm text-green-600 text-center">{authInfo}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full min-w-0 max-w-xl overflow-x-hidden bg-white">
      {/* Header */}
      <div className="border-b p-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-black"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{commonT.back}</span>
        </button>
      </div>

      {/* Content */}
      <div className="min-w-0 px-4 py-10 sm:px-6 sm:py-12">
        <div className="text-center mb-8">
          <img src={thouseLogo} alt={authT.brandAlt} className="w-20 h-20 mx-auto mb-4" />
          <h1 className="text-2xl mb-2">
            {role === 'tenant'
              ? mode === 'signin'
                ? authT.tenantSignIn
                : authT.tenantSignUp
              : mode === 'signin'
                ? authT.landlordSignIn
                : authT.landlordSignUp}
          </h1>
          <p className="text-gray-600">
            {mode === 'signin' ? authT.signInWelcome : authT.signUpWelcome}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' ? (
            <div>
              <label className="block mb-2 text-sm text-gray-700">{authT.fullName}</label>
              <Input
                type="text"
                placeholder={authT.fullNamePlaceholder}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-12"
              />
            </div>
          ) : null}

          {mode === 'signup' ? (
            <div>
              <label className="block mb-2 text-sm text-gray-700">{authT.username}</label>
              <Input
                type="text"
                placeholder={role === 'tenant' ? authT.usernamePlaceholderTenant : authT.usernamePlaceholderLandlord}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-12"
              />
            </div>
          ) : null}

          <div>
            <label className="block mb-2 text-sm text-gray-700">
              {mode === 'signin' ? authT.emailOrUsername : authT.email}
            </label>
            <Input
              type="text"
              inputMode={mode === 'signup' ? 'email' : 'text'}
              autoComplete={mode === 'signup' ? 'email' : 'username'}
              placeholder={mode === 'signin' ? authT.emailOrUsernamePlaceholder : authT.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12"
            />
            {mode === 'signup' ? (
              <p className="mt-1.5 text-xs text-gray-500">{authT.signUpOtpHint}</p>
            ) : null}
          </div>

          {mode === 'signup' || mode === 'signin' ? (
            <div>
              <label className="block mb-2 text-sm text-gray-700">{authT.password}</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12"
              />
              {mode === 'signup' ? (
                <p className="mt-1.5 text-xs text-gray-500">{PASSWORD_REQUIREMENTS_HINT}</p>
              ) : null}
            </div>
          ) : null}

          {mode === 'signup' ? (
            <div>
              <label className="block mb-2 text-sm text-gray-700">{authT.confirmPassword}</label>
              <Input
                type="password"
                placeholder={authT.confirmPasswordPlaceholder}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-12"
              />
            </div>
          ) : null}

          <Button 
            type="submit" 
            className="w-full h-12 bg-black text-white hover:bg-gray-800 mt-6"
            disabled={emailLoading}
          >
            {emailLoading
              ? mode === 'signin'
                ? authT.signingIn
                : authT.signingUp
              : mode === 'signin'
                ? authT.signIn
                : authT.signUp}
          </Button>
        </form>

        {authError ? (
          <p className="mt-3 text-sm text-red-500 text-center">{authError}</p>
        ) : null}

        {authInfo ? (
          <p className="mt-3 text-sm text-green-600 text-center">{authInfo}</p>
        ) : null}

        <div className="mt-6 text-center">
          <button
            type="button"
            className="text-sm text-gray-600 underline"
            onClick={() => {
              setAuthError('');
              setAuthInfo('');
              setShowForgotPassword((prev) => {
                if (prev) setForgotPasswordEmail('');
                return !prev;
              });
            }}
          >
            {authT.forgotPassword}
          </button>
        </div>

        {showForgotPassword ? (
          <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-600">{authT.forgotPasswordDetail}</p>
            <div>
              <label className="mb-2 block text-sm text-gray-700">{authT.email}</label>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={authT.emailPlaceholder}
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                className="h-12 bg-white"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleForgotPassword}
              disabled={emailLoading}
            >
              {authT.sendResetPasswordLink}
            </Button>
          </div>
        ) : null}

        <div className="mt-8 pt-8 border-t text-center">
          <p className="text-sm text-gray-600 mb-4">
            {mode === 'signin' ? authT.noAccount : authT.hasAccount}
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full h-12"
            onClick={() => {
              setAuthError('');
              setAuthInfo('');
              resetSignupFlow();
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setFullName('');
              setUsername('');
              setEmail('');
            }}
          >
            {mode === 'signin' ? authT.createAccount : authT.backToSignIn}
          </Button>
        </div>
      </div>
    </div>
  );
}
