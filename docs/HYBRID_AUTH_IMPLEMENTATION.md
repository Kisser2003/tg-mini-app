# Hybrid Authentication Implementation Guide

## Overview

This document describes the hybrid authentication system that allows users to access the app through both:
1. **Telegram Mini App** (using Telegram `initData` validation)
2. **Web Landing Page** (using Supabase Auth with email/password)

Both entry points map to the same user account in `auth.users`, preventing duplicate accounts.

---

## Architecture

### Core Principles

1. **Single Source of Truth**: `auth.users.id` (UUID) is the primary key
2. **No Duplicates**: `telegram_id` is unique and nullable in `public.users`
3. **Bidirectional Linking**: Users can link accounts from either direction
4. **Backward Compatible**: Existing Telegram-only users are migrated automatically

### Database Schema

```sql
-- auth.users (Supabase Auth - managed)
-- └── id: uuid (PRIMARY KEY)

-- public.users (our profile table)
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id bigint UNIQUE,  -- Nullable, unique when set
  telegram_username text,
  email text UNIQUE,           -- Synced from auth.users.email
  display_name text,
  account_linked_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);

-- All other tables reference public.users(id)
ALTER TABLE releases ADD COLUMN user_uuid uuid REFERENCES public.users(id);
ALTER TABLE tracks ADD COLUMN user_uuid uuid REFERENCES public.users(id);
-- ... etc
```

---

## Migration Process

### Step 1: Apply SQL Migrations

Run these migrations in order:

```bash
# 1. Create public.users table and helper functions
supabase migration up 20260417140000_hybrid_auth_users_table.sql

# 2. Add user_uuid columns to existing tables
supabase migration up 20260417140001_migrate_existing_tables_to_uuid.sql

# 3. Seed existing Telegram users into auth.users + public.users
supabase migration up 20260417140002_seed_telegram_users_and_migrate.sql

# 4. Update ALL RLS policies for hybrid auth
supabase migration up 20260417140003_update_rls_policies_hybrid_auth.sql
```

### Step 2: Verify Migration

```sql
-- Check migration status
SELECT * FROM public.migration_status;

-- Should show 100% for all tables:
-- table_name         | total_rows | migrated_rows | pending_rows | migration_percent
-- releases           | 150        | 150           | 0            | 100.00
-- tracks             | 300        | 300           | 0            | 100.00
-- transactions       | 50         | 50            | 0            | 100.00
```

### Step 3: Update Application Code

All application code has been updated to use `user_uuid` instead of `telegram_id`/`user_id`.

---

## Authentication Flows

### Flow 1: Telegram Mini App User (New)

```
1. User opens Telegram Mini App
2. Telegram sends initData with user.id
3. Backend validates initData signature
4. Backend calls getOrCreateTelegramUser(telegramUser)
   - If exists: returns existing user
   - If new: creates auth.users + public.users with synthetic email
5. User can access all features
```

### Flow 2: Web User (Email/Password - New)

```
1. User visits web landing page
2. User signs up with email/password
3. Supabase creates auth.users
4. Trigger creates public.users (telegram_id = null)
5. User can access all features
```

### Flow 3: Link Telegram to Email Account

```
1. User logs in via web (has email/password)
2. User opens Telegram Mini App
3. Frontend calls POST /api/auth/link-telegram
   - Sends both: Supabase session token + Telegram initData
4. Backend verifies both authentications
5. Backend calls linkTelegramToEmailAccount()
   - Updates public.users: sets telegram_id
   - Updates auth.users.user_metadata
6. User can now access via BOTH methods with same account
```

### Flow 4: Link Email to Telegram Account

```
1. User logs in via Telegram (Telegram-only account)
2. User wants to add email/password for web access
3. Frontend shows "Link Email" form
4. User enters email + password
5. Frontend calls POST /api/auth/link-email (with Telegram auth)
6. Backend calls linkEmailToTelegramAccount()
   - Updates auth.users: replaces synthetic email with real email
   - Sets password
7. User can now log in via web with email/password
```

