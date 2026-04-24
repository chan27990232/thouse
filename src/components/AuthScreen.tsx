import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { UserRole } from '../App';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';
import { AUTH_ROLE_STORAGE_KEY, getRoleFromMetadata } from '../lib/auth';
import { findEmailByUsername } from '../lib/profiles';
import thouseLogo from 'figma:asset/f0c80b0c66e9c54aea3881bdf7a4eb152cbc4c0b.png';

interface AuthScreenProps {
  role: UserRole;
  onBack: () => void;
  onAuthSuccess: (role: UserRole) => void;
}

export function AuthScreen({ role, onBack, onAuthSuccess }: AuthScreenProps) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authInfo, setAuthInfo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAuthError('');
      setAuthInfo('');
      setEmailLoading(true);
      localStorage.setItem(AUTH_ROLE_STORAGE_KEY, role ?? 'tenant');

      if (mode === 'signup') {
        if (!fullName.trim()) {
          throw new Error('請輸入用戶名稱。');
        }
        if (!username.trim()) {
          throw new Error('請輸入登入帳號。');
        }
        if (password.length < 6) {
          throw new Error('密碼至少需要 6 個字元。');
        }
        if (password !== confirmPassword) {
          throw new Error('兩次輸入的密碼不一致。');
        }

        const normalizedUsername = username.trim().toLowerCase();
        const existingEmail = await findEmailByUsername(normalizedUsername).catch(() => null);
        if (existingEmail) {
          throw new Error('此帳號名稱已被使用，請改用另一個 username。');
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName.trim(),
              role: role ?? 'tenant',
              username: normalizedUsername,
            },
          },
        });

        if (error) throw error;

        const metadataRole = getRoleFromMetadata(data.user?.user_metadata);

        if (data.session) {
          onAuthSuccess(metadataRole ?? role);
        } else {
          setAuthInfo('註冊成功，請先到電郵收件匣確認帳戶，再返回登入。');
          setMode('signin');
        }
        return;
      }

      const loginIdentifier = email.trim();
      const resolvedEmail = loginIdentifier.includes('@')
        ? loginIdentifier
        : await findEmailByUsername(loginIdentifier);

      if (!resolvedEmail) {
        throw new Error('找不到這個 username，請檢查後再試。');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });

      if (error) throw error;

      const metadataRole = getRoleFromMetadata(data.user.user_metadata);
      onAuthSuccess(metadataRole ?? role);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '登入失敗，請稍後再試。');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    try {
      setAuthError('');
      setAuthInfo('');

      if (!email) {
        throw new Error('請先輸入你的 email 或 username。');
      }

      const loginIdentifier = email.trim();
      const resolvedEmail = loginIdentifier.includes('@')
        ? loginIdentifier
        : await findEmailByUsername(loginIdentifier);

      if (!resolvedEmail) {
        throw new Error('找不到這個 username，請檢查後再試。');
      }

      const { error } = await supabase.auth.resetPasswordForEmail(resolvedEmail, {
        redirectTo: window.location.origin,
      });

      if (error) throw error;

      setAuthInfo('重設密碼連結已寄出，請到你的電子郵件收件匣查看。');
      setShowForgotPassword(false);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '無法寄出重設密碼 email。');
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full min-w-0 max-w-xl overflow-x-hidden bg-white">
      {/* Header */}
      <div className="border-b p-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-black"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回</span>
        </button>
      </div>

      {/* Content */}
      <div className="min-w-0 px-4 py-10 sm:px-6 sm:py-12">
        <div className="text-center mb-8">
          <img src={thouseLogo} alt="簡屋" className="w-20 h-20 mx-auto mb-4" />
          <h1 className="text-2xl mb-2">
            {role === 'tenant' ? (mode === 'signin' ? '租客登入' : '租客註冊') : mode === 'signin' ? '業主登入' : '業主註冊'}
          </h1>
          <p className="text-gray-600">
            {mode === 'signin' ? '歡迎回來，請登入您的帳戶' : '建立帳戶以開始使用平台功能'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' ? (
            <div>
              <label className="block mb-2 text-sm text-gray-700">名稱</label>
              <Input
                type="text"
                placeholder="請輸入顯示名稱"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-12"
              />
            </div>
          ) : null}

          {mode === 'signup' ? (
            <div>
              <label className="block mb-2 text-sm text-gray-700">登入帳號 username</label>
              <Input
                type="text"
                placeholder="例如：tenant123"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-12"
              />
            </div>
          ) : null}

          <div>
            <label className="block mb-2 text-sm text-gray-700">
              {mode === 'signin' ? '電子郵件或 username' : '電子郵件'}
            </label>
            <Input
              type={mode === 'signin' ? 'text' : 'email'}
              placeholder={mode === 'signin' ? '輸入 email 或 username' : 'your@email.com'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12"
            />
          </div>
          
          <div>
            <label className="block mb-2 text-sm text-gray-700">密碼</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-12"
            />
          </div>

          {mode === 'signup' ? (
            <div>
              <label className="block mb-2 text-sm text-gray-700">確認密碼</label>
              <Input
                type="password"
                placeholder="再次輸入密碼"
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
            {emailLoading ? (mode === 'signin' ? '登入中...' : '註冊中...') : mode === 'signin' ? '登入' : '註冊'}
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
              setShowForgotPassword((prev) => !prev);
            }}
          >
            忘記密碼？
          </button>
        </div>

        {showForgotPassword ? (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <p className="text-sm text-gray-600">系統會將重設密碼連結寄到你輸入的電子郵件。</p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleForgotPassword}
              disabled={emailLoading}
            >
              寄出重設密碼連結
            </Button>
          </div>
        ) : null}

        <div className="mt-8 pt-8 border-t text-center">
          <p className="text-sm text-gray-600 mb-4">
            {mode === 'signin' ? '還沒有帳戶？' : '已經有帳戶？'}
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full h-12"
            onClick={() => {
              setAuthError('');
              setAuthInfo('');
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setFullName('');
              setUsername('');
            }}
          >
            {mode === 'signin' ? '註冊新帳戶' : '返回登入'}
          </Button>
        </div>
      </div>
    </div>
  );
}
