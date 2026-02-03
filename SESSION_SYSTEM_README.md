# Single Active Session System

## Overview

This system enforces **ONE active session per user** across all devices. When a user logs in on a new device, their previous session is automatically terminated. The system includes idle timeout (20 minutes), realtime monitoring, and database-enforced security.

---

## 🎯 Key Features

✅ **Single Active Session** - Only one device can be logged in at a time  
✅ **Automatic Device Switching** - New login terminates previous session  
✅ **20-Minute Idle Timeout** - Automatic logout after inactivity  
✅ **Idle Warning** - Alert 2 minutes before timeout  
✅ **Realtime Monitoring** - Instant detection of session termination  
✅ **Database-Enforced Security** - Unique constraint prevents multiple active sessions  
✅ **Row Level Security (RLS)** - Users can only access their own sessions  
✅ **Session Token Management** - Secure token generation and storage  
✅ **Conflict Notifications** - Users informed when logged out elsewhere  

---

## 📋 Database Setup

### Step 1: Run SQL Migration

Execute the SQL script in your Supabase SQL Editor:

**File:** `scripts/012_create_session_system.sql`

This creates:
- `user_sessions` table with proper schema
- 6 performance indexes (including unique constraint)
- Row Level Security (RLS) policies
- Helper functions (terminate, expire, cleanup)
- Trigger for automatic session termination

### Step 2: Verify Setup

Run these queries to verify:

```sql
-- Check table structure
\d user_sessions

-- Check indexes
SELECT * FROM pg_indexes WHERE tablename = 'user_sessions';

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'user_sessions';

-- Check trigger
SELECT * FROM pg_trigger WHERE tgname = 'terminate_previous_sessions_trigger';
```

---

## 🏗️ Architecture

### Database Schema

```sql
user_sessions
├── id (uuid, PK)
├── user_id (uuid, FK → auth.users)
├── session_token (text, unique)
├── status (text: active | terminated | expired)
├── created_at (timestamptz)
├── last_activity_at (timestamptz)
├── terminated_at (timestamptz)
├── ip_address (text)
├── user_agent (text)
└── device_info (jsonb)
```

### Unique Constraint

```sql
CREATE UNIQUE INDEX idx_user_sessions_one_active_per_user
ON user_sessions (user_id)
WHERE status = 'active';
```

This **database-level constraint** ensures only ONE active session exists per user.

---

## 🔐 Security Model

### Row Level Security (RLS)

1. **View Own Sessions**
   - Users can SELECT their own sessions only

2. **Insert Own Sessions**
   - Users can create sessions for themselves only

3. **Update Own Active Sessions**
   - Users can update their active sessions only
   - Cannot change status to active (prevents reactivation)

4. **Service Role Bypass**
   - Service role can manage all sessions for admin operations

### Session States

| State | Description | Transition |
|-------|-------------|------------|
| `active` | Currently valid session | → `terminated` or `expired` |
| `terminated` | Manually logged out or replaced by new login | Final state |
| `expired` | Timed out due to 20-min inactivity | Final state |

---

## 💻 Implementation Components

### 1. Session Management Library (`lib/session.ts`)

Core functions:

```typescript
// Token Management
generateSessionToken() // Generate secure random token
storeSessionToken(token) // Save to localStorage
getSessionToken() // Retrieve from localStorage
clearSessionToken() // Remove from localStorage

// Session Lifecycle
createSession(userId, ipAddress) // Create new session (terminates old ones)
getActiveSession(token) // Get session details
validateSession(token) // Check if session is valid
updateSessionActivity(token) // Refresh last_activity_at
terminateSession(token) // Mark as terminated (logout)

// Utilities
isSessionExpired(lastActivity) // Check if > 20 minutes
getDeviceInfo(userAgent) // Parse device details
subscribeToSessionChanges(token, callback) // Realtime monitoring
```

### 2. Session Validator (`components/session-validator.tsx`)

Background component that:
- Tracks user activity (mouse, keyboard, touch, scroll, click)
- Updates database activity every 30 seconds (debounced)
- Validates session every 60 seconds
- Shows idle warning 2 minutes before timeout
- Listens for realtime session termination
- Forces logout when session becomes invalid

### 3. Login Flow (`components/login-dialog.tsx`)

