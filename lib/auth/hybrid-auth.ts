/**
 * Hybrid Authentication Library
 * 
 * Handles both Telegram Mini App auth and Web (Email/Password) auth
 * with account linking capabilities.
 */

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { VerifiedTelegramUser } from "@/lib/telegram-init-data.server";

export type UserProfile = {
  id: string; // UUID
  telegram_id: bigint | null;
  telegram_username: string | null;
  telegram_first_name: string | null;
  telegram_last_name: string | null;
  email: string | null;
  display_name: string | null;
  account_linked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AccountLinkResult =
  | { success: true; user_id: string; message: string }
  | { success: false; error: string; code: string };

/**
 * Get or create user from Telegram identity
 * Creates auth.users and public.users if they don't exist
 */
export async function getOrCreateTelegramUser(
  telegramUser: VerifiedTelegramUser
): Promise<UserProfile | null> {
  const admin = createSupabaseAdmin();
  if (!admin) {
    console.error("[hybrid-auth] Supabase admin client not available");
    return null;
  }

  // Check if user exists by telegram_id
  const { data: existingUser, error: lookupError } = await admin
    .from("users")
    .select("*")
    .eq("telegram_id", telegramUser.id)
    .single();

  if (lookupError && lookupError.code !== "PGRST116") {
    console.error("[hybrid-auth] Error looking up Telegram user:", lookupError);
    return null;
  }

  if (existingUser) {
    // Update telegram metadata if changed
    const { data: updated } = await admin
      .from("users")
      .update({
        telegram_username: telegramUser.username || existingUser.telegram_username,
        telegram_first_name: telegramUser.first_name || existingUser.telegram_first_name,
        telegram_last_name: telegramUser.last_name || existingUser.telegram_last_name,
        telegram_photo_url: telegramUser.photo_url || existingUser.telegram_photo_url,
        telegram_is_premium: telegramUser.is_premium ?? existingUser.telegram_is_premium,
        telegram_language_code: telegramUser.language_code || existingUser.telegram_language_code,
        updated_at: new Date().toISOString()
      })
      .eq("id", existingUser.id)
      .select()
      .single();

    return (updated as UserProfile) || existingUser;
  }

  // Create new user with Telegram identity
  const syntheticEmail = `telegram_${telegramUser.id}@temp.local`;

  // Create auth.users first
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    email_confirm: true,
    user_metadata: {
      telegram_id: telegramUser.id,
      telegram_username: telegramUser.username,
      telegram_first_name: telegramUser.first_name,
      telegram_last_name: telegramUser.last_name,
      is_synthetic: true,
      provider: "telegram"
    }
  });

  if (authError || !authUser.user) {
    console.error("[hybrid-auth] Error creating auth.users:", authError);
    return null;
  }

  // The trigger should create public.users, but let's update it with Telegram data
  const { data: newUser, error: updateError } = await admin
    .from("users")
    .update({
      telegram_id: telegramUser.id,
      telegram_username: telegramUser.username,
      telegram_first_name: telegramUser.first_name,
      telegram_last_name: telegramUser.last_name,
      telegram_photo_url: telegramUser.photo_url,
      telegram_is_premium: telegramUser.is_premium,
      telegram_language_code: telegramUser.language_code,
      display_name:
        telegramUser.first_name ||
        (telegramUser.username ? `@${telegramUser.username}` : null) ||
        `User ${telegramUser.id}`,
      updated_at: new Date().toISOString()
    })
    .eq("id", authUser.user.id)
    .select()
    .single();

  if (updateError) {
    console.error("[hybrid-auth] Error updating public.users with Telegram data:", updateError);
  }

  return newUser as UserProfile;
}

/**
 * Link Telegram account to existing email/password account
 * Merges data and sets telegram_id on the auth user
 */
