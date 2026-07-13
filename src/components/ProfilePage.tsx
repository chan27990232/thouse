import { useEffect, useState } from 'react';
import { ArrowLeft, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { supabase } from '../lib/supabase';
import { getRoleFromMetadata, getSalutationFromMetadata, getStoredAuthRole, getUsernameFromMetadata } from '../lib/auth';
import { normalizeSalutation, type AppSalutation } from '../lib/salutation';
import { computeLandlordResponseTimeLabel } from '../lib/landlordResponseTime';
import { TransactionReviewPanel } from './TransactionReviewPanel';
import { IdentityVerificationDialog } from './IdentityVerificationDialog';
import { useLocale } from '../context/LocaleContext';
import { salutationLabel } from '../content/translations/profile';
import { responseTimeMessages } from '../content/translations/responseTime';
import { formatLocaleDateTimeLong } from '../lib/i18nDate';

interface ProfilePageProps {
  onBack: () => void;
  onSignOut: () => void;
  onEditProfile: () => void;
}

export function ProfilePage({ onBack, onSignOut, onEditProfile }: ProfilePageProps) {
  const { locale, profileT } = useLocale();
  const [salutation, setSalutation] = useState<AppSalutation>('');
  const [fullName, setFullName] = useState('');
  const [loginAccountId, setLoginAccountId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [responseTime, setResponseTime] = useState('');
  const [responseTimeLoading, setResponseTimeLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [landlordVerificationStatus, setLandlordVerificationStatus] = useState<'none' | 'pending' | 'rejected'>('none');
  const [landlordVerificationRejectionReason, setLandlordVerificationRejectionReason] = useState('');
  const [landlordVerificationSubmittedAt, setLandlordVerificationSubmittedAt] = useState<string | null>(null);
  const [tenantVerificationStatus, setTenantVerificationStatus] = useState<'none' | 'pending' | 'rejected'>('none');
  const [tenantVerificationRejectionReason, setTenantVerificationRejectionReason] = useState('');
  const [tenantVerificationSubmittedAt, setTenantVerificationSubmittedAt] = useState<string | null>(null);
  const [role, setRole] = useState<'tenant' | 'landlord' | ''>('');
  const [loading, setLoading] = useState(true);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
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
            'full_name,username,email,salutation,phone,response_time,is_verified,role,landlord_verification_status,landlord_verification_rejection_reason,landlord_verification_submitted_at,tenant_verification_status,tenant_verification_rejection_reason,tenant_verification_submitted_at',
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
              .select('full_name,username,email,salutation,phone,response_time,is_verified,role')
              .eq('id', user.id)
              .maybeSingle();
            profile = legacy as typeof profile;
          } else {
            throw profileRes.error;
          }
        }

        if (!isMounted) return;

        setSalutation(normalizeSalutation(profile?.salutation ?? getSalutationFromMetadata(user.user_metadata)));
        const loadedFullName =
          profile?.full_name ?? (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '');
        setFullName(loadedFullName);
        setLoginAccountId(
          (typeof profile?.username === 'string' ? profile.username : '') || getUsernameFromMetadata(user.user_metadata),
        );
        setPhone(profile?.phone ?? (typeof user.user_metadata?.phone === 'string' ? user.user_metadata.phone : ''));
        setEmail(profile?.email ?? user.email ?? '');
        setResponseTime('');
        setResponseTimeLoading(false);
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
          setError(e instanceof Error ? e.message : profileT.loadError);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [profileT.loadError]);

  useEffect(() => {
    let isMounted = true;

    const loadResponseTime = async () => {
      if (role !== 'landlord') {
        setResponseTime('');
        setResponseTimeLoading(false);
        return;
      }

      setResponseTimeLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!isMounted || !user) return;
        const label = await computeLandlordResponseTimeLabel(user.id, locale);
        if (isMounted) setResponseTime(label);
      } catch {
        if (isMounted) setResponseTime(responseTimeMessages[locale].noData);
      } finally {
        if (isMounted) setResponseTimeLoading(false);
      }
    };

    void loadResponseTime();

    return () => {
      isMounted = false;
    };
  }, [role, locale]);

  const handleVerificationSubmitted = () => {
    setInfo(profileT.verificationSubmitted);
    setError('');
    if (role === 'landlord') {
      setLandlordVerificationStatus('pending');
      setLandlordVerificationRejectionReason('');
      setLandlordVerificationSubmittedAt(new Date().toISOString());
    } else if (role === 'tenant') {
      setTenantVerificationStatus('pending');
      setTenantVerificationRejectionReason('');
      setTenantVerificationSubmittedAt(new Date().toISOString());
    }
  };

  const verificationStatus =
    role === 'landlord' ? landlordVerificationStatus : tenantVerificationStatus;
  const verificationSubmittedAt =
    role === 'landlord' ? landlordVerificationSubmittedAt : tenantVerificationSubmittedAt;
  const verificationRejectionReason =
    role === 'landlord' ? landlordVerificationRejectionReason : tenantVerificationRejectionReason;

  return (
    <div className="mx-auto min-h-screen w-full min-w-0 max-w-3xl overflow-x-hidden bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <button onClick={onBack} className="flex min-w-0 items-center gap-2 text-gray-600 hover:text-black">
          <ArrowLeft className="h-5 w-5 shrink-0" />
          <span>{profileT.back}</span>
        </button>
        <Button variant="outline" onClick={onSignOut} className="shrink-0">
          {profileT.signOut}
        </Button>
      </div>

      <div className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <User className="w-10 h-10 text-gray-500" />
          </div>
          <h1 className="text-2xl">{profileT.title}</h1>
          <p className="text-gray-600 mt-2">{profileT.subtitle}</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">{profileT.loading}</div>
        ) : (
          <div className="space-y-5">
            <div>
              <Label>{profileT.salutation}</Label>
              <Input
                className="mt-2 h-12 bg-gray-50"
                value={salutation ? salutationLabel(salutation, locale) : '—'}
                readOnly
              />
            </div>

            <div>
              <Label>{profileT.loginAccountId}</Label>
              <Input className="mt-2 h-12 bg-gray-50" value={loginAccountId || '—'} readOnly />
              <p className="mt-1.5 text-xs text-gray-500">{profileT.loginAccountIdHint}</p>
            </div>

            <div>
              <Label>{profileT.fullName}</Label>
              <Input className="mt-2 h-12 bg-gray-50" value={fullName || '—'} readOnly />
            </div>

            <div>
              <Label>{profileT.phone}</Label>
              <Input className="mt-2 h-12 bg-gray-50" value={phone || '—'} readOnly />
            </div>

            <div>
              <Label>{profileT.email}</Label>
              <Input className="mt-2 h-12 bg-gray-50" value={email || '—'} readOnly />
            </div>

            {role === 'landlord' ? (
              <div>
                <Label>{profileT.responseTime}</Label>
                <div className="mt-2 flex min-h-12 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900">
                  {responseTimeLoading ? profileT.responseTimeLoading : responseTime || '暫無數據'}
                </div>
                <p className="mt-1.5 text-xs text-gray-500">{profileT.responseTimeAutoHint}</p>
              </div>
            ) : null}

            {role === 'landlord' || role === 'tenant' ? (
              isVerified ? (
                <section
                  className="relative z-10 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  aria-label={profileT.verificationAria}
                >
                  <Label className="text-zinc-900">{profileT.verificationStatus}</Label>
                  <div className="mt-2">
                    <div className="flex min-h-12 items-center rounded-md border border-green-200 bg-green-50 px-3 text-sm font-medium text-green-900">
                      {profileT.verified}
                    </div>
                  </div>
                </section>
              ) : (
              <section
                className="relative z-10 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                aria-label={profileT.verificationAria}
              >
                <Label className="text-zinc-900">{profileT.verificationStatus}</Label>
                <div className="mt-2 space-y-3 text-zinc-900">
                  {verificationStatus === 'pending' ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                      <p className="font-medium">{profileT.pendingReview}</p>
                      {verificationSubmittedAt ? (
                        <p className="mt-1 text-xs text-amber-900">
                          {profileT.submittedAt}
                          {formatLocaleDateTimeLong(verificationSubmittedAt, locale)}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-amber-900/90">{profileT.pendingHint}</p>
                    </div>
                  ) : verificationStatus === 'rejected' ? (
                    <div className="space-y-2">
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-950">
                        <p className="font-medium">{profileT.rejected}</p>
                        {verificationRejectionReason.trim() ? (
                          <p className="mt-1.5 text-xs leading-relaxed whitespace-pre-wrap">
                            {verificationRejectionReason}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-red-800">{profileT.rejectedHint}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-12 w-full items-center justify-center rounded-md border border-zinc-300 bg-white text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                        onClick={() => setVerificationDialogOpen(true)}
                      >
                        {profileT.resubmitVerification}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div
                        className="flex min-h-12 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-900"
                        data-slot="verify-status"
                      >
                        {profileT.notVerified}
                      </div>
                      <p className="text-xs text-zinc-600">
                        {role === 'landlord' ? profileT.landlordVerifyHint : profileT.tenantVerifyHint}
                      </p>
                      <button
                        type="button"
                        className="inline-flex h-12 w-full items-center justify-center rounded-md bg-zinc-900 text-sm font-medium !text-white shadow-sm transition hover:bg-zinc-800"
                        onClick={() => setVerificationDialogOpen(true)}
                      >
                        {profileT.openVerificationForm}
                      </button>
                    </div>
                  )}
                </div>
              </section>
              )
            ) : null}

            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            {info ? <p className="text-sm text-green-600">{info}</p> : null}

            <Button className="w-full h-12 bg-black text-white hover:bg-gray-800" onClick={onEditProfile}>
              {profileT.saveProfile}
            </Button>

            <div className="pt-10 border-t">
              <TransactionReviewPanel />
            </div>
          </div>
        )}
      </div>

      {(role === 'landlord' || role === 'tenant') && (
        <IdentityVerificationDialog
          open={verificationDialogOpen}
          onOpenChange={setVerificationDialogOpen}
          role={role}
          defaultLegalName={fullName}
          onSubmitted={handleVerificationSubmitted}
        />
      )}
    </div>
  );
}