Enhanced login process:
1. Authenticate with Supabase Auth
2. Create new session → trigger terminates previous sessions
3. Show conflict warning if previous session existed
4. Store session token locally
5. Redirect to `/blogs`

### 4. Logout Flow (`components/logout-button.tsx`)

Clean logout process:
1. Get current session token
2. Terminate session in database (status → `terminated`)
3. Sign out from Supabase Auth
4. Clear local session token
5. Redirect to home

### 5. Root Layout (`app/layout.tsx`)

Includes `<SessionValidator />` component globally for automatic monitoring.

---

## 🔄 Session Lifecycle

### Login Flow

```
User enters credentials
        ↓
Supabase Auth (signInWithPassword)
        ↓
createSession(userId) → INSERT INTO user_sessions
        ↓
Trigger: terminate_previous_sessions_trigger()
        ↓
All previous active sessions → status = 'terminated'
        ↓
New session becomes active
        ↓
Store token in localStorage
        ↓
Redirect to /blogs
```

### Activity Tracking

```
User moves mouse / types / clicks / scrolls
        ↓
Activity event detected (debounced to 30s)
        ↓
updateSessionActivity(token)
        ↓
UPDATE user_sessions SET last_activity_at = NOW()
        ↓
Reset idle warning timer (18 minutes)
```

### Idle Timeout

```
No activity for 18 minutes
        ↓
Show idle warning notification
        ↓
User clicks "I'm still here" → Reset timer
        OR
        ↓
No activity for 20 minutes total
        ↓
validateSession() detects expired session
        ↓
UPDATE user_sessions SET status = 'expired'
        ↓
Force logout → Redirect to home
```

### Device Switching

```
Device A: User logged in (session_token_A active)
        ↓
Device B: User logs in
        ↓
createSession(userId) → session_token_B
        ↓
Trigger fires on INSERT
        ↓
session_token_A → status = 'terminated'
        ↓
Device A: Realtime subscription detects change
        ↓
Force logout on Device A
        ↓
Alert: "Your session was terminated on another device"
```

### Logout Flow

```
User clicks "Logout" button
        ↓
Get session token from localStorage
        ↓
terminateSession(token)
        ↓
UPDATE user_sessions SET status = 'terminated'
        ↓
supabase.auth.signOut()
        ↓
Clear localStorage
        ↓
Redirect to home
```

---

## 🧪 Testing Checklist

### Basic Functionality
- [ ] User can log in successfully
- [ ] Session token stored in localStorage
- [ ] Session record created in `user_sessions` table
- [ ] User redirected to `/blogs` after login
- [ ] Logout clears session and redirects to home

### Single Active Session
- [ ] Device 1: Log in → Session active
- [ ] Device 2: Log in → Device 1 automatically logged out
- [ ] Device 1: See "Your session was terminated..." message
- [ ] Database: Only ONE active session per user

### Idle Timeout
- [ ] Idle for 18 minutes → Warning appears
- [ ] Click "I'm still here" → Warning dismissed, timer reset
- [ ] Idle for 20 minutes → Automatic logout
- [ ] Database: Session status = `expired`

### Activity Tracking
- [ ] Mouse movement updates `last_activity_at`
- [ ] Keyboard typing updates `last_activity_at`
- [ ] Touch events update `last_activity_at`
- [ ] Debounced to prevent excessive DB writes

### Realtime Monitoring
- [ ] Device 1: Logged in
- [ ] Device 2: Log in
- [ ] Device 1: Instantly logged out (within 2-3 seconds)
- [ ] No manual refresh required

### Security
- [ ] Cannot view other users' sessions
- [ ] Cannot update other users' sessions
- [ ] Cannot reactivate terminated sessions
- [ ] RLS policies enforced

### Edge Cases
- [ ] Multiple tabs same browser → Share session
- [ ] Network disconnection → Session remains valid
- [ ] Browser refresh → Session restored
- [ ] Direct URL access to `/blogs` → Redirect if not authenticated

---

## 🐛 Troubleshooting

### Issue: "Session creation failed"

**Cause:** Database connection error or RLS policy blocking insert

**Solution:**
```sql
-- Check if user_sessions table exists
SELECT * FROM user_sessions LIMIT 1;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'user_sessions';

-- Verify user can insert
INSERT INTO user_sessions (user_id, session_token, status)
VALUES (auth.uid(), 'test-token', 'active');
```

