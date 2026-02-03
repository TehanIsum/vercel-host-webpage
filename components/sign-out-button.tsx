"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { getSessionToken, terminateSession } from "@/lib/session"

export function SignOutButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSignOut = async () => {
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
      
      // Redirect to home
      router.push("/")
      router.refresh()
    } catch (error) {
      console.error("Error signing out:", error)
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleSignOut}
      disabled={loading}
      className="w-full bg-gradient-to-br from-red-400 to-red-600 text-white hover:from-red-500 hover:to-red-700"
    >
      {loading ? "Signing out..." : "Sign Out"}
    </Button>
  )
}