---

## API Endpoints

### POST /api/auth/link-telegram
Links Telegram account to existing email account.

**Request:**
```typescript
Headers: {
  "Authorization": "Bearer <supabase_token>",
  "X-Telegram-Init-Data": "<telegram_initData>"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Telegram account successfully linked",
  "user_id": "uuid"
}
```

### POST /api/auth/link-email
Links email/password to existing Telegram account.

**Request:**
```typescript
Headers: {
  "X-Telegram-Init-Data": "<telegram_initData>"
}
Body: {
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Email and password successfully linked",
  "user_id": "uuid"
}
```

### GET /api/auth/profile
Gets current user profile (works for both auth types).

**Request:**
```typescript
Headers: {
  // EITHER Supabase token OR Telegram initData
  "Authorization": "Bearer <supabase_token>",
  // OR
  "X-Telegram-Init-Data": "<telegram_initData>"
}
```

**Response:**
```json
{
  "ok": true,
  "user": {
    "id": "uuid",
    "telegram_id": 123456789,
    "email": "user@example.com",
    "display_name": "John Doe",
    "account_linked_at": "2026-04-17T10:00:00Z"
  },
  "auth_method": "telegram" | "supabase"
}
```

### GET /api/auth/check-link-status
Checks account linking status.

**Response:**
```json
{
  "ok": true,
  "user_id": "uuid",
  "has_telegram": true,
  "has_email": true,
  "is_fully_linked": true,
  "email": "user@example.com",
  "telegram_username": "johndoe"
}
```

---

## RLS Policy Updates

All RLS policies now support **BOTH** authentication methods:

```sql
-- Before (Telegram only)
USING (
  user_id = (current_setting('request.headers')::jsonb->>'x-telegram-user-id')::bigint
)

-- After (Hybrid)
USING (
  user_uuid = public.current_user_uuid()
  -- which returns: auth.uid() OR lookup via x-telegram-user-id
)
```

The `current_user_uuid()` function handles both:
1. Web users: returns `auth.uid()` (from JWT)
2. Telegram users: looks up UUID by `telegram_id` from header

---

## Helper Functions

### For Application Code

```typescript
import { 
  getOrCreateTelegramUser,
  linkTelegramToEmailAccount,
  linkEmailToTelegramAccount,
  getUserProfile,
  getUserProfileByTelegramId,
  canLinkAccounts
} from "@/lib/auth/hybrid-auth";

// Get or create user from Telegram
const user = await getOrCreateTelegramUser(telegramUser);

// Link accounts
const result = await linkTelegramToEmailAccount(emailUserId, telegramUser);

// Get profile
const profile = await getUserProfile(userId);
```

### For Database

```sql
-- Get current user UUID (works for both auth types)
SELECT public.current_user_uuid();

-- Get user UUID by Telegram ID
SELECT public.get_user_id_by_telegram(123456789);

-- Get Telegram ID from UUID (backward compat)
SELECT public.get_telegram_id_from_user_uuid('uuid');

-- Check migration status
SELECT * FROM public.migration_status;

-- Manually re-run migration if needed
SELECT * FROM public.remigrate_all_user_data();
```

---

## Backward Compatibility

### Old Code (Telegram-only)

```typescript
// Still works! Old columns kept for compatibility
const releases = await supabase
  .from('releases')
  .select('*')
  .eq('telegram_id', telegramUserId);
```

### New Code (Hybrid-aware)

```typescript
// Recommended: Use user_uuid
const releases = await supabase
  .from('releases')
  .select('*')
  .eq('user_uuid', userUuid);
```

### Migration Path

1. ✅ Both `user_id`/`telegram_id` AND `user_uuid` columns exist
2. ✅ Data is migrated to `user_uuid`
3. ✅ RLS policies check `user_uuid`
4. ⚠️ Old columns can be removed in future migration (after full app migration)

