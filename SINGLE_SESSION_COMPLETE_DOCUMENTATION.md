# Single Active Session System - Complete Documentation

## 📋 Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Core Concepts](#core-concepts)
4. [Technical Implementation](#technical-implementation)
5. [File-by-File Explanation](#file-by-file-explanation)
6. [Flow Diagrams](#flow-diagrams)
7. [Security Considerations](#security-considerations)
8. [Testing & Troubleshooting](#testing--troubleshooting)

---

## 🎯 Overview

### What is Single Active Session?
A **Single Active Session System** ensures that only **ONE device/browser** can be logged into a user's account at any given time. When a user logs in from a new device, all previous sessions are automatically terminated.

### Why Did We Build This?
- **Security Enhancement**: Prevents unauthorized access from multiple locations
- **Resource Management**: Reduces server load on Supabase Free tier
- **User Account Protection**: Alerts users when someone else logs into their account
- **Business Logic**: Some applications require exclusive access (e.g., license management, exam systems)

### Real-World Analogy
Think of it like a **hotel room key card**: When you check into a hotel, you get a key card. If you lose it and get a new one, the old key card stops working. Similarly, when you log in from a new device, your old session becomes invalid.

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT SIDE                          │
├─────────────────────────────────────────────────────────────┤
│  1. Login Dialog (login-dialog.tsx)                        │
│  2. Session Monitor (use-session-monitor.ts)               │
│  3. Session Validator (session-validator.tsx)              │
└────────────────┬───────────────────────────┬────────────────┘
                 │                           │
                 ▼                           ▼
┌────────────────────────────────┐ ┌────────────────────────┐
│      API ENDPOINTS             │ │   MIDDLEWARE           │
├────────────────────────────────┤ ├────────────────────────┤
│ /api/auth/single-session-login │ │ middleware.ts          │
│ /api/auth/heartbeat            │ └────────────────────────┘
│ /api/auth/logout               │
└────────────────┬───────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVER LOGIC                             │
├─────────────────────────────────────────────────────────────┤
│  Session Manager (lib/supabase/session-manager.ts)         │
│  - createUserSession()                                      │
│  - validateSession()                                        │
│  - revokeSession()                                          │
│  - updateSessionActivity()                                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                           │
├─────────────────────────────────────────────────────────────┤
│  Supabase PostgreSQL Database                               │
│  - user_sessions table                                      │
│  - Helper functions (SQL)                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 💡 Core Concepts

### 1. **Session ID**
- A **unique identifier** (UUID) generated when a user logs in
- Stored in an **HTTP-only cookie** on the client
- Stored in the **user_sessions table** in the database
- Example: `"550e8400-e29b-41d4-a716-446655440000"`

### 2. **Session Status**
Two possible states:
- **`active`**: Session is currently valid and can be used
- **`revoked`**: Session has been terminated (user logged in elsewhere)

### 3. **Session Lifecycle**

```
┌──────────┐
│  LOGIN   │
└────┬─────┘
     │
     ▼
┌──────────────────────┐
│ CREATE NEW SESSION   │
│ Status: 'active'     │
└────┬─────────────────┘
     │
     ▼
┌──────────────────────┐
│ REVOKE OLD SESSIONS  │
│ Status: 'revoked'    │
└────┬─────────────────┘
     │
     ▼
┌──────────────────────┐
│   USER ACTIVITY      │
│ (Heartbeat updates)  │
└────┬─────────────────┘
     │
     ▼
┌──────────────────────┐
│  LOGOUT / EXPIRE     │
│ Status: 'revoked'    │
└──────────────────────┘
```

### 4. **Heartbeat Mechanism**
- Client sends a **"heartbeat"** every 30 seconds to the server
- Server checks if the session is still valid
- If valid: Updates `last_activity_at` timestamp
- If revoked: Forces logout on client

**Why Heartbeat?**
- Detects when another device logs in (session becomes revoked)
- Keeps session alive during active use
- Enables automatic timeout for inactive sessions

### 5. **Cookie-Based Session Management**
We use HTTP-only cookies because:
- **Security**: Cannot be accessed by JavaScript (prevents XSS attacks)
- **Automatic**: Browser sends cookie with every request
- **Persistent**: Survives page refreshes

---

## 🔧 Technical Implementation

### Technology Stack
- **Frontend**: Next.js 14 (React)
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Session Storage**: PostgreSQL + HTTP-only Cookies
- **Language**: TypeScript

### Data Flow

#### **Login Flow**
```
User enters credentials
       ↓
POST /api/auth/single-session-login
       ↓
1. Authenticate with Supabase Auth
2. Generate unique session_id (UUID)
3. Insert new session into user_sessions table
4. Revoke all other active sessions for this user
5. Store session_id in HTTP-only cookie
6. Return success response
       ↓
User is logged in
Client starts heartbeat monitoring
```

#### **Session Validation Flow**
```
Every 30 seconds (Heartbeat)
       ↓
POST /api/auth/heartbeat
       ↓
1. Get user from Supabase Auth
2. Get session_id from cookie
3. Query database: Is this session still active?
       ↓
   ┌───┴───┐
   │       │
Active   Revoked
   │       │
   ↓       ↓
Update   Force
last     Logout
activity
```

#### **Concurrent Login Flow**
```
User A: Logged in on Device 1 (session_id: AAA)
       │
       ▼
User A: Logs in on Device 2
       │
       ▼
Server creates new session (session_id: BBB)
       │
       ▼
Server revokes session AAA
       │
       ▼
Device 1: Next heartbeat detects revoked session
       │
       ▼
Device 1: Force logout with message
"You have been logged out because you logged in from another device"
```

---

## 📁 File-by-File Explanation

### **1. Database Schema: `scripts/004_create_user_sessions.sql`**

**Purpose**: Creates the database structure for session management

#### Key Components:

##### **Table: `user_sessions`**
```sql
CREATE TABLE public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    session_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    device_info JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);
```

**Column Explanations:**
- `id`: Primary key (auto-generated)
- `user_id`: Links to Supabase auth.users table
- `session_id`: Unique identifier for this session (generated by our code)
- `status`: Either 'active' or 'revoked'
- `device_info`: JSON data about browser/OS/device
- `ip_address`: User's IP address (for security logs)
- `user_agent`: Browser user agent string
- `created_at`: When session was created
- `last_activity_at`: Updated by heartbeat (shows user is active)
- `revoked_at`: When session was revoked (null if still active)

##### **Database Functions:**

**1. `revoke_other_sessions()`**
```sql
CREATE OR REPLACE FUNCTION public.revoke_other_sessions(
    p_user_id UUID,
    p_current_session_id TEXT
)
```
- **What it does**: Finds all active sessions for a user EXCEPT the current one, and marks them as 'revoked'
- **When used**: During login to enforce single session rule
- **Returns**: Number of sessions revoked

**2. `is_session_valid()`**
```sql
CREATE OR REPLACE FUNCTION public.is_session_valid(
    p_user_id UUID,
    p_session_id TEXT
)
```
- **What it does**: Checks if a session exists and is active
- **When used**: During validation and heartbeat
- **Returns**: TRUE or FALSE

**3. `update_session_activity()`**
```sql
CREATE OR REPLACE FUNCTION public.update_session_activity(
    p_session_id TEXT
)
```
- **What it does**: Updates `last_activity_at` timestamp
- **When used**: During heartbeat to show user is still active
- **Returns**: TRUE if updated successfully

**4. `get_active_session()`**
```sql
CREATE OR REPLACE FUNCTION public.get_active_session(p_user_id UUID)
```
- **What it does**: Returns details of the user's current active session
- **When used**: For debugging and admin purposes
- **Returns**: Session details (session_id, timestamps, device info)

**5. `cleanup_old_sessions()`**
```sql
CREATE OR REPLACE FUNCTION public.cleanup_old_sessions(
    p_days_old INTEGER DEFAULT 30
)
```
- **What it does**: Deletes revoked sessions older than X days
- **When used**: Maintenance/cleanup (can be scheduled as cron job)
- **Returns**: Number of sessions deleted

##### **Indexes for Performance:**
```sql
CREATE INDEX idx_user_sessions_user_status 
ON public.user_sessions(user_id, status) 
WHERE status = 'active';
```
- Makes queries faster when checking if user has active session
- Only indexes active sessions (most common query)

##### **Row Level Security (RLS):**
- Ensures users can only see/modify their own sessions
- Prevents Session A from seeing Session B's data
- Four policies: SELECT, INSERT, UPDATE, DELETE (all restricted to own sessions)

---

### **2. Type Definitions: `lib/types/session.ts`**

**Purpose**: TypeScript interfaces for type safety and code completion

#### Key Types:

```typescript
export interface UserSession {
  id: string;
  user_id: string;
  session_id: string;
  status: 'active' | 'revoked';
  device_info: DeviceInfo;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  last_activity_at: string;
  revoked_at?: string;
}
```
- **What it is**: Represents a session record from the database
- **Why needed**: Type safety when working with session data

```typescript
export interface DeviceInfo {
  browser?: string;
  os?: string;
  device?: string;
  isMobile?: boolean;
}
```
- **What it is**: Information about the user's device
- **Example**: `{ browser: 'Chrome', os: 'Windows', device: 'Desktop', isMobile: false }`

```typescript
export interface SessionValidationResult {
  isValid: boolean;
  reason?: 'valid' | 'revoked' | 'not_found' | 'expired';
  message?: string;
}
```
- **What it is**: Result of checking if a session is still valid
- **Why needed**: Provides clear reason for validation failure

---

### **3. Session Manager: `lib/supabase/session-manager.ts`**

**Purpose**: Core business logic for session management (server-side only)

#### Key Functions:

##### **`createUserSession()`**
```typescript
export async function createUserSession(
  params: CreateSessionParams
): Promise<{ success: boolean; sessionId: string; error?: string }>
```

**What it does:**
1. Inserts new session record into `user_sessions` table
2. Calls `revoke_other_sessions()` to invalidate all other sessions
3. Returns success status

**Parameters:**
- `userId`: Supabase user ID
- `sessionId`: Generated UUID
- `deviceInfo`: Browser/OS/device information
- `ipAddress`: User's IP
- `userAgent`: Browser user agent string

**Example Usage:**
```typescript
const result = await createUserSession({
  userId: 'abc-123',
  sessionId: 'xyz-789',
  deviceInfo: { browser: 'Chrome', os: 'Windows' },
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
});
```

##### **`validateSession()`**
```typescript
export async function validateSession(
  userId: string,
  sessionId: string
): Promise<SessionValidationResult>
```

**What it does:**
1. Queries database for session matching userId and sessionId
2. Checks if session exists and is 'active'
3. Returns validation result with reason

**Return Examples:**
```typescript
// Valid session
{ isValid: true, reason: 'valid' }

// Session revoked (logged in elsewhere)
{ 
  isValid: false, 
  reason: 'revoked', 
  message: 'Your session ended because you logged in from another device.' 
}

// Session not found
{ 
  isValid: false, 
  reason: 'not_found', 
  message: 'Session not found' 
}
```

##### **`updateSessionActivity()`**
```typescript
export async function updateSessionActivity(
  sessionId: string
): Promise<boolean>
```

**What it does:**
- Calls SQL function `update_session_activity()`
- Updates `last_activity_at` to current timestamp
- Returns true if successful

**Used by:** Heartbeat endpoint

##### **`revokeSession()`**
```typescript
export async function revokeSession(
  userId: string,
  sessionId: string
): Promise<boolean>
```

**What it does:**
- Updates session status to 'revoked'
- Sets `revoked_at` timestamp
- Returns true if successful

**Used by:** Logout endpoint

##### **Utility Functions:**

**`generateSessionId()`**
```typescript
export function generateSessionId(): string {
  return uuidv4(); // Returns: "550e8400-e29b-41d4-a716-446655440000"
}
```

**`parseDeviceInfo(userAgent)`**
```typescript
export function parseDeviceInfo(userAgent?: string): DeviceInfo
```
- Parses user agent string to extract browser, OS, device type
- Example input: `"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"`
- Example output: `{ browser: 'Chrome', os: 'Windows', device: 'Desktop', isMobile: false }`

**`getClientIpAddress(headers)`**
```typescript
export function getClientIpAddress(headers: Headers): string | undefined
```
- Extracts IP address from request headers
- Checks `x-forwarded-for` and `x-real-ip` headers
- Used for security logging

---

### **4. Login API: `app/api/auth/single-session-login/route.ts`**

**Purpose**: API endpoint for user login with single session enforcement

#### POST `/api/auth/single-session-login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Process Flow:**

**Step 1: Validate Input**
```typescript
if (!email || !password) {
  return NextResponse.json(
    { error: 'Email and password are required' },
    { status: 400 }
  );
}
```

**Step 2: Authenticate with Supabase**
```typescript
const { data: authData, error: authError } = 
  await supabase.auth.signInWithPassword({
    email,
    password,
  });
```
- Uses Supabase's built-in authentication
- Verifies email and password
- Returns user object and auth session

**Step 3: Generate Session ID**
```typescript
const sessionId = generateSessionId(); // UUID v4
```

**Step 4: Extract Device Info**
```typescript
const userAgent = request.headers.get('user-agent') || undefined;
const ipAddress = getClientIpAddress(request.headers);
const deviceInfo = parseDeviceInfo(userAgent);
```

**Step 5: Create Session & Revoke Others**
```typescript
const sessionResult = await createUserSession({
  userId,
  sessionId,
  deviceInfo,
  ipAddress,
  userAgent,
});
```
- Creates new session record
- Automatically revokes all other sessions for this user

**Step 6: Store Session ID in Cookie**
```typescript
cookieStore.set('session_id', sessionId, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
});
```
- **httpOnly**: JavaScript cannot access (security)
- **secure**: Only sent over HTTPS in production
- **sameSite**: CSRF protection
- **maxAge**: Cookie expires in 7 days

**Step 7: Return Success Response**
```typescript
return NextResponse.json({
  success: true,
  message: 'Login successful',
  user: {
    id: authData.user.id,
    email: authData.user.email,
    user_metadata: authData.user.user_metadata,
  },
  sessionId,
});
```

**Success Response Example:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "abc-123",
    "email": "user@example.com",
    "user_metadata": { "full_name": "John Doe" }
  },
  "sessionId": "xyz-789"
}
```

**Error Response Example:**
```json
{
  "error": "Invalid login credentials"
}
```

---

### **5. Heartbeat API: `app/api/auth/heartbeat/route.ts`**

**Purpose**: Validates session is still active and updates last activity time

#### POST `/api/auth/heartbeat`

**Process Flow:**

**Step 1: Get Current User**
```typescript
const { data: { user }, error: authError } = 
  await supabase.auth.getUser();
```

**Step 2: Get Session ID from Cookie**
```typescript
const cookieStore = await cookies();
const sessionId = cookieStore.get('session_id')?.value;
```

**Step 3: Validate Session**
```typescript
const validationResult = await validateSession(user.id, sessionId);

if (!validationResult.isValid) {
  return NextResponse.json({
    error: 'Session invalid',
    revoked: true,
    reason: validationResult.reason,
    message: validationResult.message
  }, { status: 401 });
}
```

**Step 4: Update Activity Timestamp**
```typescript
const activityUpdated = await updateSessionActivity(sessionId);
```

**Success Response:**
```json
{
  "success": true,
  "message": "Session is active",
  "userId": "abc-123",
  "sessionId": "xyz-789"
}
```

**Revoked Session Response:**
```json
{
  "error": "Session invalid",
  "revoked": true,
  "reason": "revoked",
  "message": "Your session ended because you logged in from another device."
}
```

---

### **6. Logout API: `app/api/auth/logout/route.ts`**

**Purpose**: Handles user logout and session cleanup

#### POST `/api/auth/logout`

**Process Flow:**

**Step 1: Get Current User & Session ID**
```typescript
const { data: { user } } = await supabase.auth.getUser();
const sessionId = cookieStore.get('session_id')?.value;
```

**Step 2: Revoke Session in Database**
```typescript
if (user && sessionId) {
  await revokeSession(user.id, sessionId);
}
```

**Step 3: Sign Out from Supabase Auth**
```typescript
await supabase.auth.signOut();
```

**Step 4: Clear All Cookies**
```typescript
cookieStore.delete('session_id');

// Clear Supabase auth cookies
allCookies.forEach((cookie) => {
  if (cookie.name.startsWith('sb-')) {
    cookieStore.delete(cookie.name);
  }
});
```

**Success Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### **7. Login Component: `components/login-dialog.tsx`**

**Purpose**: UI component for user login

**Key Features:**
- Form with email and password inputs
- Calls `/api/auth/single-session-login` endpoint
- Shows loading state during authentication
- Displays error messages
- Shows success message and redirects on successful login

**Important Code:**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  const response = await fetch('/api/auth/single-session-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    setError(data.error || "Login failed");
    return;
  }

  // Success - refresh page to update auth state
  router.refresh();
};
```

---

### **8. Session Monitor Hook: `hooks/use-session-monitor.ts`**

**Purpose**: Client-side hook that monitors session validity using heartbeat

**Key Features:**
- Runs automatically when user is logged in
- Sends heartbeat every 30 seconds
- Detects session revocation
- Forces logout when session is invalid

**How it Works:**

```typescript
export function useSessionMonitor() {
  const router = useRouter();

  // Send heartbeat every 30 seconds
  const sendHeartbeat = async () => {
    const response = await fetch('/api/auth/heartbeat', {
      method: 'POST'
    });

    if (!response.ok) {
      const data = await response.json();
      
      // Session was revoked - force logout
      if (response.status === 401 && data.revoked) {
        handleSessionRevoked(data.message);
      }
    }
  };

  // Handle session revocation
  const handleSessionRevoked = (message) => {
    // Clear intervals
    clearInterval(heartbeatIntervalRef.current);
    
    // Logout and redirect
    fetch('/api/auth/logout', { method: 'POST' });
    router.push(`/?session_revoked=true&message=${message}`);
  };

  // Setup intervals
  useEffect(() => {
    heartbeatIntervalRef.current = setInterval(
      sendHeartbeat, 
      30000 // 30 seconds
    );

    return () => clearInterval(heartbeatIntervalRef.current);
  }, []);
}
```

**Usage in Components:**
```typescript
function ProtectedPage() {
  useSessionMonitor(); // Just call the hook
  
  return <div>Protected content</div>;
}
```

---

### **9. Session Validator Component: `components/session-validator.tsx`**

**Purpose**: Alternative client-side session validation with activity tracking

**Key Features:**
- Tracks user activity (mouse, keyboard, touch, scroll)
- Updates session activity in database (debounced)
- Validates session periodically
- Shows idle warning before timeout
- Forces logout when session is invalid

**Activity Tracking:**
```typescript
const ACTIVITY_EVENTS = ['mousemove', 'keypress', 'touchstart', 'scroll', 'click'];

const updateActivity = async () => {
  lastActivityRef.current = Date.now();
  
  // Debounced update to database (max once per 30 seconds)
  await updateSessionActivity(sessionToken);
};

// Listen to activity events
ACTIVITY_EVENTS.forEach(event => {
  window.addEventListener(event, updateActivity);
});
```

**Session Validation:**
```typescript
const validateCurrentSession = async () => {
  const result = await validateSession(sessionToken);
  
  if (!result.valid) {
    await forceLogout(result.reason || 'Session invalid');
  }
};

// Validate every 60 seconds
setInterval(validateCurrentSession, 60000);
```

---

### **10. Middleware: `middleware.ts`**

**Purpose**: Runs on every request to update Supabase session

```typescript
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}
```

**What it does:**
- Intercepts all requests
- Refreshes Supabase auth tokens if needed
- Ensures auth state is up-to-date
- Runs BEFORE page components render

**Config:**
```typescript
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```
- Runs on all routes EXCEPT static files and images
- Improves performance by skipping middleware for assets

---

## 📊 Flow Diagrams

### Complete Login to Logout Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER LOGIN FLOW                          │
└─────────────────────────────────────────────────────────────────┘

User (Device A): Opens website
       │
       ▼
┌──────────────────┐
│ Login Dialog     │
│ Enter credentials│
└────────┬─────────┘
         │
         ▼
POST /api/auth/single-session-login
         │
         ├─► Authenticate with Supabase Auth
         │   (Verify email + password)
         │
         ├─► Generate session_id = "SESSION_A"
         │
         ├─► Insert into user_sessions:
         │   { user_id, session_id: "SESSION_A", status: "active" }
         │
         ├─► Revoke all other sessions
         │   UPDATE user_sessions SET status='revoked'
         │   WHERE user_id = X AND session_id != "SESSION_A"
         │
         └─► Set cookie: session_id = "SESSION_A"
         │
         ▼
┌──────────────────┐
│ User Logged In   │
│ (Device A)       │
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│  Start Session Monitor                     │
│  - Heartbeat every 30 seconds              │
│  - Validate session every 60 seconds       │
└────────┬───────────────────────────────────┘
         │
         ▼
   ┌──────────┐
   │  Time    │
   │  Passes  │
   └────┬─────┘
        │
        ▼

User (Device B): Logs in with same account
       │
       ▼
POST /api/auth/single-session-login
       │
       ├─► Authenticate: SUCCESS
       │
       ├─► Generate session_id = "SESSION_B"
       │
       ├─► Insert new session:
       │   { user_id, session_id: "SESSION_B", status: "active" }
       │
       └─► Revoke other sessions:
           UPDATE user_sessions SET status='revoked'
           WHERE user_id = X AND session_id != "SESSION_B"
           
           ⚠️ SESSION_A is now REVOKED
       │
       ▼
Device B: Logged in successfully
       │
       │
       ▼ (30 seconds later)
       
Device A: Heartbeat runs
       │
       ▼
POST /api/auth/heartbeat
       │
       ├─► Get session_id from cookie: "SESSION_A"
       │
       ├─► Query database:
       │   SELECT * FROM user_sessions 
       │   WHERE session_id = "SESSION_A"
       │
       └─► Result: status = "revoked" ❌
       │
       ▼
┌───────────────────────────────────────────┐
│ Response: { revoked: true }               │
│ Message: "You logged in from another      │
│          device"                          │
└────────┬──────────────────────────────────┘
         │
         ▼
Device A: Force Logout
       │
       ├─► Clear cookies
       ├─► Sign out from Supabase
       └─► Redirect to home page
       │
       ▼
┌──────────────────┐
│ Show Alert:      │
│ "Your session    │
│  ended because   │
│  you logged in   │
│  from another    │
│  device."        │
└──────────────────┘
```

### Heartbeat Mechanism Detailed

```
┌────────────────────────────────────────────────────────────┐
│                   HEARTBEAT CYCLE                          │
└────────────────────────────────────────────────────────────┘

Client (Browser)
       │
       │ Every 30 seconds
       │
       ▼
┌─────────────────────┐
│ Send Heartbeat      │
│ POST /api/auth/     │
│      heartbeat      │
└──────┬──────────────┘
       │
       ▼
Server: Get user from Supabase Auth
       │
       ▼
Server: Get session_id from cookie
       │
       ▼
Server: Query database
       │
       ▼
┌──────────────────────────────────────┐
│ SELECT status FROM user_sessions     │
│ WHERE user_id = ? AND session_id = ? │
└──────┬───────────────────────────────┘
       │
       ▼
    Decision
       │
       ├─────────────────┬─────────────────┐
       │                 │                 │
    Active           Revoked          Not Found
       │                 │                 │
       ▼                 ▼                 ▼
┌─────────────┐   ┌──────────────┐  ┌──────────────┐
│ Update last │   │ Return 401   │  │ Return 401   │
│ activity    │   │ revoked:true │  │ Session not  │
│ timestamp   │   └──────┬───────┘  │ found        │
└──────┬──────┘          │          └──────┬───────┘
       │                 │                 │
       ▼                 │                 │
┌─────────────┐          │                 │
│ Return 200  │          │                 │
│ success:true│          │                 │
└──────┬──────┘          │                 │
       │                 │                 │
       └─────────────────┴─────────────────┘
                         │
                         ▼
                    Client Side
                         │
       ┌─────────────────┴─────────────────┐
       │                                   │
       ▼                                   ▼
  Success (200)                      Error (401)
  Session Valid                      Session Invalid
       │                                   │
       ▼                                   ▼
  Continue Normal                    Force Logout
  Operation                          Show Message
  Wait 30 seconds                    Redirect Home
  Send next heartbeat
```

### Database Session Management

```
┌────────────────────────────────────────────────────────────┐
│             DATABASE SESSION STATES                        │
└────────────────────────────────────────────────────────────┘

user_sessions Table
┌──────┬─────────┬────────────┬────────┬─────────────────────┐
│ id   │ user_id │ session_id │ status │ last_activity_at    │
├──────┼─────────┼────────────┼────────┼─────────────────────┤
│ 1    │ user-A  │ sess-001   │ revoked│ 2024-01-24 10:00:00 │ ← Old
│ 2    │ user-A  │ sess-002   │ revoked│ 2024-01-24 11:30:00 │ ← Old
│ 3    │ user-A  │ sess-003   │ active │ 2024-01-24 14:15:30 │ ← Current
│ 4    │ user-B  │ sess-004   │ active │ 2024-01-24 14:10:00 │ ← Current
└──────┴─────────┴────────────┴────────┴─────────────────────┘

Rule: Only ONE active session per user_id

When user-A logs in again:
1. New session created (sess-005)
2. sess-003 status changed to 'revoked'
3. Result: Only sess-005 is active for user-A
```

---

## 🔒 Security Considerations

### 1. **HTTP-Only Cookies**
```typescript
{
  httpOnly: true,  // ✅ Cannot be accessed by JavaScript
  secure: true,    // ✅ Only sent over HTTPS
  sameSite: 'lax', // ✅ CSRF protection
}
```
- **Prevents XSS attacks**: Even if attacker injects JavaScript, they can't read the session ID
- **Prevents CSRF**: Cookie won't be sent with cross-origin requests

### 2. **Row Level Security (RLS)**
```sql
CREATE POLICY "Users can view their own sessions"
ON public.user_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
```
- Users can only query their own sessions
- Prevents User A from seeing User B's session data
- Enforced at database level (can't be bypassed)

### 3. **Session Revocation**
- Old sessions are immediately invalidated
- No grace period where multiple sessions are valid
- Heartbeat detects revocation within 30 seconds

### 4. **IP Address & Device Logging**
```typescript
{
  ip_address: "192.168.1.1",
  user_agent: "Mozilla/5.0...",
  device_info: { browser: "Chrome", os: "Windows" }
}
```
- Helps detect suspicious logins
- Can be used for security alerts
- Audit trail for compliance

### 5. **Supabase Auth Integration**
- Password hashing handled by Supabase
- Email verification available
- 2FA can be added
- OAuth providers supported (Google, GitHub, etc.)

### 6. **Database Functions with SECURITY DEFINER**
```sql
CREATE OR REPLACE FUNCTION public.revoke_other_sessions(...)
LANGUAGE plpgsql
SECURITY DEFINER
```
- Runs with elevated privileges
- Can update any session (needed to revoke others)
- But still respects RLS for user queries

---

## 🧪 Testing & Troubleshooting

### Testing the System

#### **Test 1: Basic Login**
```
1. Open website in Browser A
2. Log in with test@example.com
3. Verify: Cookie 'session_id' is set
4. Check database: One active session exists
5. Navigate to protected pages - should work
```

#### **Test 2: Concurrent Login**
```
1. Login in Browser A (Chrome)
2. Without logging out, login in Browser B (Firefox)
3. Wait 30 seconds
4. Expected: Browser A automatically logs out
5. Expected: Alert message shown in Browser A
6. Verify database: Only one active session (Browser B)
```

#### **Test 3: Heartbeat Functionality**
```
1. Login to website
2. Open browser DevTools > Network tab
3. Wait and observe
4. Expected: POST to /api/auth/heartbeat every 30 seconds
5. Expected: Response 200 OK { success: true }
6. Check database: last_activity_at updates every 30 seconds
```

#### **Test 4: Manual Logout**
```
1. Login to website
2. Click logout button
3. Verify: Redirected to home page
4. Check cookies: session_id deleted
5. Check database: session status = 'revoked'
6. Try accessing protected page: Should redirect/deny
```

#### **Test 5: Session Persistence**
```
1. Login to website
2. Close browser tab
3. Open new tab with same URL
4. Expected: Still logged in (cookie persists)
5. Close entire browser (not just tab)
6. Open browser again
7. Expected: Still logged in (until cookie expires or logout)
```

### Common Issues & Solutions

#### **Issue 1: Session not detected after login**
**Symptoms:** Logged in but heartbeat says "not found"

**Solution:**
```typescript
// Check if session was created
SELECT * FROM user_sessions WHERE user_id = 'your-user-id';

// Check if cookie was set
// In browser DevTools > Application > Cookies
// Look for 'session_id' cookie

// Ensure login endpoint completes successfully
// Check server logs for errors during session creation
```

#### **Issue 2: Multiple active sessions for same user**
**Symptoms:** User has 2+ active sessions in database

**Solution:**
```sql
-- Manually fix database
UPDATE user_sessions 
SET status = 'revoked', revoked_at = NOW()
WHERE user_id = 'problematic-user-id' 
AND status = 'active';

-- Keep only the latest one
UPDATE user_sessions 
SET status = 'active', revoked_at = NULL
WHERE id = (
  SELECT id FROM user_sessions 
  WHERE user_id = 'problematic-user-id'
  ORDER BY created_at DESC 
  LIMIT 1
);

-- Check the revoke_other_sessions function is working
SELECT public.revoke_other_sessions('user-id', 'keep-this-session-id');
```

#### **Issue 3: User keeps getting logged out**
**Symptoms:** Heartbeat fails repeatedly, force logout every 30 seconds

**Solution:**
```typescript
// Check Supabase Auth status
const { data: { user } } = await supabase.auth.getUser();
console.log('User:', user); // Should not be null

// Check cookie is being sent
// In browser DevTools > Network > heartbeat request
// Headers tab > Cookie: should include session_id

// Check session exists in database
SELECT * FROM user_sessions 
WHERE session_id = 'your-session-id';
```

#### **Issue 4: Heartbeat too frequent/infrequent**
**Symptoms:** Performance issues or delayed detection

**Solution:**
```typescript
// Adjust intervals in use-session-monitor.ts
const HEARTBEAT_INTERVAL = 30000; // Change to 60000 for less frequent
const SESSION_CHECK_INTERVAL = 60000; // Adjust as needed

// Balance between:
// - Faster detection (shorter interval)
// - Less server load (longer interval)
```

#### **Issue 5: Database not updating last_activity_at**
**Symptoms:** Timestamp stuck at login time

**Solution:**
```sql
-- Test the function directly
SELECT public.update_session_activity('your-session-id');
-- Should return TRUE

-- Check function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'update_session_activity';

-- Manually update to test
UPDATE user_sessions 
SET last_activity_at = NOW() 
WHERE session_id = 'your-session-id';
```

### Database Queries for Debugging

```sql
-- View all sessions for a user
SELECT * FROM user_sessions 
WHERE user_id = 'user-id-here'
ORDER BY created_at DESC;

-- Count active sessions per user
SELECT user_id, COUNT(*) as active_count
FROM user_sessions
WHERE status = 'active'
GROUP BY user_id
HAVING COUNT(*) > 1; -- Find users with multiple active sessions

-- Find sessions with old activity (inactive)
SELECT * FROM user_sessions
WHERE status = 'active'
AND last_activity_at < NOW() - INTERVAL '1 hour'
ORDER BY last_activity_at ASC;

-- Cleanup test sessions
DELETE FROM user_sessions
WHERE user_id IN ('test-user-1', 'test-user-2');

-- View session history for debugging
SELECT 
  user_id,
  session_id,
  status,
  created_at,
  last_activity_at,
  revoked_at,
  EXTRACT(EPOCH FROM (revoked_at - created_at)) as session_duration_seconds
FROM user_sessions
WHERE user_id = 'user-id-here'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📚 Key Concepts Summary

### What We Built
A **comprehensive single active session system** that ensures only one device can be logged into a user account at a time.

### Technologies Used
- **Next.js 14**: Full-stack framework (Frontend + API routes)
- **TypeScript**: Type-safe code
- **Supabase**: Authentication + PostgreSQL database
- **HTTP-Only Cookies**: Secure session storage
- **PostgreSQL Functions**: Efficient session management
- **React Hooks**: Client-side monitoring

### Files Created

| File | Purpose | Type |
|------|---------|------|
| `004_create_user_sessions.sql` | Database schema & functions | Database |
| `lib/types/session.ts` | TypeScript type definitions | Types |
| `lib/supabase/session-manager.ts` | Core session logic (server) | Server Logic |
| `app/api/auth/single-session-login/route.ts` | Login endpoint | API |
| `app/api/auth/heartbeat/route.ts` | Session validation endpoint | API |
| `app/api/auth/logout/route.ts` | Logout endpoint | API |
| `components/login-dialog.tsx` | Login UI component | Frontend |
| `hooks/use-session-monitor.ts` | Session monitoring hook | Frontend |
| `components/session-validator.tsx` | Activity tracking component | Frontend |
| `middleware.ts` | Auth session updater | Middleware |

### How It Works (Simple Explanation)

1. **User logs in** → Server creates a unique session ID
2. **Session stored** → In database AND browser cookie
3. **Other sessions revoked** → Any old sessions marked as invalid
4. **Heartbeat starts** → Browser checks with server every 30 seconds
5. **Concurrent login detected** → Old session marked revoked in database
6. **Heartbeat finds revoked** → Browser automatically logs out
7. **User sees message** → "You logged in from another device"

### Benefits

✅ **Security**: Only one active session prevents account sharing  
✅ **User Control**: Users know when someone else logs in  
✅ **Resource Efficient**: Fewer active sessions on free tier  
✅ **Real-time Detection**: 30-second heartbeat catches concurrent logins  
✅ **Scalable**: Works for thousands of users  
✅ **Auditable**: Complete session history in database  

### Trade-offs

⚠️ **Network Usage**: Heartbeat every 30 seconds (minimal data)  
⚠️ **Logout Delay**: Up to 30 seconds to detect concurrent login  
⚠️ **Single Device**: Users can't use multiple devices simultaneously  
⚠️ **Cookie Dependency**: Users must have cookies enabled  

---

## 🎓 Learning Takeaways

### Concepts You Learned

1. **Session Management**: How web applications track logged-in users
2. **HTTP Cookies**: Secure way to store session identifiers
3. **Database Functions**: Using PostgreSQL for business logic
4. **API Design**: RESTful endpoints for authentication
5. **Real-time Monitoring**: Heartbeat pattern for session validation
6. **React Hooks**: Custom hooks for reusable logic
7. **Type Safety**: TypeScript interfaces for robust code
8. **Security Patterns**: RLS, HTTP-only cookies, CSRF protection

### Best Practices Applied

✅ **Separation of Concerns**: Database, server logic, API, and frontend separated  
✅ **Type Safety**: TypeScript throughout  
✅ **Error Handling**: Try-catch blocks and proper error responses  
✅ **Security First**: HTTP-only cookies, RLS policies, input validation  
✅ **Code Reusability**: Hooks and utility functions  
✅ **Documentation**: Comments explaining complex logic  
✅ **Testing Mindset**: Functions designed to be testable  

---

## 🚀 Future Enhancements

### Possible Improvements

1. **Multiple Active Sessions with Limit**
   - Allow 2-3 concurrent sessions
   - Show list of active devices
   - Allow user to revoke specific devices

2. **Session Activity Dashboard**
   - Show login history
   - Display device information
   - Suspicious login alerts

3. **Remember Device**
   - Trust specific devices
   - Don't revoke trusted devices
   - Device fingerprinting

4. **Idle Timeout**
   - Automatically logout after X minutes of inactivity
   - Show warning before timeout
   - Extend session on activity

5. **WebSocket Integration**
   - Real-time session revocation (no 30s delay)
   - Instant logout on concurrent login
   - Server pushes revocation events

6. **Email Notifications**
   - Send email when new device logs in
   - Include device info and location
   - Allow quick session revocation from email

7. **Rate Limiting**
   - Limit login attempts
   - Prevent brute force attacks
   - IP-based throttling

---

## 📞 Support & Maintenance

### Regular Maintenance Tasks

1. **Cleanup Old Sessions (Weekly)**
```sql
SELECT public.cleanup_old_sessions(30); -- Remove sessions older than 30 days
```

2. **Monitor Session Count**
```sql
SELECT COUNT(*) as total_sessions,
       SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
       SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) as revoked
FROM user_sessions;
```

3. **Check for Anomalies**
```sql
-- Users with multiple active sessions (should be 0)
SELECT user_id, COUNT(*) 
FROM user_sessions 
WHERE status = 'active' 
GROUP BY user_id 
HAVING COUNT(*) > 1;
```

### Performance Optimization

1. **Database Indexes** (Already created)
   - `idx_user_sessions_user_status`
   - `idx_user_sessions_session_id`
   - `idx_user_sessions_created_at`

2. **Heartbeat Optimization**
   - Adjust interval based on user base size
   - Consider reducing frequency for inactive tabs
   - Batch multiple updates if needed

3. **Connection Pooling**
   - Supabase handles this automatically
   - Monitor connection usage in Supabase dashboard

---

## ✅ Conclusion

You now have a **fully functional, production-ready single active session system** that:

- ✅ Enforces one session per user
- ✅ Detects concurrent logins within 30 seconds
- ✅ Automatically logs out old sessions
- ✅ Tracks user activity and device information
- ✅ Provides secure authentication
- ✅ Scales with your application

This system demonstrates professional-level authentication architecture and can be used as a foundation for any application requiring session management.

---

**Documentation Created**: February 3, 2026  
**System Version**: 1.0  
**Last Updated**: February 3, 2026

