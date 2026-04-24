import type { User } from '@supabase/supabase-js';
import type { UserRole } from '../App';
import { supabase } from './supabase';
import { getPhoneFromMetadata, getRoleFromMetadata, getSalutationFromMetadata, getUsernameFromMetadata } from './auth';

function resolveProfileRole(user: User, fallbackRole?: UserRole): UserRole {
  return getRoleFromMetadata(user.user_metadata) ?? fallbackRole ?? 'tenant';
}

function getFullNameFromMetadata(user: User) {
  const fullName = user.user_metadata?.full_name;
  return typeof fullName === 'string' ? fullName : '';
}

function getUsernameFromUser(user: User) {
  return getUsernameFromMetadata(user.user_metadata);
}

function getSalutationFromUser(user: User) {
  return getSalutationFromMetadata(user.user_metadata);
}

function getPhoneFromUser(user: User) {
  return getPhoneFromMetadata(user.user_metadata);
}

export async function syncProfileForUser(user: User, fallbackRole?: UserRole) {
  const role = resolveProfileRole(user, fallbackRole);

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? '',
      full_name: getFullNameFromMetadata(user),
      username: getUsernameFromUser(user),
      salutation: getSalutationFromUser(user),
      phone: getPhoneFromUser(user),
      role,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'id',
    }
  );

  if (error) {
    console.error('Failed to sync profile:', error.message);
  }
}

export async function findEmailByUsername(username: string) {
  const normalizedUsername = username.trim().toLowerCase();

  const { data, error } = await supabase.rpc('find_auth_email_by_username', {
    input_username: normalizedUsername,
  });

  if (error) {
    throw error;
  }

  return typeof data === 'string' ? data : null;
}

export interface PublicLandlordProfile {
  full_name: string;
  salutation: '' | '先生' | '女士';
  phone: string;
  email: string;
  response_time: string;
  is_verified: boolean;
}

export async function getPublicLandlordProfile(profileId: string) {
  const { data, error } = await supabase.rpc('get_public_landlord_profile', {
    profile_id: profileId,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return (row as PublicLandlordProfile | null) ?? null;
}
