import { useEffect, useState } from 'react';
import { ArrowLeft, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { supabase } from '../lib/supabase';
import { getSalutationFromMetadata } from '../lib/auth';
import { TransactionReviewPanel } from './TransactionReviewPanel';

interface ProfilePageProps {
  onBack: () => void;
  onSignOut: () => void;
}

export function ProfilePage({ onBack, onSignOut }: ProfilePageProps) {
  const [salutation, setSalutation] = useState<'' | '先生' | '女士'>('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [responseTime, setResponseTime] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [role, setRole] = useState<'tenant' | 'landlord' | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      setLoading(true);
      setError('');

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted || !user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name,email,salutation,phone,response_time,is_verified,role')
        .eq('id', user.id)
        .maybeSingle();

      if (!isMounted) return;

      setSalutation(
        profile?.salutation === '先生' || profile?.salutation === '女士'
          ? profile.salutation
          : getSalutationFromMetadata(user.user_metadata)
      );
      setFullName(profile?.full_name ?? (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''));
      setPhone(profile?.phone ?? (typeof user.user_metadata?.phone === 'string' ? user.user_metadata.phone : ''));
      setEmail(profile?.email ?? user.email ?? '');
      setResponseTime(typeof profile?.response_time === 'string' ? profile.response_time : '');
      setIsVerified(Boolean(profile?.is_verified));
      setRole(profile?.role === 'tenant' || profile?.role === 'landlord' ? profile.role : '');
      setLoading(false);
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setInfo('');

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('未登入，無法更新個人資料。');
      }

      const { error } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          salutation,
          full_name: fullName.trim(),
          phone: phone.trim(),
        },
      });

      if (error) throw error;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          salutation,
          full_name: fullName.trim(),
          phone: phone.trim(),
          response_time: responseTime.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      setInfo('個人資料已更新。');
    } catch (error) {
      setError(error instanceof Error ? error.message : '更新失敗，請稍後再試。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white min-h-screen">
      <div className="p-4 border-b flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-black">
          <ArrowLeft className="w-5 h-5" />
          <span>返回</span>
        </button>
        <Button variant="outline" onClick={onSignOut}>
          登出
        </Button>
      </div>

      <div className="px-6 py-10">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <User className="w-10 h-10 text-gray-500" />
          </div>
          <h1 className="text-2xl">個人資料</h1>
          <p className="text-gray-600 mt-2">管理你的真實姓名與聯絡方式</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">正在載入個人資料...</div>
        ) : (
          <div className="space-y-5">
            <div>
              <Label>稱謂</Label>
              <div className="mt-2 flex gap-3">
                <Button
                  type="button"
                  variant={salutation === '先生' ? 'default' : 'outline'}
                  className={salutation === '先生' ? 'bg-black text-white hover:bg-gray-800' : ''}
                  onClick={() => setSalutation('先生')}
                >
                  先生
                </Button>
                <Button
                  type="button"
                  variant={salutation === '女士' ? 'default' : 'outline'}
                  className={salutation === '女士' ? 'bg-black text-white hover:bg-gray-800' : ''}
                  onClick={() => setSalutation('女士')}
                >
                  女士
                </Button>
              </div>
            </div>

            <div>
              <Label>真實姓名</Label>
              <Input
                className="mt-2 h-12"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="請輸入真實姓名"
              />
            </div>

            <div>
              <Label>電話</Label>
              <Input
                className="mt-2 h-12"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="請輸入聯絡電話"
              />
            </div>

            <div>
              <Label>Email</Label>
              <Input className="mt-2 h-12 bg-gray-50" value={email} readOnly />
            </div>

            {role === 'landlord' ? (
              <>
                <div>
                  <Label>平均回覆時間</Label>
                  <Input
                    className="mt-2 h-12"
                    value={responseTime}
                    onChange={(e) => setResponseTime(e.target.value)}
                    placeholder="例如：1小時內"
                  />
                </div>

                <div>
                  <Label>驗證狀態</Label>
                  <div className="mt-2 h-12 rounded-md border bg-gray-50 px-3 flex items-center text-sm text-gray-700">
                    {isVerified ? '已驗證' : '未驗證'}
                  </div>
                </div>
              </>
            ) : null}

            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            {info ? <p className="text-sm text-green-600">{info}</p> : null}

            <Button className="w-full h-12 bg-black text-white hover:bg-gray-800" onClick={handleSave} disabled={saving}>
              {saving ? '儲存中...' : '儲存個人資料'}
            </Button>

            <div className="pt-10 border-t">
              <TransactionReviewPanel />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
