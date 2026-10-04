import { useEffect, useState } from 'react';
import { ArrowLeft, Camera, Loader2, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { supabase } from '../lib/supabase';
import { getRoleFromMetadata, getSalutationFromMetadata, getStoredAuthRole, getUsernameFromMetadata } from '../lib/auth';
import { normalizeSalutation, type AppSalutation } from '../lib/salutation';
import { computeLandlordResponseTimeLabel } from '../lib/landlordResponseTime';
import { TransactionReviewPanel } from './TransactionReviewPanel';
import { IdentityVerificationDialog } from './IdentityVerificationDialog';
import { ProfileAvatarEditor } from './ProfileAvatarEditor';
import { useLocale } from '../context/LocaleContext';
import { salutationLabel } from '../content/translations/profile';
import { responseTimeMessages } from '../content/translations/responseTime';
import { formatLocaleDateTimeLong } from '../lib/i18nDate';
import { PhoneCountryField } from './PhoneCountryField';
import { splitPhoneNumber, type PhoneCountryLabelKey } from '../lib/phoneCountryCode';
import { toast } from 'sonner';

interface ProfilePageProps {
  onBack: () => void;
  onSignOut: () => void;
  onEditProfile: () => void;
  autoOpenVerification?: boolean;
  onAutoOpenVerificationConsumed?: () => void;
}

export function ProfilePage({
  onBack,
  onSignOut,
  onEditProfile,
  autoOpenVerification = false,
  onAutoOpenVerificationConsumed,
}: ProfilePageProps) {
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
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
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
            'full_name,username,email,salutation,phone,response_time,is_verified,role,avatar_url,landlord_verification_status,landlord_verification_rejection_reason,landlord_verification_submitted_at,tenant_verification_status,tenant_verification_rejection_reason,tenant_verification_submitted_at',
          )
          .eq('id', user.id)
          .maybeSingle();

        let profile = profileRes.data;
        if (profileRes.error) {
          const errMsg = (profileRes.error.message || '').toLowerCase();
          if (
            errMsg.includes('column') &&
            (errMsg.includes('landlord_verification') ||
              errMsg.includes('tenant_verification') ||
              errMsg.includes('avatar_url'))
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
        setAvatarUrl(
          typeof (profile as { avatar_url?: string } | null)?.avatar_url === 'string'
            ? ((profile as { avatar_url?: string }).avatar_url ?? '').trim()
            : '',
        );
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

  useEffect(() => {
    if (!autoOpenVerification || loading) return;
    if (role !== 'landlord' && role !== 'tenant') {
      onAutoOpenVerificationConsumed?.();
      return;
    }
    if (!isVerified && verificationStatus !== 'pending') {
      setVerificationDialogOpen(true);
    }
    onAutoOpenVerificationConsumed?.();
  }, [
    autoOpenVerification,
    loading,
    role,
    isVerified,
    verificationStatus,
    onAutoOpenVerificationConsumed,
  ]);

  const toastAvatarUploadError = (e: unknown) => {
    const code = e instanceof Error ? e.message : '';
    if (code === 'INVALID_TYPE') {
      toast.error(profileT.avatarInvalidType);
    } else if (code === 'TOO_LARGE') {
      toast.error(profileT.avatarTooLarge);
    } else if (code === 'BUCKET_MISSING' || code === 'RLS') {
      toast.error(profileT.avatarBucketMissing);
    } else {
      toast.error(profileT.avatarUploadFailed);
    }
  };

  const handleAvatarCroppedFile = async (file: File) => {
    if (avatarUploading) return;

    setAvatarUploading(true);
    setError('');
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('NOT_SIGNED_IN');
      }
      const url = await uploadProfileAvatar(user.id, file, avatarUrl);
      await updateOwnAvatarUrl(url);
      setAvatarUrl(url);
      toast.success(profileT.avatarUpdated);
    } catch (e) {
      toastAvatarUploadError(e);
      throw e;
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarRemove = async () => {
    if (avatarUploading || !avatarUrl) return;

    setAvatarUploading(true);
    setError('');
    try {
      await removeProfileAvatar(avatarUrl);
      setAvatarUrl('');
      toast.success(profileT.avatarRemoved);
    } catch {
      toast.error(profileT.avatarRemoveFailed);
    } finally {
      setAvatarUploading(false);
    }
  };

  const phoneParts = splitPhoneNumber(phone);

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
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <Avatar className="h-20 w-20 border border-gray-200 bg-gray-100">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName || profileT.title} /> : null}
              <AvatarFallback className="bg-gray-100 text-gray-500">
                <User className="h-10 w-10" />
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              disabled={avatarUploading || loading}
              onClick={() => setAvatarEditorOpen(true)}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60"
              aria-label={profileT.changeAvatar}
            >
              {avatarUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>
          </div>
          <button
            type="button"
            disabled={avatarUploading || loading}
            onClick={() => setAvatarEditorOpen(true)}
            className="mb-3 text-sm font-medium text-gray-700 underline-offset-2 hover:underline disabled:opacity-60"
          >
            {avatarUploading ? profileT.avatarUploading : profileT.changeAvatar}
          </button>
          <h1 className="text-2xl">{profileT.title}</h1>
          <p className="mt-2 text-gray-600">{profileT.subtitle}</p>
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
              <PhoneCountryField
                className="mt-2"
                readOnly
                countryCode={phoneParts.countryCode}
                phone={phone.trim() ? phoneParts.localNumber : '—'}
                phoneId="profile-phone"
                countryAriaLabel={profileT.phoneCountryCode}
                optionLabel={(key: PhoneCountryLabelKey) => profileT[key]}
              />
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

      <ProfileAvatarEditor
        open={avatarEditorOpen}
        onOpenChange={setAvatarEditorOpen}
        avatarUrl={avatarUrl}
        avatarAlt={fullName || profileT.title}
        hasAvatar={Boolean(avatarUrl)}
        busy={avatarUploading}
        onCroppedFile={handleAvatarCroppedFile}
        onRemove={handleAvatarRemove}
      />

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
