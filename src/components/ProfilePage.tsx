import { useEffect, useState } from 'react';
import { ArrowLeft, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { supabase } from '../lib/supabase';
import { getRoleFromMetadata, getSalutationFromMetadata, getStoredAuthRole } from '../lib/auth';
import {
  submitLandlordVerificationRequest,
  submitTenantVerificationRequest,
} from '../lib/landlordVerification';
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
  const [landlordVerificationStatus, setLandlordVerificationStatus] = useState<'none' | 'pending' | 'rejected'>('none');
  const [landlordVerificationRejectionReason, setLandlordVerificationRejectionReason] = useState('');
  const [landlordVerificationSubmittedAt, setLandlordVerificationSubmittedAt] = useState<string | null>(null);
  const [tenantVerificationStatus, setTenantVerificationStatus] = useState<'none' | 'pending' | 'rejected'>('none');
  const [tenantVerificationRejectionReason, setTenantVerificationRejectionReason] = useState('');
  const [tenantVerificationSubmittedAt, setTenantVerificationSubmittedAt] = useState<string | null>(null);
  const [role, setRole] = useState<'tenant' | 'landlord' | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      setLoading(true);
      setError('');

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!isMounted || !user) {
          setLoading(false);
          return;
        }

        const profileRes = await supabase
          .from('profiles')
          .select(
            'full_name,email,salutation,phone,response_time,is_verified,role,landlord_verification_status,landlord_verification_rejection_reason,landlord_verification_submitted_at,tenant_verification_status,tenant_verification_rejection_reason,tenant_verification_submitted_at',
          )
          .eq('id', user.id)
          .maybeSingle();

        let profile = profileRes.data;
        if (profileRes.error) {
          const errMsg = (profileRes.error.message || '').toLowerCase();
          if (
            errMsg.includes('column') &&
            (errMsg.includes('landlord_verification') || errMsg.includes('tenant_verification'))
          ) {
            const { data: legacy } = await supabase
              .from('profiles')
              .select('full_name,email,salutation,phone,response_time,is_verified,role')
              .eq('id', user.id)
              .maybeSingle();
            profile = legacy as typeof profile;
          } else {
            throw profileRes.error;
          }
        }

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
        const lvs = profile?.landlord_verification_status;
        setLandlordVerificationStatus(
          lvs === 'pending' || lvs === 'rejected' ? lvs : 'none',
        );
        setLandlordVerificationRejectionReason(
          typeof profile?.landlord_verification_rejection_reason === 'string'
            ? profile.landlord_verification_rejection_reason
            : '',
        );
        setLandlordVerificationSubmittedAt(
          typeof profile?.landlord_verification_submitted_at === 'string'
            ? profile.landlord_verification_submitted_at
            : null,
        );
        const tvs = (profile as { tenant_verification_status?: string } | null)?.tenant_verification_status;
        setTenantVerificationStatus(
          tvs === 'pending' || tvs === 'rejected' ? tvs : 'none',
        );
        setTenantVerificationRejectionReason(
          typeof (profile as { tenant_verification_rejection_reason?: string } | null)
            ?.tenant_verification_rejection_reason === 'string'
            ? (profile as { tenant_verification_rejection_reason: string }).tenant_verification_rejection_reason
            : '',
        );
        setTenantVerificationSubmittedAt(
          typeof (profile as { tenant_verification_submitted_at?: string } | null)
            ?.tenant_verification_submitted_at === 'string'
            ? (profile as { tenant_verification_submitted_at: string }).tenant_verification_submitted_at
            : null,
        );
        const dbRole = profile?.role;
        const roleFromRow =
          dbRole === 'tenant' || dbRole === 'landlord' ? dbRole : null;
        const roleResolved: 'tenant' | 'landlord' =
          roleFromRow ?? getRoleFromMetadata(user.user_metadata) ?? getStoredAuthRole() ?? 'tenant';
        setRole(roleResolved);
      } catch (e) {
        if (isMounted) {
          setError(e instanceof Error ? e.message : '無法載入個人資料');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatSubmitted = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('zh-HK', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const handleSubmitVerification = async () => {
    setVerifySubmitting(true);
    setError('');
    setInfo('');
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('未登入。');
      if (role === 'landlord') {
        await submitLandlordVerificationRequest(user.id);
        setInfo('已提交審核，請等候平台處理。');
        setLandlordVerificationStatus('pending');
        setLandlordVerificationRejectionReason('');
        setLandlordVerificationSubmittedAt(new Date().toISOString());
      } else if (role === 'tenant') {
        await submitTenantVerificationRequest(user.id);
        setInfo('已提交審核，請等候平台處理。');
        setTenantVerificationStatus('pending');
        setTenantVerificationRejectionReason('');
        setTenantVerificationSubmittedAt(new Date().toISOString());
      } else {
        throw new Error('僅限業主或租客帳戶。');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失敗，請稍後再試。');
    } finally {
      setVerifySubmitting(false);
    }
  };

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
    <div className="mx-auto min-h-screen w-full min-w-0 max-w-3xl overflow-x-hidden bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <button onClick={onBack} className="flex min-w-0 items-center gap-2 text-gray-600 hover:text-black">
          <ArrowLeft className="h-5 w-5 shrink-0" />
          <span>返回</span>
        </button>
        <Button variant="outline" onClick={onSignOut} className="shrink-0">
          登出
        </Button>
      </div>

      <div className="px-4 py-8 sm:px-6 sm:py-10">
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
              <div>
                <Label>平均回覆時間</Label>
                <Input
                  className="mt-2 h-12"
                  value={responseTime}
                  onChange={(e) => setResponseTime(e.target.value)}
                  placeholder="例如：1小時內"
                />
              </div>
            ) : null}

            {role === 'landlord' || role === 'tenant' ? (
              isVerified ? (
                <section
                  className="relative z-10 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  aria-label="實名驗證"
                >
                  <Label className="text-zinc-900">驗證狀態</Label>
                  <div className="mt-2">
                    <div className="flex min-h-12 items-center rounded-md border border-green-200 bg-green-50 px-3 text-sm font-medium text-green-900">
                      已驗證
                    </div>
                  </div>
                </section>
              ) : (
              <section
                className="relative z-10 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                aria-label="實名驗證"
              >
                <Label className="text-zinc-900">驗證狀態</Label>
                <div className="mt-2 space-y-3 text-zinc-900">
                  {(role === 'landlord' ? landlordVerificationStatus : tenantVerificationStatus) === 'pending' ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                      <p className="font-medium">待審核</p>
                      {(role === 'landlord' ? landlordVerificationSubmittedAt : tenantVerificationSubmittedAt) ? (
                        <p className="mt-1 text-xs text-amber-900">
                          申請時間：
                          {formatSubmitted(
                            (role === 'landlord' ? landlordVerificationSubmittedAt : tenantVerificationSubmittedAt) ?? '',
                          )}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-amber-900/90">我們會在合理時間內審核你的帳戶。</p>
                    </div>
                  ) : (role === 'landlord' ? landlordVerificationStatus : tenantVerificationStatus) === 'rejected' ? (
                    <div className="space-y-2">
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-950">
                        <p className="font-medium">已駁回</p>
                        {(role === 'landlord' ? landlordVerificationRejectionReason : tenantVerificationRejectionReason).trim() ? (
                          <p className="mt-1.5 text-xs leading-relaxed whitespace-pre-wrap">
                            {role === 'landlord' ? landlordVerificationRejectionReason : tenantVerificationRejectionReason}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-red-800">請聯絡客服或依指示修正後再申請。</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-12 w-full items-center justify-center rounded-md border border-zinc-300 bg-white text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => void handleSubmitVerification()}
                        disabled={verifySubmitting}
                      >
                        {verifySubmitting ? '提交中…' : '重新提交驗證申請'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div
                        className="flex min-h-12 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-900"
                        data-slot="verify-status"
                      >
                        未驗證
                      </div>
                      <p className="text-xs text-zinc-600">
                        {role === 'landlord'
                          ? '審核通過後會顯示「已驗證」標示，提升租客信心。提交後由平台在後台審核。'
                          : '審核通過後會顯示「已驗證」標示，讓業主更安心。提交後由平台在後台審核。'}
                      </p>
                      <button
                        type="button"
                        className="inline-flex h-12 w-full items-center justify-center rounded-md bg-zinc-900 text-sm font-medium !text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => void handleSubmitVerification()}
                        disabled={verifySubmitting}
                      >
                        {verifySubmitting ? '提交中…' : '提交實名驗證申請'}
                      </button>
                    </div>
                  )}
                </div>
              </section>
              )
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
