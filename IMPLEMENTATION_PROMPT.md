
#Prompt to CombinedMax
# Single Active Session System - Implementation Prompt

Use this prompt with AI assistants (Claude, ChatGPT, etc.) to implement a single active session system in your new project.

---

## 🎯 PROMPT START

I need you to implement a **Single Active Session System** for my web application. This system should ensure that only ONE device/browser can be logged into a user's account at any given time. When a user logs in from a new device, all previous sessions should be automatically terminated.

### **Project Context**
- **Framework**: [Next.js 14 / Your Framework]
- **Database**: [Supabase / Your Database]
- **Authentication**: [Supabase Auth / Your Auth System]
- **Language**: TypeScript

### **Requirements**

#### **1. Database Schema**
Create a `user_sessions` table with the following structure:
- `id`: Primary key (UUID)
- `user_id`: Foreign key to users table
- `session_id`: Unique session identifier (TEXT, UNIQUE)
- `status`: Session status ('active' or 'revoked')
- `device_info`: JSON metadata (browser, OS, device type, isMobile)
- `ip_address`: User's IP address
- `user_agent`: Browser user agent string
- `created_at`: Session creation timestamp
- `last_activity_at`: Last activity timestamp (updated by heartbeat)
- `revoked_at`: When session was revoked (null if active)

**Add indexes for:**
- Fast lookup by `user_id` and `status`
- Fast lookup by `session_id`
- Cleanup queries on `created_at`

**Enable Row Level Security (RLS):**
- Users can only view/modify their own sessions

**Create PostgreSQL functions:**
1. `revoke_other_sessions(user_id, current_session_id)` - Revokes all sessions except the current one
2. `is_session_valid(user_id, session_id)` - Checks if session is active
3. `update_session_activity(session_id)` - Updates last_activity_at timestamp
4. `get_active_session(user_id)` - Returns current active session
5. `cleanup_old_sessions(days_old)` - Removes old revoked sessions

#### **2. TypeScript Types**
Create type definitions for:
- `UserSession` interface
- `DeviceInfo` interface
- `SessionValidationResult` interface
- `CreateSessionParams` interface
- `SessionStatus` interface

#### **3. Server-Side Session Manager**
Create a session manager module with these functions:

**Core Functions:**
- `createUserSession(params)` - Creates new session and revokes all others
- `validateSession(userId, sessionId)` - Validates if session is still active
- `revokeSession(userId, sessionId)` - Revokes a specific session
- `updateSessionActivity(sessionId)` - Updates last activity timestamp
- `getActiveSession(userId)` - Gets current active session

**Utility Functions:**
- `generateSessionId()` - Generates unique UUID
- `parseDeviceInfo(userAgent)` - Extracts browser, OS, device type from user agent
- `getClientIpAddress(headers)` - Extracts IP from request headers

#### **4. API Endpoints**

**POST `/api/auth/single-session-login`**
- Accept email and password
- Authenticate with auth system
- Generate unique session_id
- Extract device info and IP address
- Create new session in database
- Revoke all other sessions for this user
- Store session_id in HTTP-only cookie
- Return success response

**Cookie Configuration:**
```typescript
{
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
}
```

**POST `/api/auth/heartbeat`**
- Get current authenticated user
- Get session_id from cookie
- Validate session is still active
- If active: Update last_activity_at and return success
- If revoked: Return 401 with revocation message
- If not found: Return 401 with error

**POST `/api/auth/logout`**
- Get current user and session_id
- Revoke session in database
- Sign out from auth system
- Clear session_id cookie
- Clear all auth cookies
- Return success response

#### **5. Client-Side Components**

**Login Dialog Component:**
- Form with email and password inputs
- Calls `/api/auth/single-session-login` endpoint
- Shows loading state
- Displays error/success messages
- Refreshes page on successful login

**Session Monitor Hook (`useSessionMonitor`):**
- Sends heartbeat to `/api/auth/heartbeat` every 30 seconds
- Detects session revocation (401 response with `revoked: true`)
- Automatically logs out user when session is revoked
- Shows alert message: "Your session ended because you logged in from another device"
- Redirects to home page