export async function linkTelegramToEmailAccount(
  emailUserId: string, // UUID from auth.uid()
  telegramUser: VerifiedTelegramUser
): Promise<AccountLinkResult> {
  const admin = createSupabaseAdmin();
  if (!admin) {
    return {
      success: false,
      error: "Admin client not available",
      code: "ADMIN_UNAVAILABLE"
    };
  }

  // Check if Telegram ID is already linked to another account
  const { data: existingTgUser } = await admin
    .from("users")
    .select("id, email")
    .eq("telegram_id", telegramUser.id)
    .single();

  if (existingTgUser && existingTgUser.id !== emailUserId) {
    return {
      success: false,
      error: "This Telegram account is already linked to another user",
      code: "TELEGRAM_ALREADY_LINKED"
    };
  }

  // Update the email user with Telegram identity
  const { data: linkedUser, error: linkError } = await admin
    .from("users")
    .update({
      telegram_id: telegramUser.id,
      telegram_username: telegramUser.username,
      telegram_first_name: telegramUser.first_name,
      telegram_last_name: telegramUser.last_name,
      telegram_photo_url: telegramUser.photo_url,
      telegram_is_premium: telegramUser.is_premium,
      telegram_language_code: telegramUser.language_code,
      account_linked_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", emailUserId)
    .select()
    .single();

  if (linkError) {
    console.error("[hybrid-auth] Error linking accounts:", linkError);
    return {
      success: false,
      error: "Failed to link accounts",
      code: "LINK_FAILED"
    };
  }

  // Update auth.users metadata
  await admin.auth.admin.updateUserById(emailUserId, {
    user_metadata: {
      telegram_id: telegramUser.id,
      telegram_username: telegramUser.username,
      telegram_linked_at: new Date().toISOString()
    }
  });

  return {
    success: true,
    user_id: linkedUser.id,
    message: "Telegram account successfully linked"
  };
}

/**
 * Link email/password to existing Telegram account
 * Replaces synthetic email with real email
 */
export async function linkEmailToTelegramAccount(
  telegramUserId: string, // UUID from public.users where telegram_id matches
  email: string,
  password: string
): Promise<AccountLinkResult> {
  const admin = createSupabaseAdmin();
  if (!admin) {
    return {
      success: false,
      error: "Admin client not available",
      code: "ADMIN_UNAVAILABLE"
    };
  }

  // Check if email is already taken
  const { data: existingEmailUser } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .neq("id", telegramUserId)
    .single();

  if (existingEmailUser) {
    return {
      success: false,
      error: "This email is already registered to another account",
      code: "EMAIL_ALREADY_EXISTS"
    };
  }

  // Update auth.users with real email and password
  const { error: authUpdateError } = await admin.auth.admin.updateUserById(telegramUserId, {
    email,
    password,
    email_confirm: true,
    user_metadata: {
      email_linked_at: new Date().toISOString()
    }
  });

  if (authUpdateError) {
    console.error("[hybrid-auth] Error updating auth.users:", authUpdateError);
    return {
      success: false,
      error: "Failed to update email and password",
      code: "AUTH_UPDATE_FAILED"
    };
  }

  // Update public.users (trigger should sync email, but let's ensure)
  const { error: userUpdateError } = await admin
    .from("users")
    .update({
      email,
      account_linked_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", telegramUserId);

  if (userUpdateError) {
    console.error("[hybrid-auth] Error updating public.users:", userUpdateError);
    // Auth is updated, so we consider this a success even if metadata update fails
  }

  return {
    success: true,
    user_id: telegramUserId,
    message: "Email and password successfully linked to your Telegram account"
  };
}

/**
 * Get user profile by UUID (works for both auth types)
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const admin = createSupabaseAdmin();
  if (!admin) return null;

  const { data, error } = await admin
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("[hybrid-auth] Error fetching user profile:", error);
    return null;
  }

  return data as UserProfile;
}

/**
 * Get user profile by Telegram ID
 */
export async function getUserProfileByTelegramId(
  telegramId: bigint
): Promise<UserProfile | null> {
  const admin = createSupabaseAdmin();
  if (!admin) return null;

  const { data, error } = await admin
    .from("users")
    .select("*")
    .eq("telegram_id", telegramId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("[hybrid-auth] Error fetching user by telegram_id:", error);
    return null;
  }

  return data as UserProfile;
}

/**
 * Check if accounts can be linked (prevents duplicate linking)
 */
export async function canLinkAccounts(
  userId: string,
  telegramId: bigint
): Promise<{ canLink: boolean; reason?: string }> {
  const admin = createSupabaseAdmin();
  if (!admin) {
    return { canLink: false, reason: "Admin client unavailable" };
  }

  // Check if user already has Telegram linked
  const { data: user } = await admin
    .from("users")
    .select("telegram_id")
    .eq("id", userId)
    .single();

  if (user?.telegram_id) {
    return { canLink: false, reason: "User already has a Telegram account linked" };
  }

  // Check if Telegram ID is linked to another user
  const { data: telegramUser } = await admin
    .from("users")
    .select("id, email")
    .eq("telegram_id", telegramId)
    .single();

  if (telegramUser && telegramUser.id !== userId) {
    return {
      canLink: false,
      reason: "This Telegram account is already linked to another user"
    };
  }

  return { canLink: true };
}
