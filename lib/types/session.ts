// ============================================================================
// Session Types for Single Active Session System
// ============================================================================

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

export interface DeviceInfo {
  browser?: string;
  os?: string;
  device?: string;
  isMobile?: boolean;
}

export interface SessionValidationResult {
  isValid: boolean;
  reason?: 'valid' | 'revoked' | 'not_found' | 'expired';
  message?: string;
}

export interface CreateSessionParams {
  userId: string;
  sessionId: string;
  deviceInfo?: DeviceInfo;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionStatus {
  hasActiveSession: boolean;
  sessionId?: string;
  createdAt?: string;
  lastActivityAt?: string;
}