**Implementation:**
```typescript
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

useEffect(() => {
  const interval = setInterval(async () => {
    const response = await fetch('/api/auth/heartbeat', { method: 'POST' });
    
    if (!response.ok) {
      const data = await response.json();
      if (response.status === 401 && data.revoked) {
        // Session revoked - force logout
        await fetch('/api/auth/logout', { method: 'POST' });
        alert(data.message);
        router.push('/');
      }
    }
  }, HEARTBEAT_INTERVAL);

  return () => clearInterval(interval);
}, []);
```

**Optional: Session Validator Component:**
- Tracks user activity (mouse, keyboard, touch, scroll)
- Updates session activity (debounced to 30 seconds max)
- Validates session periodically (every 60 seconds)
- Forces logout when session becomes invalid

#### **6. Middleware**
Update authentication middleware to:
- Refresh auth tokens on every request
- Ensure auth state is up-to-date
- Run on all routes except static files

### **Flow Requirements**

#### **Login Flow:**
1. User enters credentials
2. Server authenticates user
3. Generate unique session_id
4. Insert new session with status='active'
5. Call `revoke_other_sessions()` to invalidate all other sessions
6. Store session_id in HTTP-only cookie
7. Start heartbeat monitoring

#### **Concurrent Login Detection:**
1. User logs in from Device A → Session A created
2. User logs in from Device B → Session B created, Session A revoked
3. Device A sends heartbeat (within 30 seconds)
4. Server detects Session A is revoked
5. Device A receives 401 response
6. Device A automatically logs out and shows message

#### **Heartbeat Flow:**
1. Every 30 seconds, send POST to `/api/auth/heartbeat`
2. Server validates session is active
3. If active: Update `last_activity_at`, return 200
4. If revoked: Return 401 with message
5. Client handles response and forces logout if needed

### **Security Requirements**
- ✅ Use HTTP-only cookies (prevent XSS)
- ✅ Use secure cookies in production (HTTPS only)
- ✅ Implement Row Level Security on database
- ✅ Log IP addresses and device info
- ✅ Use prepared statements/parameterized queries
- ✅ Validate all inputs
- ✅ Set SameSite cookie attribute (CSRF protection)

### **Performance Considerations**
- ✅ Add database indexes for fast queries
- ✅ Debounce activity updates (max once per 30 seconds)
- ✅ Use database functions for complex operations
- ✅ Cleanup old revoked sessions periodically
- ✅ Optimize heartbeat interval (balance detection speed vs server load)

### **Testing Requirements**
Provide examples to test:
1. Basic login and session creation
2. Concurrent login from two browsers
3. Heartbeat functionality
4. Automatic logout on session revocation
5. Manual logout
6. Session persistence across page refreshes

### **Error Handling**
Handle these scenarios:
- Authentication failure
- Session creation failure
- Database connection errors
- Network errors during heartbeat
- Cookie storage issues
- Concurrent session creation race conditions

### **Files to Create**
1. `scripts/create_user_sessions.sql` - Database schema and functions
2. `lib/types/session.ts` - TypeScript type definitions
3. `lib/session-manager.ts` - Session management logic
4. `app/api/auth/single-session-login/route.ts` - Login endpoint
5. `app/api/auth/heartbeat/route.ts` - Heartbeat endpoint
6. `app/api/auth/logout/route.ts` - Logout endpoint
7. `components/login-dialog.tsx` - Login UI component
8. `hooks/use-session-monitor.ts` - Session monitoring hook

### **Documentation Requirements**
- Comment all complex functions
- Explain the single session enforcement logic
- Document API endpoint request/response formats
- Include setup instructions
- Provide troubleshooting guide

### **Additional Features (Optional)**
- Activity timeout (auto-logout after X minutes of inactivity)
- Session management dashboard (view active devices)
- Email notifications on new device login
- Trust device functionality
- Multiple session support with limit (e.g., max 3 devices)

