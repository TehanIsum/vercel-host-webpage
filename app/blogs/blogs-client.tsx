"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface BlogsClientProps {
  username: string
}

export function BlogsClient({ username }: BlogsClientProps) {
  const [logoutMessage, setLogoutMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSignOut = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      
      setLogoutMessage("Successfully logged out!")
      setTimeout(() => {
        router.push("/")
        router.refresh()
      }, 1500)
    } catch (error) {
      console.error("Error signing out:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-white">
          Welcome back, {username}! 👋
        </h2>
      </div>

      <div className="fixed bottom-8 right-8 z-10 flex flex-col items-end gap-3">
        {logoutMessage && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg animate-pulse">
            <p className="text-green-400 text-center font-medium">{logoutMessage}</p>
          </div>
        )}
        <Button
          onClick={handleSignOut}
          disabled={loading}
          variant="outline"
          className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {loading ? "Signing out..." : "Sign Out"}
        </Button>
      </div>
    </>
  )
}
