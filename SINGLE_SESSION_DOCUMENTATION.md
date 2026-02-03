# Single Active Session System - Complete Documentation

## 📋 Overview

This implementation enforces **ONE active session per user** across all devices and browsers, working entirely on **Supabase Free tier** without any Pro features.

### Business Rules Implemented

✅ **Single Active Session**: Only ONE active session per user at any time
✅ **Seamless Login**: New login always succeeds without interruption
✅ **Automatic Revocation**: Previous sessions are immediately terminated when user logs in elsewhere
✅ **Real-time Validation**: Continuous session monitoring with immediate forced logout on revocation
✅ **No Tab-Close Logout**: Sessions persist across tab/browser closes until explicitly logged out or replaced

---

## 🏗️ Architecture

### Components

1. **Database Layer** (`scripts/004_create_user_sessions.sql`)
   - Session tracking table with RLS policies
   - Helper functions for session management
   - Indexes for performance optimization

2. **Session Manager** (`lib/supabase/session-manager.ts`)
   - Core session lifecycle management
   - Session creation, validation, and revocation
   - Device information parsing

3. **API Endpoints**
   - `/api/auth/single-session-login` - Login with session creation
   - `/api/auth/heartbeat` - Session validation and activity updates
   - `/api/auth/logout` - Session cleanup and logout

4. **Middleware** (`lib/supabase/middleware.ts`)
   - Server-side session validation on every request
   - Automatic logout for revoked sessions

5. **Client-Side** (`hooks/use-session-monitor.ts`)
   - Real-time session monitoring
   - Periodic heartbeat and validation
   - Automatic logout on session revocation

---

## 🗄️ Database Schema

### Table: `user_sessions`

```sql
CREATE TABLE public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    device_info JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);
```

### Key Constraints

- **Unique session_id**: Each session has a unique identifier
- **Status validation**: Only 'active' or 'revoked' allowed
- **Cascade delete**: Sessions deleted when user is deleted
- **Indexed lookups**: Fast queries on user_id + status

### RLS Policies

```sql
-- Users can view their own sessions
CREATE POLICY "Users can view their own sessions"
ON public.user_sessions FOR SELECT
TO authenticated USING (auth.uid() = user_id);

-- Users can create their own sessions
CREATE POLICY "Users can create their own sessions"
ON public.user_sessions FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update their own sessions"
ON public.user_sessions FOR UPDATE
TO authenticated USING (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete their own sessions"
ON public.user_sessions FOR DELETE
TO authenticated USING (auth.uid() = user_id);
```

### Helper Functions

1. **`get_active_session(p_user_id UUID)`**
   - Returns the currently active session for a user
   - Used for checking session status

2. **`revoke_other_sessions(p_user_id UUID, p_current_session_id TEXT)`**
   - Revokes all sessions except the specified one
   - Core function for enforcing single active session

3. **`is_session_valid(p_user_id UUID, p_session_id TEXT)`**
   - Validates if a session is active
   - Returns boolean for quick checks

4. **`update_session_activity(p_session_id TEXT)`**
   - Updates last_activity_at timestamp
   - Used by heartbeat mechanism

5. **`cleanup_old_sessions(p_days_old INTEGER)`**
   - Removes old revoked sessions
   - For database maintenance

---

## 🔄 Flow Diagrams

### Login Flow

```
User enters credentials
         ↓
POST /api/auth/single-session-login
         ↓
Authenticate with Supabase Auth
         ↓
Generate unique session_id
         ↓
Create new session in user_sessions table
         ↓
Call revoke_other_sessions() to terminate old sessions
         ↓
Store session_id in httpOnly cookie
         ↓
Return success + user data
         ↓
Client refreshes and starts session monitoring
```

### Session Validation Flow (Middleware)

```
User makes request
         ↓
Middleware intercepts request
         ↓
Get user from Supabase Auth
         ↓
Is user authenticated? → NO → Continue
         ↓ YES
Get session_id from cookie
         ↓
Has session_id? → NO → Force logout
         ↓ YES
Call is_session_valid(user_id, session_id)
         ↓
Is valid? → NO → Force logout + redirect
         ↓ YES
Allow request to proceed
```

### Heartbeat Flow (Client-Side Monitoring)

```
Component mounts
         ↓
useSessionMonitor() initializes
         ↓
Start intervals:
  - Heartbeat every 30s
  - Validation every 60s
         ↓
POST /api/auth/heartbeat
         ↓
Validate session is still active
         ↓
Is valid? → NO → Force logout + show message
         ↓ YES
Update last_activity_at timestamp
         ↓
Return success
         ↓
Continue monitoring...
```

### Session Replacement Flow

```
User A logged in on Device 1
Session A is active
         ↓
User A logs in on Device 2
         ↓
New Session B created
         ↓
revoke_other_sessions() called
         ↓
Session A status → 'revoked'
Session A revoked_at → NOW()
         ↓
Device 1: Next heartbeat/request
         ↓
Validation fails (session revoked)
         ↓
Device 1: Forced logout
Show: "Your session ended because you logged in from another device."
         ↓
Device 2: Continues working with Session B
```

