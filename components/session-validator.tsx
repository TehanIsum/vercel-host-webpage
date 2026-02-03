"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { 
  getSessionToken, 
  validateSession, 
  updateSessionActivity,
  subscribeToSessionChanges,
  clearSessionToken,
  terminateSession
} from "@/lib/session"

// ============================================================================
// Activity Tracking Configuration
// ============================================================================

const ACTIVITY_EVENTS = ['mousemove', 'keypress', 'touchstart', 'scroll', 'click']
const ACTIVITY_DEBOUNCE_MS = 30000 // Update DB every 30 seconds max
const VALIDATION_INTERVAL_MS = 60000 // Check session every 60 seconds
const IDLE_WARNING_TIME = 18 * 60 * 1000 // 18 minutes (2 min before timeout)

// ============================================================================
// Session Validator Component
// ============================================================================

export function SessionValidator() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(false)
  const [showIdleWarning, setShowIdleWarning] = useState(false)
  const lastActivityRef = useRef<number>(Date.now())
  const activityTimerRef = useRef<NodeJS.Timeout | null>(null)
  const validationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const idleWarningTimerRef = useRef<NodeJS.Timeout | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // ============================================================================
  // Force Logout
  // ============================================================================

  const forceLogout = async (reason: string) => {
    console.log('Force logout:', reason)
    
    // Get session token before clearing
    const sessionToken = getSessionToken()
    
    // Terminate session in database if token exists and reason is manual logout
    if (sessionToken && !reason.includes('expired') && !reason.includes('terminated')) {
      const result = await terminateSession(sessionToken)
      if (!result.success) {
        console.error("Failed to terminate session:", result.error)
      }
    } else {
      // Just clear the token (session already marked expired/terminated in DB)
      clearSessionToken()
    }
    
    // Sign out from Supabase
    const supabase = createClient()
    await supabase.auth.signOut()
    
    // Show alert
    alert(`You have been logged out: ${reason}`)
    
    // Redirect to home
    window.location.href = "/"
  }

  // ============================================================================
  // Activity Tracking
  // ============================================================================

  const updateActivity = async () => {
    const sessionToken = getSessionToken()
    if (!sessionToken) return
    
    // Reset idle warning
    setShowIdleWarning(false)
    
    // Update last activity timestamp
    lastActivityRef.current = Date.now()
    
    // Update in database (debounced)
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current)
    }
    
    activityTimerRef.current = setTimeout(async () => {
      const result = await updateSessionActivity(sessionToken)
      if (!result.success) {
        console.error('Failed to update activity:', result.error)
      }
    }, ACTIVITY_DEBOUNCE_MS)
    
    // Reset idle warning timer
    if (idleWarningTimerRef.current) {
      clearTimeout(idleWarningTimerRef.current)
    }
    
    idleWarningTimerRef.current = setTimeout(() => {
      setShowIdleWarning(true)
    }, IDLE_WARNING_TIME)
  }

  // ============================================================================
  // Session Validation
  // ============================================================================

  const validateCurrentSession = async () => {
    if (isChecking) return
    
    const sessionToken = getSessionToken()
    if (!sessionToken) return
    
    setIsChecking(true)
    
    try {
      const result = await validateSession(sessionToken)
      
      if (!result.valid) {
        await forceLogout(result.reason || 'Session invalid')
      }
    } catch (error) {
      console.error('Error validating session:', error)
    } finally {
      setIsChecking(false)
    }
  }

  // ============================================================================
  // Setup & Cleanup
  // ============================================================================

  useEffect(() => {
    const sessionToken = getSessionToken()
    if (!sessionToken) return
    
    // Initial activity timestamp
    lastActivityRef.current = Date.now()
    
    // Setup activity listeners
    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, updateActivity)
    })
    
    // Setup periodic validation
    validationTimerRef.current = setInterval(validateCurrentSession, VALIDATION_INTERVAL_MS)
    
    // Setup idle warning timer
    idleWarningTimerRef.current = setTimeout(() => {
      setShowIdleWarning(true)
    }, IDLE_WARNING_TIME)
    
    // Subscribe to realtime session changes
    unsubscribeRef.current = subscribeToSessionChanges(sessionToken, () => {
      forceLogout('Your session was terminated on another device')
    })
    
    // Initial validation
    validateCurrentSession()
    
    // Cleanup
    return () => {
      // Remove event listeners
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, updateActivity)
      })
      
      // Clear timers
      if (activityTimerRef.current) {
        clearTimeout(activityTimerRef.current)
      }
      if (validationTimerRef.current) {
        clearInterval(validationTimerRef.current)
      }
      if (idleWarningTimerRef.current) {
        clearTimeout(idleWarningTimerRef.current)
      }
      
      // Unsubscribe from realtime
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [])

  // ============================================================================
  // Render Idle Warning
  // ============================================================================

  if (showIdleWarning) {
    return (
      <div className="fixed bottom-4 right-4 bg-yellow-500 text-black p-4 rounded-lg shadow-lg z-50 max-w-sm">
        <p className="font-semibold">⚠️ Idle Warning</p>
        <p className="text-sm mt-1">
          You will be automatically logged out in 2 minutes due to inactivity.
        </p>
        <button
          onClick={() => {
            updateActivity()
            setShowIdleWarning(false)
          }}
          className="mt-2 bg-black text-yellow-500 px-4 py-1 rounded text-sm font-medium"
        >
          I'm still here
        </button>
      </div>
    )
  }

  return null
}
