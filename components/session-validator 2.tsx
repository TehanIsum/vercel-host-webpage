"use client"

import { useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  getSessionToken,
  validateAndRefreshSession,
  clearSessionToken,
  cleanupExpiredSessions,
} from "@/lib/session"

/**
 * Session Validator Component
 * 
 * Responsibilities:
 * - Validates session on every protected page
 * - Refreshes session activity (sliding 20-minute timeout)
 * - Forces logout if session becomes inactive
 * - Runs validation every 2 minutes
 */
export function SessionValidator() {
  const router = useRouter()
  const pathname = usePathname()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isValidatingRef = useRef(false)

  useEffect(() => {
    // Only validate on protected routes
    const protectedRoutes = ['/blogs', '/protected']
    const isProtectedRoute = protectedRoutes.some(route => pathname?.startsWith(route))
    
    if (!isProtectedRoute) return

    /**
     * Validate and refresh the current session
     */
    const validateSession = async () => {
      // Prevent concurrent validation
      if (isValidatingRef.current) return
      isValidatingRef.current = true

      try {
        const supabase = createClient()
        
        // Check Supabase auth
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          // No Supabase auth - logout
          clearSessionToken()
          await supabase.auth.signOut()
          router.push("/?login=true")
          return
        }

        // Get app session token
        const sessionToken = getSessionToken()
        
        if (!sessionToken) {
          // No app session - logout
          await supabase.auth.signOut()
          router.push("/?login=true")
          return
        }

        // Validate and refresh session
        const result = await validateAndRefreshSession(sessionToken)
        
        if (!result.success) {
          // Session invalid or expired - logout
          clearSessionToken()
          await supabase.auth.signOut()
          router.push("/?login=true")
          return
        }

        // Session is valid and refreshed
        // Clean up expired sessions periodically
        await cleanupExpiredSessions()
        
      } catch (error) {
        console.error('Session validation error:', error)
      } finally {
        isValidatingRef.current = false
      }
    }

    // Validate immediately on mount
    validateSession()

    // Set up interval to validate every 2 minutes
    intervalRef.current = setInterval(validateSession, 2 * 60 * 1000)

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [router, pathname])

  // Listen for Supabase auth state changes
  useEffect(() => {
    const supabase = createClient()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        clearSessionToken()
        router.push("/?login=true")
      }
      
      if (event === 'SIGNED_IN' && session?.user) {
        // Validate session when signed in
        const sessionToken = getSessionToken()
        if (sessionToken) {
          await validateAndRefreshSession(sessionToken)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  return null
}