### Issue: "Session not updating activity"

**Cause:** RLS policy blocking updates or wrong session token

**Solution:**
```typescript
// Check token in localStorage
const token = localStorage.getItem('session_token')
console.log('Current token:', token)

// Verify session exists
const { data } = await supabase
  .from('user_sessions')
  .select('*')
  .eq('session_token', token)
console.log('Session:', data)
```

### Issue: "Device not logged out on new login"

**Cause:** Trigger not firing or unique constraint not enforced

**Solution:**
```sql
-- Check trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'terminate_previous_sessions_trigger';

-- Check unique index
SELECT * FROM pg_indexes 
WHERE indexname = 'idx_user_sessions_one_active_per_user';

-- Manually test trigger
INSERT INTO user_sessions (user_id, session_token, status)
VALUES ('same-user-id', 'new-token', 'active');

-- Previous active session should be terminated
SELECT * FROM user_sessions WHERE user_id = 'same-user-id';
```

### Issue: "Idle warning not appearing"

**Cause:** Event listeners not attached or timer cleared

**Solution:**
```typescript
// Check if SessionValidator is mounted
console.log('SessionValidator mounted')

// Verify event listeners
window.addEventListener('mousemove', () => console.log('Activity detected'))

// Check timer is running
setTimeout(() => console.log('Timer works'), 1000)
```

### Issue: "Realtime subscription not working"

**Cause:** Supabase Realtime not enabled or channel not subscribed

**Solution:**
1. Enable Realtime in Supabase Dashboard → Settings → API
2. Enable Realtime for `user_sessions` table
3. Verify subscription:
```typescript
const channel = supabase.channel('test')
console.log('Channel state:', channel.state)
```

---

## 📊 Database Maintenance

### Cleanup Old Sessions

Run periodically (e.g., weekly cron job):

```sql
-- Clean up sessions older than 30 days
SELECT cleanup_old_sessions(30);
```

### Monitor Active Sessions

```sql
-- Count active sessions per user
SELECT user_id, COUNT(*) as active_count
FROM user_sessions
WHERE status = 'active'
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Should return 0 rows (unique constraint enforced)
```

### Expire Idle Sessions

Run every 5 minutes via cron:

```sql
-- Expire sessions idle > 20 minutes
SELECT expire_idle_sessions();
```

Or create a pg_cron job:

```sql
SELECT cron.schedule(
  'expire-idle-sessions',
  '*/5 * * * *', -- Every 5 minutes
  $$SELECT expire_idle_sessions()$$
);
```

---

## 🚀 Deployment Notes

### Environment Variables

No additional environment variables required. Uses existing Supabase config.

### Database Migration

1. Run `scripts/012_create_session_system.sql` in Supabase SQL Editor
2. Verify all indexes, policies, and triggers created
3. Test with a dummy user account

### Monitoring

Track these metrics:
- Active sessions count (should never exceed user count)
- Session creation rate
- Session termination rate
- Idle timeout frequency
- Average session duration

### Performance

The system is optimized for performance:
- 6 database indexes for fast queries
- Debounced activity updates (30s max)
- Periodic validation (60s interval)
- Efficient RLS policies
- Realtime subscription batching

---

## 📝 Summary

This single active session system provides:

1. **Security** - Database-enforced constraints, RLS policies
2. **User Experience** - Automatic device switching, conflict messages
3. **Reliability** - Idle timeout, realtime monitoring, activity tracking
4. **Performance** - Optimized queries, debounced updates, indexed fields
5. **Maintainability** - Helper functions, automated cleanup, comprehensive logging

The system is production-ready and follows best practices for session management in modern web applications.

---

## 🔗 Related Files

- `scripts/012_create_session_system.sql` - Database migration
- `lib/session.ts` - Session management library
- `components/session-validator.tsx` - Background validation
- `components/login-dialog.tsx` - Login flow with session creation
- `components/logout-button.tsx` - Logout flow with session termination
- `app/layout.tsx` - Root layout with SessionValidator

---

## 📞 Support

For issues or questions:
1. Check the Troubleshooting section above
2. Verify database setup with test queries
3. Check browser console for error messages
4. Review Supabase logs in Dashboard → Logs

---

**Last Updated:** 2025-01-XX  
**Version:** 1.0.0  
**Status:** Production Ready ✅