### **Expected Behavior**
When complete, the system should:
1. ✅ Only allow one active session per user
2. ✅ Automatically logout previous sessions on new login
3. ✅ Detect concurrent logins within 30 seconds
4. ✅ Show clear message when session is revoked
5. ✅ Maintain session across page refreshes
6. ✅ Track user activity and device information
7. ✅ Clean up old sessions periodically

### **Reference Implementation**
Base the implementation on standard session management patterns:
- Session ID stored in HTTP-only cookie
- Session state tracked in database
- Heartbeat mechanism for real-time validation
- Automatic logout on session revocation
- Secure cookie handling

Please implement this system step by step, creating all necessary files and ensuring proper error handling and security measures are in place.

## 🎯 PROMPT END

---

## 📝 Usage Instructions

1. **Copy the prompt above** (from "PROMPT START" to "PROMPT END")
2. **Customize the project context** section with your actual framework and database
3. **Paste into your AI assistant** (Claude, ChatGPT, etc.)
4. **Follow the step-by-step implementation** provided by the AI

## 🔧 Customization Options

### For Different Frameworks

**Express.js + PostgreSQL:**
```
- Framework: Express.js
- Database: PostgreSQL with node-postgres
- Authentication: Passport.js / JWT
- Replace Next.js API routes with Express routes
```

**Django + PostgreSQL:**
```
- Framework: Django
- Database: PostgreSQL with Django ORM
- Authentication: Django Auth
- Use Django views instead of API routes
```

**Laravel + MySQL:**
```
- Framework: Laravel
- Database: MySQL
- Authentication: Laravel Sanctum
- Use Laravel controllers and migrations
```

### For Different Databases

**MongoDB:**
```
- Replace PostgreSQL functions with MongoDB aggregation pipelines
- Use MongoDB transactions for atomic updates
- Adjust schema for document-based storage
```

**Firebase:**
```
- Use Firestore for session storage
- Replace SQL functions with Firebase Cloud Functions
- Use Firebase Security Rules instead of RLS
```

## ⚠️ Important Notes

1. **Adjust Heartbeat Interval**: 30 seconds is a good balance, but adjust based on your needs:
   - Shorter (15s) = Faster detection, more server load
   - Longer (60s) = Less server load, slower detection

2. **Cookie Security**: Always use `httpOnly`, `secure`, and `sameSite` in production

3. **Database Cleanup**: Schedule periodic cleanup of old sessions (cron job or scheduled function)

4. **Error Handling**: Don't let session management failure prevent login - it should be supplementary to auth

5. **Scalability**: This pattern scales well, but consider Redis for very high traffic (millions of users)

## 🎓 Understanding the System

Before implementing, understand these key concepts:

1. **Session ID**: Unique identifier separate from auth token
2. **Status Tracking**: Database tracks if session is 'active' or 'revoked'
3. **Heartbeat Pattern**: Client regularly checks if session is still valid
4. **Automatic Revocation**: New login automatically invalidates old sessions
5. **Cookie Storage**: HTTP-only cookies prevent JavaScript access

## 🚀 Quick Start Checklist

After getting the AI implementation:

- [ ] Create and run database migration
- [ ] Set up type definitions
- [ ] Implement session manager functions
- [ ] Create API endpoints
- [ ] Build frontend components
- [ ] Test basic login
- [ ] Test concurrent login from two browsers
- [ ] Verify heartbeat is running
- [ ] Test automatic logout
- [ ] Add error handling

## 📞 Troubleshooting Tips

If the AI implementation doesn't work:

1. **Provide your actual database schema**: Share your users table structure
2. **Share your auth system**: Explain how authentication currently works
3. **Specify framework version**: Exact versions matter (Next.js 14 vs 13, etc.)
4. **Include error messages**: Share specific errors you encounter
5. **Request step-by-step debugging**: Ask the AI to help troubleshoot specific issues

---

**Prompt Version**: 1.0  
**Last Updated**: February 3, 2026  
**Compatible With**: Next.js, Express, Django, Laravel, and similar frameworks
