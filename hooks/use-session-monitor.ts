// ============================================================================
// Session Monitor Hook
// ============================================================================
// Client-side hook for monitoring session validity
// Detects when session has been revoked and forces logout
// ============================================================================

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ============================================================================
// Configuration
// ============================================================================

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const SESSION_CHECK_INTERVAL = 60000; // 60 seconds

// ============================================================================
// Hook: useSessionMonitor
// ============================================================================

export function useSessionMonitor() {
  const router = useRouter();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMonitoringRef = useRef(false);

  /**
   * Handles session revocation - logs out user and shows message
   */
  const handleSessionRevoked = useCallback(
    (message?: string) => {
      // Clear intervals
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }

      isMonitoringRef.current = false;

      // Perform logout
      const performLogout = async () => {
        try {
          // Call logout API to clean up session
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('Error during logout:', error);
        } finally {
          // Redirect to home with message
          const defaultMessage =
            'Your session ended because you logged in from another device.';
          router.push(
            `/?session_revoked=true&message=${encodeURIComponent(message || defaultMessage)}`
          );
          router.refresh();
        }
      };

      performLogout();
    },
    [router]
  );

  /**
   * Sends heartbeat to update session activity
   */
  const sendHeartbeat = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        
        // If session is invalid, handle revocation
        if (response.status === 401 && data.revoked) {
          handleSessionRevoked(data.message);
        }
      }
    } catch (error) {
      console.error('Heartbeat error:', error);
      // Don't force logout on network errors
    }
  }, [handleSessionRevoked]);

  /**
   * Validates the current session
   */
  const validateSession = useCallback(async () => {
    try {
      const supabase = createClient();
      
      // Check if user is authenticated
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // User is not authenticated, stop monitoring
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        if (sessionCheckIntervalRef.current) {
          clearInterval(sessionCheckIntervalRef.current);
          sessionCheckIntervalRef.current = null;
        }
        isMonitoringRef.current = false;
        return;
      }

      // Call heartbeat which will also validate session
      await sendHeartbeat();
    } catch (error) {
      console.error('Session validation error:', error);
    }
  }, [sendHeartbeat]);

  /**
   * Starts session monitoring
   */
  const startMonitoring = useCallback(() => {
    if (isMonitoringRef.current) return;

    isMonitoringRef.current = true;

    // Initial validation
    validateSession();

    // Set up heartbeat interval
    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat();
    }, HEARTBEAT_INTERVAL);

    // Set up session check interval
    sessionCheckIntervalRef.current = setInterval(() => {
      validateSession();
    }, SESSION_CHECK_INTERVAL);
  }, [validateSession, sendHeartbeat]);

  /**
   * Stops session monitoring
   */
  const stopMonitoring = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
      sessionCheckIntervalRef.current = null;
    }
    isMonitoringRef.current = false;
  }, []);

  /**
   * Initialize monitoring on mount and cleanup on unmount
   */
  useEffect(() => {
    startMonitoring();

    // Handle visibility change (when user switches tabs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // When tab becomes visible, validate session immediately
        validateSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      stopMonitoring();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startMonitoring, stopMonitoring, validateSession]);

  return {
    startMonitoring,
    stopMonitoring,
    validateSession,
  };
}
