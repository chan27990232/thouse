import type { SupabaseClient } from '@supabase/supabase-js';

export function archivedUsernameForUserId(userId: string): string {
  return (`x-${userId.replace(/-/g, '')}`).slice(0, 32);
}

export function internalEmailForUsername(username: string): string {
  return `${username.trim().toLowerCase()}@thouse.local`;
}

/** 釋放登入帳號與 auth email，保留 profiles 列供稽核。 */
export async function archiveDeactivatedAccount(
  supabase: SupabaseClient,
  userId: string,
  currentUsername: string,
): Promise<void> {
  const archivedUsername = archivedUsernameForUserId(userId);
  const archivedEmail = internalEmailForUsername(archivedUsername);

  const { data: profile } = await supabase
    .from('profiles')
    .select('deactivated_original_username')
    .eq('id', userId)
    .maybeSingle();

  const originalUsername =
    (typeof profile?.deactivated_original_username === 'string'
      ? profile.deactivated_original_username
      : ''
    ).trim() || currentUsername.trim().toLowerCase();

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      deactivated_original_username: originalUsername,
      username: archivedUsername,
      email: archivedEmail,
      is_deactivated: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    email: archivedEmail,
    user_metadata: { username: archivedUsername },
  });

  if (authError) {
    throw new Error(authError.message);
  }
}
