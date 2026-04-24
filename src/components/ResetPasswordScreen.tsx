import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { supabase } from '../lib/supabase';

interface ResetPasswordScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function ResetPasswordScreen({ onBack, onSuccess }: ResetPasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setInfo('');
      setLoading(true);

      if (password.length < 6) {
        throw new Error('密碼至少需要 6 個字元。');
      }

      if (password !== confirmPassword) {
        throw new Error('兩次輸入的密碼不一致。');
      }

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setInfo('密碼已成功更新。');
      setTimeout(() => {
        onSuccess();
      }, 800);
    } catch (error) {
      setError(error instanceof Error ? error.message : '重設密碼失敗，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white min-h-screen">
      <div className="p-4 border-b">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-black">
          <ArrowLeft className="w-5 h-5" />
          <span>返回</span>
        </button>
      </div>

      <div className="px-6 py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl mb-2">設定新密碼</h1>
          <p className="text-gray-600">請輸入並確認你的新密碼。</p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block mb-2 text-sm text-gray-700">新密碼</label>
            <Input
              type="password"
              placeholder="至少 6 個字元"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-12"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm text-gray-700">確認新密碼</label>
            <Input
              type="password"
              placeholder="再次輸入新密碼"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="h-12"
            />
          </div>

          <Button type="submit" className="w-full h-12 bg-black text-white hover:bg-gray-800" disabled={loading}>
            {loading ? '更新中...' : '更新密碼'}
          </Button>
        </form>

        {error ? <p className="mt-4 text-sm text-red-500 text-center">{error}</p> : null}
        {info ? <p className="mt-4 text-sm text-green-600 text-center">{info}</p> : null}
      </div>
    </div>
  );
}