---

## Security Considerations

### 1. Telegram Signature Validation

- All Telegram requests MUST validate `initData` signature
- Uses HMAC-SHA256 with `TELEGRAM_BOT_TOKEN`
- Replay protection: `auth_date` must be fresh (<24h)

### 2. No Duplicate Linking

- `telegram_id` is UNIQUE in `public.users`
- Before linking: check if Telegram ID already linked to another user
- Before linking: check if email already registered

### 3. Synthetic Emails

- Telegram-only users get `telegram_{id}@temp.local`
- Pattern: `telegram_*@temp.local` is NOT a real email
- Real emails are validated and must be unique

### 4. RLS Enforcement

- ALL tables have RLS enabled
- Users can only access their own data
- Admins checked via `is_admin_request()` function

---

## Testing

### Test Scenario 1: New Telegram User

```bash
# Simulate Telegram user login
curl -X GET http://localhost:3000/api/auth/profile \
  -H "X-Telegram-Init-Data: <valid_initData>"

# Should create user and return profile
```

### Test Scenario 2: Web Signup + Telegram Link

```bash
# 1. Sign up via web
curl -X POST http://localhost:3000/auth/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 2. Get session token from response

# 3. Link Telegram
curl -X POST http://localhost:3000/api/auth/link-telegram \
  -H "Authorization: Bearer <session_token>" \
  -H "X-Telegram-Init-Data: <valid_initData>"

# Should link accounts
```

### Test Scenario 3: Data Migration

```sql
-- Insert test Telegram user (old schema)
INSERT INTO releases (user_id, telegram_id, title, status)
VALUES (123456789, 123456789, 'Test Release', 'draft');

-- Run migration
SELECT * FROM public.remigrate_all_user_data();

-- Verify user_uuid populated
SELECT id, user_id, telegram_id, user_uuid FROM releases;
```

---

## Troubleshooting

### Issue: Migration shows 0% complete

```sql
-- Check if public.users populated
SELECT count(*) FROM public.users WHERE telegram_id IS NOT NULL;

-- If 0, re-run seed migration
-- Then manually run:
SELECT * FROM public.remigrate_all_user_data();
```

### Issue: User can't access data after migration

```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'releases';

-- Check if user_uuid is set
SELECT id, telegram_id, user_uuid FROM releases WHERE telegram_id = 123456789;

-- If user_uuid is NULL, manually update:
UPDATE releases r
SET user_uuid = u.id
FROM public.users u
WHERE r.telegram_id::bigint = u.telegram_id
  AND r.user_uuid IS NULL;
```

### Issue: "Telegram account already linked"

This is expected behavior. A Telegram ID can only be linked to ONE account.

**Solution:**
- If user wants to switch: Unlink from old account first
- Or: Merge accounts (custom business logic required)

---

## Rollback Plan

If something goes wrong:

```sql
-- 1. Old columns still exist, so data is safe
-- 2. Remove new columns:
ALTER TABLE releases DROP COLUMN IF EXISTS user_uuid;
ALTER TABLE tracks DROP COLUMN IF EXISTS user_uuid;
-- etc.

-- 3. Restore old RLS policies (from git history)

-- 4. Drop public.users if needed
DROP TABLE IF EXISTS public.users CASCADE;
```

**Important:** Keep backups before migration!

---

## Future Enhancements

### Phase 2 (After Hybrid Auth Stable)

1. ✅ Remove old `user_id`/`telegram_id` columns from tables
2. ✅ Add OAuth providers (Google, Apple, etc.)
3. ✅ Add 2FA support
4. ✅ Account merging UI (for duplicate accounts)

### Phase 3

1. ✅ Magic link login (passwordless)
2. ✅ Social proof (link multiple Telegram accounts)
3. ✅ Family sharing (multiple users under one payment account)

---

## Questions?

Contact: Development Team
Last Updated: 2026-04-17
