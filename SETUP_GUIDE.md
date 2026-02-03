# Quick Setup Guide - Single Active Session System

## 🚀 Setup in 5 Steps

### Step 1: Run SQL Migration

1. Open Supabase Dashboard → SQL Editor
2. Open the file: `scripts/012_create_session_system.sql`
3. Copy the entire content
4. Paste into SQL Editor
5. Click "Run" button
6. ✅ Verify success: Should see "Success. No rows returned"

### Step 2: Verify Database Setup

Run these verification queries:

```sql
-- Should return table with 10 columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_sessions';

-- Should return 6 indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'user_sessions';

-- Should return 4 RLS policies
SELECT policyname FROM pg_policies 
WHERE tablename = 'user_sessions';

-- Should return 1 trigger
SELECT tgname FROM pg_trigger 
WHERE tgrelid = 'user_sessions'::regclass;
```

### Step 3: Test Basic Functionality

1. Clear browser localStorage
2. Navigate to your app homepage
3. Click "Login" button
4. Enter test credentials
5. ✅ Should redirect to `/blogs`
6. ✅ Check localStorage: `session_token` should exist
7. ✅ Check database: One active session record

```sql
-- View your active session
SELECT * FROM user_sessions WHERE status = 'active';
```

### Step 4: Test Single Active Session

Open two different browsers (Chrome & Firefox):

**Browser 1 (Chrome):**
1. Log in with test account
2. Navigate to `/blogs`
3. ✅ Session active

**Browser 2 (Firefox):**
1. Log in with same test account
2. ✅ Should redirect to `/blogs`

**Back to Browser 1 (Chrome):**
- ✅ Should automatically log out within 2-3 seconds
- ✅ Alert: "Your session was terminated on another device"
- ✅ Redirected to homepage

Verify in database:
```sql
-- Should show only ONE active session
SELECT status, COUNT(*) 
FROM user_sessions 
WHERE user_id = 'your-test-user-id'
GROUP BY status;
```

### Step 5: Test Idle Timeout

1. Log in and navigate to `/blogs`
2. Don't touch mouse/keyboard for 18 minutes
3. ✅ Warning appears: "You will be logged out in 2 minutes"
4. Option A: Click "I'm still here" → Warning dismissed
5. Option B: Wait 2 more minutes → Automatic logout

## 🧪 Quick Tests

### Test 1: Login & Session Creation
```bash
# Expected: session_token in localStorage
localStorage.getItem('session_token')

# Expected: One active session in DB
SELECT * FROM user_sessions WHERE status = 'active';
```

### Test 2: Activity Tracking
```bash
# Move mouse, then check DB after 30 seconds
SELECT last_activity_at FROM user_sessions 
WHERE session_token = 'YOUR_TOKEN';

# Should be updated to recent timestamp
```

### Test 3: Logout
```bash
# Click logout button
# Expected: Session status = 'terminated'
SELECT status FROM user_sessions 
WHERE session_token = 'YOUR_TOKEN';
```

### Test 4: Device Switch
```bash
# Device 1: Active
# Device 2: Login → Device 1 logged out
# Expected: Only 1 active session
SELECT COUNT(*) FROM user_sessions 
WHERE user_id = 'USER_ID' AND status = 'active';
```

## ⚠️ Troubleshooting

### Issue: SQL migration fails with "policy already exists"

**Fix:**
```sql
-- Drop existing policies first
DROP POLICY IF EXISTS user_sessions_select_own ON user_sessions;
DROP POLICY IF EXISTS user_sessions_insert_own ON user_sessions;
DROP POLICY IF EXISTS user_sessions_update_own_active ON user_sessions;
DROP POLICY IF EXISTS user_sessions_service_all ON user_sessions;

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS terminate_previous_sessions_trigger ON user_sessions;
DROP FUNCTION IF EXISTS terminate_previous_sessions();

-- Then run the migration script
```

### Issue: "Session creation failed"

**Check RLS policies:**
```sql
-- Ensure RLS is enabled
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Check if policies exist
SELECT * FROM pg_policies WHERE tablename = 'user_sessions';
```

### Issue: Realtime not working

**Enable Realtime in Supabase:**
1. Dashboard → Settings → API
2. Enable Realtime
3. Enable for `user_sessions` table
4. Save changes

### Issue: Idle timeout not triggering

**Check SessionValidator is mounted:**
```typescript
// In browser console
console.log(document.querySelector('[class*="SessionValidator"]'))
// Should not be null
```

## 📋 Quick Checklist

- [ ] SQL migration completed
- [ ] 6 indexes created
- [ ] 4 RLS policies active
- [ ] 1 trigger function working
- [ ] Login creates session
- [ ] Session token in localStorage
- [ ] Logout terminates session
- [ ] Device switch logs out old device
- [ ] Idle warning appears at 18 min
- [ ] Auto-logout at 20 min
- [ ] Activity tracking works

## 🎯 Expected Behavior

| Action | Expected Result |
|--------|----------------|
| User logs in | Session created, token stored, redirect to /blogs |
| User active | `last_activity_at` updated every 30s |
| User idle 18 min | Warning notification appears |
| User idle 20 min | Automatic logout, session expired |
| New device login | Old device logged out instantly |
| User clicks logout | Session terminated, redirected home |
| Multiple tabs | Share same session (same browser) |
| Different browsers | Separate sessions (new login terminates old) |

## 🔒 Security Verification

```sql
-- Test 1: Users cannot see others' sessions
-- Switch to a different user and run:
SELECT * FROM user_sessions WHERE user_id != auth.uid();
-- Expected: 0 rows

-- Test 2: Only ONE active session per user
SELECT user_id, COUNT(*) 
FROM user_sessions 
WHERE status = 'active' 
GROUP BY user_id 
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- Test 3: Cannot reactivate terminated session
UPDATE user_sessions 
SET status = 'active' 
WHERE status = 'terminated';
-- Expected: Error (RLS policy blocks)
```

## ✅ System Health Check

Run this query periodically:

```sql
-- Session statistics
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (NOW() - last_activity_at))/60) as avg_idle_minutes
FROM user_sessions
GROUP BY status;
```

Expected output:
- `active`: Some count, avg_idle < 20
- `terminated`: Historical records
- `expired`: Historical records

## 📚 Next Steps

1. ✅ Complete setup
2. Test all scenarios
3. Monitor session metrics
4. Set up database cleanup cron job
5. Deploy to production

## 🆘 Need Help?

1. Check `SESSION_SYSTEM_README.md` for detailed documentation
2. Review browser console for errors
3. Check Supabase logs (Dashboard → Logs)
4. Verify database queries manually

---

**Setup Time:** ~10 minutes  
**Difficulty:** Easy  
**Prerequisites:** Supabase project with auth setup
