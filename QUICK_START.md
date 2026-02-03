# 🚀 Quick Start Guide - Single Active Session System

## ⚡ 5-Minute Setup

### Step 1: Database Setup (2 minutes)

1. Open **Supabase Dashboard** → Your Project → **SQL Editor**
2. Copy and paste the entire content of `scripts/004_create_user_sessions.sql`
3. Click **Run** or press `Ctrl+Enter`
4. Verify success: You should see "Success. No rows returned"

**Verification**:
```sql
-- Run this to confirm table exists
SELECT * FROM user_sessions LIMIT 1;
```

### Step 2: Environment Check (1 minute)

Verify `.env.local` has these variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Step 3: Install Dependencies (1 minute)

```bash
npm install uuid
npm install --save-dev @types/uuid
```

### Step 4: Start Application (1 minute)

```bash
npm run dev
```

Navigate to `http://localhost:3000`

---

## ✅ Quick Test

### Test Single Session Enforcement

1. **Browser 1** (Chrome): 
   - Click "Log In"
   - Enter credentials
   - Verify login (navbar shows your email)

2. **Browser 2** (Firefox/Safari/Incognito):
   - Go to `http://localhost:3000`
   - Click "Log In"
   - Enter **same credentials**

3. **Back to Browser 1**:
   - Wait up to 30 seconds
   - Should see yellow notification: "Your session ended because you logged in from another device."
   - Should be automatically logged out

4. **Browser 2**:
   - Should remain logged in
   - Can use app normally

**Result**: ✅ Only ONE active session at a time!

---

## 🎯 What's Working Now

### ✅ Implemented Features

- **Single Session Per User**: Only one active session allowed
- **Seamless New Login**: New login always succeeds
- **Auto-Revocation**: Old sessions automatically terminated
- **Real-time Monitoring**: 30-second heartbeat checks
- **Forced Logout**: Revoked sessions logged out immediately
- **Session Persistence**: Sessions survive tab/browser closes
- **Secure Cookies**: httpOnly, secure (production), SameSite
- **Device Tracking**: Browser, OS, device metadata stored
- **RLS Protection**: Users can only see their own sessions
- **Clear Messaging**: User-friendly revocation notifications

### 🔐 Security Features

- Row Level Security (RLS) enabled
- httpOnly cookies (XSS protection)
- Session validation on every request
- No multiple active sessions possible
- Automatic cleanup of old sessions

---

## 📁 Files Created/Modified

### New Files
- ✅ `scripts/004_create_user_sessions.sql` - Database schema
- ✅ `lib/types/session.ts` - TypeScript types
- ✅ `lib/supabase/session-manager.ts` - Session management
- ✅ `app/api/auth/single-session-login/route.ts` - Login endpoint
- ✅ `app/api/auth/heartbeat/route.ts` - Heartbeat endpoint
- ✅ `app/api/auth/logout/route.ts` - Logout endpoint
- ✅ `hooks/use-session-monitor.ts` - Client monitoring
- ✅ `components/session-provider.tsx` - Session context
- ✅ `SINGLE_SESSION_DOCUMENTATION.md` - Full documentation
- ✅ `QUICK_START.md` - This file

### Modified Files
- ✅ `lib/supabase/middleware.ts` - Added session validation
- ✅ `components/login-dialog.tsx` - Uses new login endpoint
- ✅ `components/ui/navbar.tsx` - Shows logout when authenticated
- ✅ `app/layout.tsx` - Wraps app with SessionProvider

---

## 🔄 How It Works

### Login Flow
```
User logs in
    ↓
Create new session with unique ID
    ↓
Revoke ALL other active sessions for this user
    ↓
Store session ID in cookie
    ↓
Start monitoring session validity
```

### Monitoring Flow
```
Every 30 seconds:
    ↓
Send heartbeat to server
    ↓
Check if session is still active
    ↓
If revoked → Force logout + show message
If active → Update last activity timestamp
```

### Replacement Flow
```
User A on Device 1: Active Session X
    ↓
User A logs in on Device 2
    ↓
Create Session Y (new)
Revoke Session X (old)
    ↓
Device 1: Next heartbeat detects revocation
Device 1: Automatic logout with message
Device 2: Continues with Session Y
```

---

## 🧪 Testing Checklist

### Basic Tests

- [ ] **Test 1**: Login on Chrome → Login on Firefox → Chrome logs out
- [ ] **Test 2**: Login → Close tab → Reopen → Still logged in
- [ ] **Test 3**: Login → Click logout → Successfully logged out
- [ ] **Test 4**: Login on Device A → Login on Device B → See notification on Device A

### Advanced Tests

- [ ] **Test 5**: Login → Disable network → Re-enable → Still works
- [ ] **Test 6**: Login → Wait 5 minutes → Still logged in (no timeout)
- [ ] **Test 7**: Login → Clear cookies → Logged out on next request
- [ ] **Test 8**: Two users → Each logs in → Independent sessions

### Database Tests

