"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { LogOut, Loader2 } from "lucide-react"
import { getSessionToken, terminateSession } from "@/lib/session"

interface LogoutButtonProps {
  variant?: "default" | "ghost" | "outline"
  size?: "default" | "sm" | "lg"
  className?: string
}

export function LogoutButton({ variant = "outline", size = "default", className }: LogoutButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    
    try {
      // Get current session token
      const sessionToken = getSessionToken()
      
      // Terminate session in database first (if token exists)
      if (sessionToken) {
        const result = await terminateSession(sessionToken)
        if (!result.success) {
          console.error("Failed to terminate session:", result.error)
        }
      }
      
      // Sign out from Supabase Auth
      const supabase = createClient()
      await supabase.auth.signOut()
      
      // Redirect to home page
      window.location.href = "/"
      
    } catch (error) {
      console.error("Logout error:", error)
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleLogout}
      disabled={loading}
      variant={variant}
      size={size}
      className={className}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Logging out...
        </>
      ) : (
        <>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </>
      )}
    </Button>
  )
}
