-- ============================================================================
-- Single Active Session System - Database Schema
-- ============================================================================
-- Purpose: Enforce one active session per user on Supabase Free tier
-- Created: 2026-01-24
-- ============================================================================

-- Drop existing table if recreating
DROP TABLE IF EXISTS public.user_sessions CASCADE;

-- ============================================================================
-- Table: user_sessions
-- ============================================================================
-- Tracks active sessions for each user to enforce single-session policy
-- Only ONE session per user can have status = 'active' at any time
-- ============================================================================

CREATE TABLE public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL UNIQUE, -- Unique identifier for this session
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    
    -- Metadata
    device_info JSONB DEFAULT '{}', -- Browser, OS, device type
    ip_address TEXT,
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_revoked_at CHECK (
        (status = 'revoked' AND revoked_at IS NOT NULL) OR
        (status = 'active' AND revoked_at IS NULL)
    )
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Fast lookup by user_id and status (most common query)
CREATE INDEX idx_user_sessions_user_status 
ON public.user_sessions(user_id, status) 
WHERE status = 'active';

-- Fast lookup by session_id for validation
CREATE INDEX idx_user_sessions_session_id 
ON public.user_sessions(session_id);

-- Fast lookup for cleanup queries
CREATE INDEX idx_user_sessions_created_at 
ON public.user_sessions(created_at);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can read their own sessions
CREATE POLICY "Users can view their own sessions"
ON public.user_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: Users can insert their own sessions (via service role/function)
-- This is typically handled by server-side API, but allows user context
CREATE POLICY "Users can create their own sessions"
ON public.user_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own sessions
-- Allows session updates like last_activity_at
CREATE POLICY "Users can update their own sessions"
ON public.user_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can delete/revoke their own sessions
CREATE POLICY "Users can delete their own sessions"
ON public.user_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================================
-- Drop Existing Functions (if they exist)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_active_session(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.revoke_other_sessions(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.is_session_valid(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.is_session_valid(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_session_activity(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_sessions(INTEGER) CASCADE;

-- ============================================================================
-- Helper Function: Get Active Session for User
-- ============================================================================
-- Returns the currently active session for a user (should only be one)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_active_session(p_user_id UUID)
RETURNS TABLE (
    session_id TEXT,
    created_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    device_info JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        us.session_id,
        us.created_at,
        us.last_activity_at,
        us.device_info
    FROM public.user_sessions us
    WHERE us.user_id = p_user_id
    AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;
END;
$$;

-- ============================================================================
-- Helper Function: Revoke All Sessions Except Current
-- ============================================================================
-- Revokes all sessions for a user except the specified session_id
-- This enforces the single active session rule
-- ============================================================================

CREATE OR REPLACE FUNCTION public.revoke_other_sessions(
    p_user_id UUID,
    p_current_session_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    revoked_count INTEGER;
BEGIN
    UPDATE public.user_sessions
    SET 
        status = 'revoked',
        revoked_at = NOW()
    WHERE user_id = p_user_id
    AND session_id != p_current_session_id
    AND status = 'active';
    
    GET DIAGNOSTICS revoked_count = ROW_COUNT;
    RETURN revoked_count;
END;
$$;

-- ============================================================================
-- Helper Function: Validate Session
-- ============================================================================
-- Checks if a session is valid (exists, active, belongs to user)
-- Returns TRUE if valid, FALSE otherwise
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_session_valid(
    p_user_id UUID,
    p_session_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    is_valid BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM public.user_sessions
        WHERE user_id = p_user_id
        AND session_id = p_session_id
        AND status = 'active'
    ) INTO is_valid;
    
    RETURN is_valid;
END;
$$;

-- ============================================================================
-- Helper Function: Update Session Activity
-- ============================================================================
-- Updates the last_activity_at timestamp for a session
-- Used for heartbeat/keepalive functionality
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_session_activity(
    p_session_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.user_sessions
    SET last_activity_at = NOW()
    WHERE session_id = p_session_id
    AND status = 'active';
    
    RETURN FOUND;
END;
$$;

-- ============================================================================
-- Helper Function: Cleanup Old Revoked Sessions
-- ============================================================================
-- Removes revoked sessions older than specified days (default 30)
-- Call this periodically via cron or manually for cleanup
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_sessions(
    p_days_old INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.user_sessions
    WHERE status = 'revoked'
    AND revoked_at < NOW() - (p_days_old || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_active_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_other_sessions(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_session_valid(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_activity(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_sessions(INTEGER) TO authenticated;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE public.user_sessions IS 'Tracks active user sessions for single-session enforcement';
COMMENT ON COLUMN public.user_sessions.session_id IS 'Unique session identifier generated on login';
COMMENT ON COLUMN public.user_sessions.status IS 'Session status: active or revoked';
COMMENT ON COLUMN public.user_sessions.device_info IS 'JSON metadata about device/browser';
COMMENT ON COLUMN public.user_sessions.last_activity_at IS 'Updated via heartbeat for activity tracking';

COMMENT ON FUNCTION public.get_active_session(UUID) IS 'Returns the active session for a user';
COMMENT ON FUNCTION public.revoke_other_sessions(UUID, TEXT) IS 'Revokes all sessions except the specified one';
COMMENT ON FUNCTION public.is_session_valid(UUID, TEXT) IS 'Validates if a session is active';
COMMENT ON FUNCTION public.update_session_activity(TEXT) IS 'Updates session last activity timestamp';
COMMENT ON FUNCTION public.cleanup_old_sessions(INTEGER) IS 'Removes old revoked sessions for maintenance';

-- ============================================================================
-- End of Schema
-- ============================================================================
