/**
 * Single Active Device Session Manager
 * 
 * Rules:
 * - Only one active session per user
 * - Device 2 login automatically deactivates Device 1
 * - 20-minute idle timeout (sliding window)
 * - Session authority controlled by user_sessions table
 */

import { createClient } from "@/lib/supabase/client"

// ============================================================================
// Types
// ============================================================================

export interface DeviceInfo {
  browser: string
  os: string
  deviceType: string
}

export interface SessionRecord {
  id: string
  user_id: string
  session_token: string
  device_info: DeviceInfo
  ip_address: string | null
  user_agent: string
  created_at: string
  expires_at: string
  last_activity: string
  is_active: boolean
}

export interface SessionResult {
  success: boolean
  session?: SessionRecord
  error?: string
}

// ============================================================================
// Constants
// ============================================================================

const SESSION_DURATION_MS = 20 * 60 * 1000 // 20 minutes
const SESSION_TOKEN_KEY = "app_session_token"

// ============================================================================
// Token Generation (Browser-Safe)
// ============================================================================

/**
 * Generate a cryptographically secure random session token
 * Uses Web Crypto API (browser-safe)
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
 * Remove session token from localStorage
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
 * Parse user agent to extract device information
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
 * Check if user has an active session
 * Returns the active session if found, null otherwise
 */
export async function checkActiveSession(userId: string): Promise<SessionRecord | null> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single()
    
    if (error) {
      // No active session found (expected for first login)
      if (error.code === 'PGRST116') return null
      throw error
    }
    
    return data
  } catch (error) {
    console.error("Error checking active session:", error)
    return null
  }
}

/**
 * Deactivate all active sessions for a user
 * Used when Device 2 logs in to force logout Device 1
 */
export async function deactivateAllUserSessions(userId: string): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const supabase = createClient()
    
    // Call the database function to deactivate all sessions
    const { data, error } = await supabase.rpc('deactivate_all_user_sessions', {
      target_user_id: userId
    })
    
    if (error) throw error
    
    return { success: true, count: data || 0 }
  } catch (error: any) {
    console.error("Error deactivating sessions:", error)
    return { success: false, count: 0, error: error.message }
  }
}

/**
 * Create a new active session
 * This grants access to the device
 */
export async function createSession(
  userId: string,
  deviceInfo: DeviceInfo,
  ipAddress: string | null,
  userAgent: string
): Promise<SessionResult> {
  try {
    const supabase = createClient()
    
    // Generate unique session token
    const sessionToken = generateSessionToken()
    
    // Calculate expiration (20 minutes from now)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS)
    
    // Insert new session
    const { data, error } = await supabase
      .from("user_sessions")
      .insert({
        user_id: userId,
        session_token: sessionToken,
        device_info: deviceInfo,
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: expiresAt.toISOString(),
        last_activity: now.toISOString(),
        is_active: true
      })
      .select()
      .single()
    
    if (error) throw error
    
    // Store token in localStorage for future requests
    storeSessionToken(sessionToken)
    
    return { success: true, session: data }
  } catch (error: any) {
    console.error("Error creating session:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Validate and refresh a session
 * Checks if session is active and not expired
 * Updates last_activity and extends expires_at
 */
export async function validateAndRefreshSession(sessionToken: string): Promise<SessionResult> {
  try {
    const supabase = createClient()
    
    // Get session
    const { data: session, error: fetchError } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("session_token", sessionToken)
      .eq("is_active", true)
      .single()
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return { success: false, error: "Session not found or inactive" }
      }
      throw fetchError
    }
    
    // Check if expired
    const now = new Date()
    const expiresAt = new Date(session.expires_at)
    const lastActivity = new Date(session.last_activity)
    const idleTime = now.getTime() - lastActivity.getTime()
    
    if (expiresAt < now || idleTime >= SESSION_DURATION_MS) {
      // Session expired - deactivate it
      await supabase
        .from("user_sessions")
        .update({ is_active: false })
        .eq("session_token", sessionToken)
      
      return { success: false, error: "Session expired" }
    }
    
    // Session is valid - refresh it
    const newExpiresAt = new Date(now.getTime() + SESSION_DURATION_MS)
    
    const { data: updatedSession, error: updateError } = await supabase
      .from("user_sessions")
      .update({
        last_activity: now.toISOString(),
        expires_at: newExpiresAt.toISOString()
      })
      .eq("session_token", sessionToken)
      .select()
      .single()
    
    if (updateError) throw updateError
    
    return { success: true, session: updatedSession }
  } catch (error: any) {
    console.error("Error validating session:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Deactivate a specific session
 * Used for logout
 */
export async function deactivateSession(sessionToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    
    const { error } = await supabase
      .from("user_sessions")
      .update({ is_active: false })
      .eq("session_token", sessionToken)
    
    if (error) throw error
    
    // Clear local token
    clearSessionToken()
    
    return { success: true }
  } catch (error: any) {
    console.error("Error deactivating session:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Cleanup expired sessions (can be called periodically)
 */
export async function cleanupExpiredSessions(): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase.rpc('cleanup_expired_sessions')
    
    if (error) throw error
    
    return { success: true, count: data || 0 }
  } catch (error: any) {
    console.error("Error cleaning up expired sessions:", error)
    return { success: false, error: error.message }
  }
}