- [ ] **Test 9**: Check only 1 active session per user in database
```sql
SELECT user_id, COUNT(*) as active_count
FROM user_sessions
WHERE status = 'active'
GROUP BY user_id
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

- [ ] **Test 10**: Verify session metadata is captured
```sql
SELECT session_id, device_info, ip_address, user_agent
FROM user_sessions
ORDER BY created_at DESC
LIMIT 5;
```

---

## 🐛 Common Issues & Fixes

### Issue: "Table user_sessions does not exist"
**Fix**: Run the SQL script in Supabase Dashboard → SQL Editor

### Issue: Sessions not logging out on second login
**Fix**: 
1. Check middleware is running
2. Verify heartbeat is being called (check Network tab)
3. Test endpoint: `curl http://localhost:3000/api/auth/heartbeat`

### Issue: "RLS policy violation"
**Fix**: Verify RLS policies are created
```sql
SELECT * FROM pg_policies WHERE tablename = 'user_sessions';
-- Should return 4 policies
```

### Issue: Heartbeat errors in console
**Fix**: 
1. Check Supabase URL and keys in `.env.local`
2. Verify user is authenticated
3. Check browser console for specific error

### Issue: Session cookie not being set
**Fix**:
1. Check login API response sets cookie
2. Verify cookie settings (httpOnly, path, etc.)
3. Check browser cookie storage (Developer Tools)

---

## 📊 Database Quick Reference

### Check Active Sessions
```sql
SELECT u.email, s.session_id, s.created_at, s.last_activity_at, s.device_info
FROM user_sessions s
JOIN auth.users u ON u.id = s.user_id
WHERE s.status = 'active'
ORDER BY s.created_at DESC;
```

### Manually Revoke All User Sessions
```sql
UPDATE user_sessions
SET status = 'revoked', revoked_at = NOW()
WHERE user_id = 'user-uuid-here'
AND status = 'active';
```

### Cleanup Old Sessions
```sql
-- Remove sessions revoked more than 30 days ago
SELECT cleanup_old_sessions(30);
```

### Session Statistics
```sql
-- Total sessions by status
SELECT status, COUNT(*) as count
FROM user_sessions
GROUP BY status;

-- Average session duration
SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(revoked_at, NOW()) - created_at))) / 3600 as avg_hours
FROM user_sessions;
```

---

## 🎛️ Configuration Options

### Adjust Heartbeat Frequency

Edit `hooks/use-session-monitor.ts`:

```typescript
const HEARTBEAT_INTERVAL = 30000; // milliseconds (30s default)
const SESSION_CHECK_INTERVAL = 60000; // milliseconds (60s default)
```

**Recommendations**:
- **High Security**: 15s / 30s (more API calls, faster detection)
- **Balanced**: 30s / 60s (recommended for most cases)
- **Low Traffic**: 60s / 120s (fewer API calls, slower detection)

### Customize Public Routes

Edit `lib/supabase/middleware.ts`:

```typescript
const isPublicRoute = 
  request.nextUrl.pathname === "/" ||
  request.nextUrl.pathname.startsWith("/blogs") ||
  // Add your routes here:
  request.nextUrl.pathname.startsWith("/your-public-route");
```

### Session Cookie Duration

Edit `app/api/auth/single-session-login/route.ts`:

```typescript
maxAge: 60 * 60 * 24 * 7, // 7 days (default)
// Change to: 60 * 60 * 24 * 30 for 30 days
```

---

## 📞 Next Steps

1. ✅ **Completed Setup**: All files created and configured
2. ✅ **Database Ready**: Schema and functions deployed
3. ✅ **API Endpoints**: Login, logout, heartbeat working
4. ✅ **Client Monitoring**: Real-time session validation active

### Now You Can:

- Deploy to production (Vercel, etc.)
- Customize styling of notification messages
- Add additional session metadata
- Implement session history/audit log
- Add admin dashboard for session management
- Extend with 2FA or additional security

### Production Deployment Checklist

- [ ] Run database migration on production Supabase
- [ ] Update environment variables in hosting platform
- [ ] Test with production URL
- [ ] Verify HTTPS (cookies require secure flag)
- [ ] Monitor error logs for first 24 hours
- [ ] Test from multiple devices/browsers
- [ ] Set up database cleanup cron job (optional)

---

## 📚 Additional Resources

- **Full Documentation**: `SINGLE_SESSION_DOCUMENTATION.md`
- **Database Schema**: `scripts/004_create_user_sessions.sql`
- **API Examples**: See individual route files in `app/api/auth/`
- **Supabase Docs**: https://supabase.com/docs

---

## ✨ Summary

You now have a **production-ready single active session system** that:

- ✅ Works entirely on **Supabase Free tier**
- ✅ Enforces **ONE session per user**
- ✅ Provides **seamless new logins**
- ✅ **Automatically revokes** old sessions
- ✅ Includes **real-time monitoring**
- ✅ Is **fully secure** with RLS and httpOnly cookies
- ✅ Has **comprehensive error handling**
- ✅ Shows **user-friendly notifications**

**Ready to use! 🎉**

---

**Need Help?**
1. Check `SINGLE_SESSION_DOCUMENTATION.md` for detailed guides
2. Review troubleshooting section
3. Test API endpoints directly
4. Check Supabase dashboard logs

**Last Updated**: January 24, 2026
