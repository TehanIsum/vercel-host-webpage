// ============================================================================
// Session Manager - Single Active Session Enforcement
// ============================================================================
// Manages session lifecycle for one-session-per-user policy
// ============================================================================

import { createClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import type {
  UserSession,
  SessionValidationResult,
  CreateSessionParams,
  SessionStatus,
  DeviceInfo,
} from '@/lib/types/session';

// ============================================================================
// Constants
// ============================================================================

const SESSION_COOKIE_NAME = 'session_id';
const SESSION_EXPIRY_HOURS = 24 * 7; // 7 days

// ============================================================================
// Session Creation
// ============================================================================

/**
 * Creates a new session for the user and revokes all other active sessions
 * This enforces the single active session rule
 */
export async function createUserSession(
  params: CreateSessionParams
): Promise<{ success: boolean; sessionId: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { userId, sessionId, deviceInfo, ipAddress, userAgent } = params;

    // Insert the new session
    const { error: insertError } = await supabase.from('user_sessions').insert({
      user_id: userId,
      session_id: sessionId,
      status: 'active',
      device_info: deviceInfo || {},
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('Failed to create session:', insertError);
      return { success: false, sessionId: '', error: insertError.message };
    }

    // Revoke all other sessions for this user
    const { error: revokeError } = await supabase.rpc('revoke_other_sessions', {
      p_user_id: userId,
      p_current_session_id: sessionId,
    });

    if (revokeError) {
      console.error('Failed to revoke other sessions:', revokeError);
      // Don't fail the login if revocation fails - the new session is still created
    }

    return { success: true, sessionId };
  } catch (error) {
    console.error('Error in createUserSession:', error);
    return {
      success: false,
      sessionId: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Session Validation
// ============================================================================

/**
 * Validates if a session is still active and belongs to the user
 * Returns validation result with reason for invalidity
 */
export async function validateSession(
  userId: string,
  sessionId: string
): Promise<SessionValidationResult> {
  try {
    const supabase = await createClient();

    // Check if session exists and is active
    const { data, error } = await supabase
      .from('user_sessions')
      .select('status, revoked_at')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .single();

    if (error || !data) {
      return {
        isValid: false,
        reason: 'not_found',
        message: 'Session not found',
      };
    }

    if (data.status === 'revoked') {
      return {
        isValid: false,
        reason: 'revoked',
        message: 'Your session ended because you logged in from another device.',
      };
    }

    return {
      isValid: true,
      reason: 'valid',
    };
  } catch (error) {
    console.error('Error validating session:', error);
    return {
      isValid: false,
      reason: 'not_found',
      message: 'Failed to validate session',
    };
  }
}

/**
 * Validates session using the database function (alternative approach)
 */
export async function isSessionValid(
  userId: string,
  sessionId: string
): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('is_session_valid', {
      p_user_id: userId,
      p_session_id: sessionId,
    });

    if (error) {
      console.error('Error checking session validity:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error in isSessionValid:', error);
    return false;
  }
}

// ============================================================================
// Session Activity Updates
// ============================================================================

/**
 * Updates the last activity timestamp for a session (heartbeat)
 */
export async function updateSessionActivity(
  sessionId: string
): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('update_session_activity', {
      p_session_id: sessionId,
    });

    if (error) {
      console.error('Failed to update session activity:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error in updateSessionActivity:', error);
    return false;
  }
}

// ============================================================================
// Session Revocation
// ============================================================================

/**
 * Revokes a specific session
 */
export async function revokeSession(
  userId: string,
  sessionId: string
): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('user_sessions')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('session_id', sessionId);

    if (error) {
      console.error('Failed to revoke session:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in revokeSession:', error);
    return false;
  }
}

/**
 * Revokes all sessions for a user (useful for logout all devices)
 */
export async function revokeAllUserSessions(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('user_sessions')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      console.error('Failed to revoke all sessions:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in revokeAllUserSessions:', error);
    return false;
  }
}

// ============================================================================
// Session Queries
// ============================================================================

/**
 * Gets the active session for a user
 */
export async function getActiveSession(
  userId: string
): Promise<SessionStatus> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_active_session', {
      p_user_id: userId,
    });

    if (error || !data || data.length === 0) {
      return { hasActiveSession: false };
    }

    const session = data[0];
    return {
      hasActiveSession: true,
      sessionId: session.session_id,
      createdAt: session.created_at,
      lastActivityAt: session.last_activity_at,
    };
  } catch (error) {
    console.error('Error in getActiveSession:', error);
    return { hasActiveSession: false };
  }
}

/**
 * Gets all sessions for a user (for admin/debugging purposes)
 */
export async function getUserSessions(userId: string): Promise<UserSession[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to get user sessions:', error);
      return [];
    }

    return (data || []) as UserSession[];
  } catch (error) {
    console.error('Error in getUserSessions:', error);
    return [];
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generates a new unique session ID
 */
export function generateSessionId(): string {
  return uuidv4();
}

/**
 * Extracts device information from user agent string
 */
export function parseDeviceInfo(userAgent?: string): DeviceInfo {
  if (!userAgent) {
    return {
      browser: 'Unknown',
      os: 'Unknown',
      device: 'Unknown',
      isMobile: false,
    };
  }

  const deviceInfo: DeviceInfo = {
    isMobile: /Mobile|Android|iPhone|iPad/i.test(userAgent),
  };

  // Detect browser
  if (userAgent.includes('Chrome')) {
    deviceInfo.browser = 'Chrome';
  } else if (userAgent.includes('Safari')) {
    deviceInfo.browser = 'Safari';
  } else if (userAgent.includes('Firefox')) {
    deviceInfo.browser = 'Firefox';
  } else if (userAgent.includes('Edge')) {
    deviceInfo.browser = 'Edge';
  } else {
    deviceInfo.browser = 'Unknown';
  }

  // Detect OS
  if (userAgent.includes('Windows')) {
    deviceInfo.os = 'Windows';
  } else if (userAgent.includes('Mac')) {
    deviceInfo.os = 'macOS';
  } else if (userAgent.includes('Linux')) {
    deviceInfo.os = 'Linux';
  } else if (userAgent.includes('Android')) {
    deviceInfo.os = 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    deviceInfo.os = 'iOS';
  } else {
    deviceInfo.os = 'Unknown';
  }

  // Detect device type
  if (deviceInfo.isMobile) {
    deviceInfo.device = 'Mobile';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    deviceInfo.device = 'Tablet';
  } else {
    deviceInfo.device = 'Desktop';
  }

  return deviceInfo;
}

/**
 * Extracts IP address from request headers
 */
export function getClientIpAddress(headers: Headers): string | undefined {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    undefined
  );
}