### Logout Flow

```
User clicks "Log Out"
         ↓
POST /api/auth/logout
         ↓
Revoke session in user_sessions table
         ↓
Call supabase.auth.signOut()
         ↓
Clear session_id cookie
         ↓
Clear all Supabase auth cookies
         ↓
Return success
         ↓
Client redirects to homepage
Stop session monitoring
```

---

## 🔐 Security Features

### 1. Session ID Generation
- Uses UUID v4 for cryptographically secure session IDs
- Stored in httpOnly cookies (not accessible via JavaScript)
- Unique constraint prevents duplication

### 2. Row Level Security (RLS)
- Users can only access their own session records
- All operations validated through Supabase Auth
- No cross-user data leakage possible

### 3. Middleware Protection
- Every protected request validates session
- Automatic logout on invalid/revoked sessions
- No reliance on JWT expiration alone

### 4. Token Refresh Handling
- JWT refresh does NOT create new session
- Session ID remains the same across token refreshes
- Only new login creates new session

### 5. Session Metadata
- Tracks device info, IP address, user agent
- Useful for security audits and debugging
- Helps users identify where they're logged in

---

## 📦 Installation & Setup

### Step 1: Run Database Migration

```bash
# Navigate to your project
cd /Users/tehanisum/Documents/vercel-host-webpage

# Run the SQL script in Supabase Dashboard > SQL Editor
# Or use the Supabase CLI:
supabase db push scripts/004_create_user_sessions.sql
```

### Step 2: Install Dependencies

The project already has all necessary dependencies. If starting fresh:

```bash
npm install uuid
npm install --save-dev @types/uuid
```

### Step 3: Environment Variables

Ensure these are set in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Step 4: Deploy and Test

```bash
# Start development server
npm run dev

# Test login flow
# 1. Create two browser windows (or different browsers)
# 2. Log in with same account in both
# 3. Second login should force logout of first window
```

---

## 🧪 Testing Guide

### Test Case 1: Single Session Enforcement

1. Open Chrome and login
2. Verify you're logged in (check navbar shows email)
3. Open Firefox and login with same account
4. Chrome should automatically logout with message
5. Firefox should remain logged in

**Expected**: ✅ Only one session active at a time

### Test Case 2: Session Persistence

1. Login to the application
2. Close browser tab
3. Open new tab and navigate to site
4. Should still be logged in

**Expected**: ✅ Session persists across tab closes

### Test Case 3: Manual Logout

1. Login to the application
2. Click "Log Out" button
3. Check navbar shows "Log In" / "Sign Up"
4. Try accessing protected routes
5. Should be redirected to homepage

**Expected**: ✅ Clean logout with session cleanup

### Test Case 4: Session Revocation Message

1. Login on Device A
2. Login on Device B with same account
3. On Device A, wait for next heartbeat (max 30s)
4. Should see yellow notification banner

**Expected**: ✅ Clear message shown on forced logout

### Test Case 5: Protected Routes

1. Without logging in, try to access `/protected`
2. Should redirect to homepage
3. Login and try again
4. Should access the protected page

**Expected**: ✅ Proper route protection

---

## 🔧 Configuration

### Heartbeat Intervals

Edit `hooks/use-session-monitor.ts`:

```typescript
const HEARTBEAT_INTERVAL = 30000; // 30 seconds - adjust as needed
const SESSION_CHECK_INTERVAL = 60000; // 60 seconds - adjust as needed
```

**Recommendations**:
- Production: 30s heartbeat, 60s check
- Development: Can increase to reduce API calls
- High-security: 15s heartbeat, 30s check

### Session Cookie Settings

Edit `app/api/auth/single-session-login/route.ts`:

```typescript
cookieStore.set('session_id', sessionId, {
  httpOnly: true,  // Prevents JavaScript access
  secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
  sameSite: 'lax',  // CSRF protection
  maxAge: 60 * 60 * 24 * 7,  // 7 days
  path: '/',
});
```

### Public Routes

Edit `lib/supabase/middleware.ts` to customize which routes skip validation:

```typescript
const isPublicRoute = 
  request.nextUrl.pathname === "/" ||
  request.nextUrl.pathname.startsWith("/blogs") ||
  request.nextUrl.pathname.startsWith("/terms") ||
  // Add your public routes here
  request.nextUrl.pathname.startsWith("/api/auth/single-session-login");
```

---

## 📊 Monitoring & Maintenance

### Database Cleanup

Periodically clean old revoked sessions:

```sql
-- Remove sessions revoked more than 30 days ago
SELECT cleanup_old_sessions(30);

-- Check number of revoked sessions
SELECT COUNT(*) FROM user_sessions WHERE status = 'revoked';
```

### Session Analytics

