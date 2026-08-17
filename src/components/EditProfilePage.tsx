import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from './ui/input-otp';
import { supabase } from '../lib/supabase';
import { getSalutationFromMetadata, getUsernameFromMetadata } from '../lib/auth';
import { normalizeSalutation, SALUTATION_PREFER_NOT, type AppSalutation } from '../lib/salutation';
import { sendProfileEmailChangeOtp, updateOwnProfile } from '../lib/profileUpdate';
import { changeOwnPassword, getPasswordChangeQuota, PASSWORD_CHANGE_LIMIT_MESSAGE } from '../lib/changePassword';
import { SIGNUP_RESEND_COOLDOWN_SEC } from '../lib/signupEmailVerify';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';

interface EditProfilePageProps {
  onBack: () => void;
  onSaved: () => void;
}

export function EditProfilePage({ onBack, onSaved }: EditProfilePageProps) {
  const { profileT } = useLocale();
  const [salutation, setSalutation] = useState<AppSalutation>('');
  const [fullName, setFullName] = useState('');
  const [originalFullName, setOriginalFullName] = useState('');
  const [loginAccountId, setLoginAccountId] = useState('');
  const [nameChangesInWindow, setNameChangesInWindow] = useState(0);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordInfo, setPasswordInfo] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordChangeLocked, setPasswordChangeLocked] = useState(false);

  const emailChanged = email.trim().toLowerCase() !== originalEmail.trim().toLowerCase();
  const nameChangesRemaining = Math.max(0, 2 - nameChangesInWindow);
  const displayNameLocked = nameChangesRemaining <= 0;

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

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name,username,email,salutation,phone')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!isMounted) return;

        setSalutation(normalizeSalutation(profile?.salutation ?? getSalutationFromMetadata(user.user_metadata)));
        const loadedFullName =
          profile?.full_name ?? (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '');
        setFullName(loadedFullName);
        setOriginalFullName(loadedFullName.trim());
        setLoginAccountId(
          (typeof profile?.username === 'string' ? profile.username : '') || getUsernameFromMetadata(user.user_metadata),
        );
        const loadedEmail = profile?.email ?? user.email ?? '';
        setPhone(profile?.phone ?? (typeof user.user_metadata?.phone === 'string' ? user.user_metadata.phone : ''));
        setEmail(loadedEmail);
        setOriginalEmail(loadedEmail);

        const { data: quotaData, error: quotaError } = await supabase.rpc('get_display_name_change_quota');
        if (!quotaError && quotaData && typeof quotaData === 'object' && 'changes_in_window' in quotaData) {
          const count = (quotaData as { changes_in_window?: unknown }).changes_in_window;
          setNameChangesInWindow(typeof count === 'number' ? count : Number(count) || 0);
        }

        try {
          const passwordQuota = await getPasswordChangeQuota();
          if (isMounted) setPasswordChangeLocked(passwordQuota.locked);
        } catch {
          if (isMounted) setPasswordChangeLocked(false);
        }
      } catch (e) {
        if (isMounted) {
          setError(e instanceof Error ? e.message : profileT.loadError);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [profileT.loadError]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (!emailChanged) {
      setEmailCode('');
      setEmailOtpSent(false);
    }
  }, [emailChanged, originalEmail]);

  const handleSendEmailOtp = async () => {
    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail) {
      setError(profileT.emailRequired);
      return;
    }

    try {
      setSendingOtp(true);
      setError('');
      setInfo('');
      await sendProfileEmailChangeOtp(nextEmail);
      setEmailOtpSent(true);
      setResendCooldown(SIGNUP_RESEND_COOLDOWN_SEC);
      setInfo(profileT.emailOtpSent);
    } catch (e) {
      setError(e instanceof Error ? e.message : profileT.emailOtpSendFailed);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setInfo('');

      const trimmedName = fullName.trim();
      if (!trimmedName) {
        throw new Error(profileT.fullNamePlaceholder);
      }

      const nameChanged = trimmedName !== originalFullName;
      if (nameChanged && nameChangesInWindow >= 2) {
        throw new Error(profileT.displayNameChangeLimit);
      }

      if (emailChanged) {
        if (!emailCode.trim() || emailCode.trim().length !== 6) {
          throw new Error(profileT.emailOtpRequired);
        }
        if (!emailOtpSent) {
          throw new Error(profileT.emailOtpSendFirst);
        }
      }

      await updateOwnProfile({
        salutation,
        fullName: trimmedName,
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        emailCode: emailChanged ? emailCode.trim() : undefined,
      });

      toast.success(profileT.profileUpdated);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : profileT.updateFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      setUpdatingPassword(true);
      setPasswordError('');
      setPasswordInfo('');
      await changeOwnPassword({
        currentPassword,
        newPassword,
        confirmPassword: confirmNewPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordChangeLocked(true);
      setPasswordInfo(profileT.passwordUpdated);
      toast.success(profileT.passwordUpdated);
    } catch (e) {
      const message = e instanceof Error ? e.message : profileT.passwordUpdateFailed;
      setPasswordError(message);
      if (message === PASSWORD_CHANGE_LIMIT_MESSAGE || message === profileT.passwordChangeLimit) {
        setPasswordChangeLocked(true);
      }
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full min-w-0 max-w-3xl overflow-x-hidden bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <button onClick={onBack} className="flex min-w-0 items-center gap-2 text-gray-600 hover:text-black">
          <ArrowLeft className="h-5 w-5 shrink-0" />
          <span>{profileT.back}</span>
        </button>
      </div>

      <div className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl">{profileT.editTitle}</h1>
          <p className="mt-2 text-gray-600">{profileT.editSubtitle}</p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500">{profileT.loading}</div>
        ) : (
          <div className="space-y-5">
            <div>
              <Label>{profileT.salutation}</Label>
              <div className="mt-2 flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant={salutation === '先生' ? 'default' : 'outline'}
                  className={salutation === '先生' ? 'bg-black text-white hover:bg-gray-800' : ''}
                  onClick={() => setSalutation('先生')}
                >
                  {profileT.salutationMr}
                </Button>
                <Button
                  type="button"
                  variant={salutation === '女士' ? 'default' : 'outline'}
                  className={salutation === '女士' ? 'bg-black text-white hover:bg-gray-800' : ''}
                  onClick={() => setSalutation('女士')}
                >
                  {profileT.salutationMs}
                </Button>
                <Button
                  type="button"
                  variant={salutation === SALUTATION_PREFER_NOT ? 'default' : 'outline'}
                  className={salutation === SALUTATION_PREFER_NOT ? 'bg-black text-white hover:bg-gray-800' : ''}
                  onClick={() => setSalutation(SALUTATION_PREFER_NOT)}
                >
                  {profileT.salutationPreferNot}
                </Button>
              </div>
            </div>

            <div>
              <Label>{profileT.loginAccountId}</Label>
              <Input className="mt-2 h-12 bg-gray-50" value={loginAccountId || '—'} readOnly />
              <p className="mt-1.5 text-xs text-gray-500">{profileT.loginAccountIdHint}</p>
            </div>

            <div>
              <Label>{profileT.fullName}</Label>
              <Input
                className="mt-2 h-12"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={profileT.fullNamePlaceholder}
                readOnly={displayNameLocked}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                {profileT.format('displayNameChangeHint', { remaining: nameChangesRemaining })}
              </p>
            </div>

            <div>
              <Label>{profileT.phone}</Label>
              <Input
                className="mt-2 h-12"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={profileT.phonePlaceholder}
              />
            </div>

            <div>
              <Label>{profileT.email}</Label>
              <Input
                className="mt-2 h-12"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={profileT.emailPlaceholder}
              />
              {emailChanged ? (
                <div className="mt-3 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-950">{profileT.emailChangeHint}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-white"
                    onClick={() => void handleSendEmailOtp()}
                    disabled={sendingOtp || resendCooldown > 0}
                  >
                    {sendingOtp
                      ? profileT.sendingEmailOtp
                      : resendCooldown > 0
                        ? profileT.format('resendEmailOtpCooldown', { seconds: resendCooldown })
                        : emailOtpSent
                          ? profileT.resendEmailOtp
                          : profileT.sendEmailOtp}
                  </Button>
                  <div>
                    <Label>{profileT.emailOtpLabel}</Label>
                    <div className="mt-2 flex justify-center">
                      <InputOTP maxLength={6} value={emailCode} onChange={setEmailCode}>
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
                  </div>
                </div>
              ) : null}
            </div>

            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            {info ? <p className="text-sm text-green-600">{info}</p> : null}

            <Button className="h-12 w-full bg-black text-white hover:bg-gray-800" onClick={() => void handleSave()} disabled={saving}>
              {saving ? profileT.saving : profileT.saveChanges}
            </Button>

            <div className="space-y-4 border-t pt-8">
              <div>
                <h2 className="text-lg font-medium">{profileT.changePasswordTitle}</h2>
                <p className="mt-1 text-sm text-gray-600">
                  {passwordChangeLocked ? profileT.passwordChangeLockedHint : profileT.changePasswordHint}
                </p>
              </div>

              <div>
                <Label htmlFor="current-password">{profileT.currentPassword}</Label>
                <Input
                  id="current-password"
                  className="mt-2 h-12"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={passwordChangeLocked}
                />
              </div>

              <div>
                <Label htmlFor="new-password">{profileT.newPassword}</Label>
                <Input
                  id="new-password"
                  className="mt-2 h-12"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={passwordChangeLocked}
                />
                <p className="mt-1.5 text-xs text-gray-500">{profileT.passwordRequirements}</p>
              </div>

              <div>
                <Label htmlFor="confirm-new-password">{profileT.confirmNewPassword}</Label>
                <Input
                  id="confirm-new-password"
                  className="mt-2 h-12"
                  type="password"
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  disabled={passwordChangeLocked}
                />
              </div>

              {passwordError ? <p className="text-sm text-red-500">{passwordError}</p> : null}
              {passwordInfo ? <p className="text-sm text-green-600">{passwordInfo}</p> : null}

              <Button
                type="button"
                variant="outline"
                className="h-12 w-full"
                onClick={() => void handleChangePassword()}
                disabled={
                  passwordChangeLocked ||
                  updatingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmNewPassword
                }
              >
                {updatingPassword ? profileT.updatingPassword : profileT.updatePassword}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
