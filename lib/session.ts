/**
 * Single Active Session Manager
 * 
 * Rules:
 * - Only one active session per user
 * - New login terminates previous session automatically
 * - 20-minute idle timeout
 * - Session status tracked in database
 */

import { createClient } from "@/lib/supabase/client"

// ============================================================================
// Types
// ============================================================================

export type SessionStatus = 'active' | 'terminated' | 'expired'

export interface DeviceInfo {
  browser: string
  os: string
  deviceType: string
}

export interface SessionRecord {
  id: string
  user_id: string
  session_token: string
  status: SessionStatus
  created_at: string
  last_activity_at: string
  terminated_at: string | null
  ip_address: string | null
  user_agent: string
  device_info: DeviceInfo
}

// ============================================================================
// Constants
// ============================================================================

const SESSION_TOKEN_KEY = "session_token"
const SESSION_IDLE_TIMEOUT = 20 * 60 * 1000 // 20 minutes

// ============================================================================
// Token Management
// ============================================================================

/**
 * Generate secure random session token
 */
export function generateSessionToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Store session token in localStorage
 */
export function storeSessionToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_TOKEN_KEY, token)
  }
}

/**
 * Get session token from localStorage
 */
export function getSessionToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(SESSION_TOKEN_KEY)
  }
  return null
}

/**
 * Clear session token from localStorage
 */
export function clearSessionToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_TOKEN_KEY)
  }
}

// ============================================================================
// Device Detection
// ============================================================================

/**
 * Parse user agent to get device information
 */
export function getDeviceInfo(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase()
  
  // Detect browser
  let browser = "Unknown"
  if (ua.includes("firefox")) browser = "Firefox"
  else if (ua.includes("edg")) browser = "Edge"
  else if (ua.includes("chrome")) browser = "Chrome"
  else if (ua.includes("safari")) browser = "Safari"
  else if (ua.includes("opera")) browser = "Opera"
  
  // Detect OS
  let os = "Unknown"
  if (ua.includes("windows")) os = "Windows"
  else if (ua.includes("mac")) os = "macOS"
  else if (ua.includes("linux")) os = "Linux"
  else if (ua.includes("android")) os = "Android"
  else if (ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad")) os = "iOS"
  
  // Detect device type
  let deviceType = "Desktop"
  if (ua.includes("mobile")) deviceType = "Mobile"
  else if (ua.includes("tablet")) deviceType = "Tablet"
  
  return { browser, os, deviceType }
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Create a new session (automatically terminates previous sessions via trigger)
 */
export async function createSession(
  userId: string,
  ipAddress: string | null = null
): Promise<{ success: boolean; session?: SessionRecord; error?: string; hadPreviousSession?: boolean }> {
  try {
    const supabase = createClient()
    const sessionToken = generateSessionToken()
    const userAgent = navigator.userAgent
    const deviceInfo = getDeviceInfo(userAgent)
    
    // Check if there's an existing active session (to detect conflict)
    const { data: existingSessions } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
    
    const hadPreviousSession = existingSessions && existingSessions.length > 0
    
    // Insert new session - trigger will automatically terminate previous ones
    const { data, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        session_token: sessionToken,
        status: 'active',
        ip_address: ipAddress,
        user_agent: userAgent,
        device_info: deviceInfo,
        last_activity_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    
    // Store token in localStorage
    storeSessionToken(sessionToken)
    
    return { success: true, session: data, hadPreviousSession }
  } catch (error: any) {
    console.error('Error creating session:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get active session by token
 */
export async function getActiveSession(
  sessionToken: string
): Promise<{ success: boolean; session?: SessionRecord; error?: string }> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .eq('status', 'active')
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Session not found or inactive' }
      }
      throw error
    }
    
    return { success: true, session: data }
  } catch (error: any) {
    console.error('Error getting session:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update session activity (refresh last_activity_at)
 */
export async function updateSessionActivity(
  sessionToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('user_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('session_token', sessionToken)
      .eq('status', 'active')
    
    if (error) throw error
    
    return { success: true }
  } catch (error: any) {
    console.error('Error updating session activity:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Terminate current session (logout)
 */
export async function terminateSession(
  sessionToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('user_sessions')
      .update({ 
        status: 'terminated',
        terminated_at: new Date().toISOString()
      })
      .eq('session_token', sessionToken)
      .eq('status', 'active') // Only terminate if currently active
    
    if (error) throw error
    
    // Clear local token
    clearSessionToken()
    
    return { success: true }
  } catch (error: any) {
    console.error('Error terminating session:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Check if session is expired (idle > 20 minutes)
 */
export function isSessionExpired(lastActivity: string): boolean {
  const lastActivityTime = new Date(lastActivity).getTime()
  const now = Date.now()
  return (now - lastActivityTime) >= SESSION_IDLE_TIMEOUT
}

/**
 * Validate session and check if it's still active
 */
export async function validateSession(
  sessionToken: string
): Promise<{ valid: boolean; session?: SessionRecord; reason?: string }> {
  const result = await getActiveSession(sessionToken)
  
  if (!result.success || !result.session) {
    return { valid: false, reason: 'Session not found or terminated' }
  }
  
  // Check if session is expired due to inactivity
  if (isSessionExpired(result.session.last_activity_at)) {
    // Expire the session
    const supabase = createClient()
    await supabase
      .from('user_sessions')
      .update({ 
        status: 'expired',
        terminated_at: new Date().toISOString()
      })
      .eq('session_token', sessionToken)
    
    return { valid: false, reason: 'Session expired due to inactivity' }
  }
  
  // Session is valid
  return { valid: true, session: result.session }
}

/**
 * Listen for session termination (realtime)
 */
export function subscribeToSessionChanges(
  sessionToken: string,
  onTerminated: () => void
): () => void {
  const supabase = createClient()
  
  const channel = supabase
    .channel('session_changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_sessions',
        filter: `session_token=eq.${sessionToken}`
      },
      (payload: any) => {
        if (payload.new.status !== 'active') {
          console.log('Session terminated:', payload.new.status)
          onTerminated()
        }
      }
    )
    .subscribe()
  
  // Return cleanup function
  return () => {
    channel.unsubscribe()
  }
}