```sql
-- Active sessions per user
SELECT user_id, COUNT(*) as active_sessions
FROM user_sessions
WHERE status = 'active'
GROUP BY user_id
HAVING COUNT(*) > 1;  -- Should return 0 rows!

-- Recent login activity
SELECT user_id, session_id, created_at, device_info
FROM user_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Session duration statistics
SELECT 
  AVG(EXTRACT(EPOCH FROM (revoked_at - created_at))) / 3600 as avg_session_hours,
  MAX(EXTRACT(EPOCH FROM (revoked_at - created_at))) / 3600 as max_session_hours
FROM user_sessions
WHERE status = 'revoked';
```

---

## 🐛 Troubleshooting

### Issue: User not logged out on second login

**Solution**: Check middleware is running and session validation is working:
```bash
# Check middleware logs
# Verify session_id cookie exists
# Test heartbeat endpoint: GET /api/auth/heartbeat
```

### Issue: Sessions not persisting across page reloads

**Solution**: Check cookie settings:
```typescript
// Ensure httpOnly cookie is set correctly
// Verify Supabase auth cookies are present
// Check browser cookie storage
```

### Issue: "Session not found" errors

**Solution**: Verify database setup:
```sql
-- Check table exists
SELECT * FROM user_sessions LIMIT 1;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'user_sessions';

-- Verify functions exist
SELECT * FROM pg_proc WHERE proname LIKE '%session%';
```

### Issue: Multiple active sessions per user

**Solution**: Check revocation logic:
```sql
-- Manually fix by revoking old sessions
UPDATE user_sessions
SET status = 'revoked', revoked_at = NOW()
WHERE user_id = 'user_id_here'
AND session_id != 'latest_session_id_here';
```

---

## 🚀 Performance Considerations

### Database Indexes
- Already optimized with composite index on (user_id, status)
- session_id has unique constraint (automatic index)
- created_at indexed for cleanup queries

### API Call Optimization
- Heartbeat uses RPC functions (single round-trip)
- Middleware validation cached per request
- Client-side debouncing prevents duplicate calls

### Cookie Storage
- Minimal cookie size (only session_id)
- httpOnly prevents client-side access overhead
- SameSite prevents unnecessary cookie sends

---

## 📚 API Reference

### POST /api/auth/single-session-login

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "user_metadata": {}
  },
  "sessionId": "uuid"
}
```

**Response** (401):
```json
{
  "error": "Authentication failed"
}
```

### POST /api/auth/heartbeat

**Request**: No body (uses cookie)

**Response** (200):
```json
{
  "success": true,
  "message": "Session is active",
  "userId": "uuid",
  "sessionId": "uuid"
}
```

**Response** (401):
```json
{
  "error": "Session invalid",
  "revoked": true,
  "reason": "revoked",
  "message": "Your session ended because you logged in from another device."
}
```

### POST /api/auth/logout

**Request**: No body (uses cookie)

**Response** (200):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 🎯 Key Features Summary

✅ **Supabase Free Tier Compatible**: No Pro features required
✅ **Single Active Session**: Strictly enforced per user
✅ **Seamless New Login**: Never blocked or interrupted
✅ **Automatic Revocation**: Old sessions immediately terminated
✅ **Real-time Monitoring**: Client-side session validation
✅ **Server-side Protection**: Middleware validates every request
✅ **Secure Cookies**: httpOnly, secure, SameSite protection
✅ **Device Tracking**: Metadata for security audits
✅ **Row Level Security**: User data isolation
✅ **Token Refresh Safe**: Doesn't create new sessions
✅ **Tab Close Safe**: Sessions persist until logout
✅ **Clear User Feedback**: Informative revocation messages

---

## 📝 Best Practices

1. **Regular Cleanup**: Run `cleanup_old_sessions()` monthly
2. **Monitor Sessions**: Check for anomalies in session creation
3. **Adjust Intervals**: Tune heartbeat based on your needs
4. **Test Thoroughly**: Verify on multiple devices/browsers
5. **Log Errors**: Keep detailed logs for debugging
6. **Update Dependencies**: Keep Supabase packages current
7. **Secure Cookies**: Always use httpOnly + secure in production
8. **Handle Edge Cases**: Network errors, race conditions
9. **User Communication**: Clear messages on forced logout
10. **Documentation**: Keep this updated with any changes

---

## 🔗 Related Files

- Database: `scripts/004_create_user_sessions.sql`
- Types: `lib/types/session.ts`
- Session Manager: `lib/supabase/session-manager.ts`
- Login API: `app/api/auth/single-session-login/route.ts`
- Heartbeat API: `app/api/auth/heartbeat/route.ts`
- Logout API: `app/api/auth/logout/route.ts`
- Middleware: `lib/supabase/middleware.ts`
- Session Monitor Hook: `hooks/use-session-monitor.ts`
- Session Provider: `components/session-provider.tsx`
- Login Dialog: `components/login-dialog.tsx`
- Navbar: `components/ui/navbar.tsx`

---

## 📞 Support

For issues or questions:
1. Check troubleshooting section above
2. Review Supabase logs in dashboard
3. Check browser console for client-side errors
4. Verify database functions are working
5. Test API endpoints directly

---

**Last Updated**: January 24, 2026
**Version**: 1.0.0
**Author**: AI Products with Tehan
