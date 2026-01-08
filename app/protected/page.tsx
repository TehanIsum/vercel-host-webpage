import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"

export default async function ProtectedPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/")
  }

  const handleSignOut = async () => {
    "use server"
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect("/")
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-b from-[#0f0f0f] to-[#1a1a1a] p-6">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white">Welcome!</h1>
          <p className="text-gray-400">You are logged in</p>
        </div>

        <div className="rounded-lg border border-[#333] bg-[#1f1f1f] p-6 space-y-4">
          <div className="space-y-2">
            <p className="text-gray-400">Email:</p>
            <p className="text-white font-semibold">{data.user.email}</p>
          </div>
          <div className="space-y-2">
            <p className="text-gray-400">User ID:</p>
            <p className="text-white font-mono text-sm break-all">{data.user.id}</p>
          </div>
        </div>

        <form action={handleSignOut}>
          <Button
            type="submit"
            className="w-full bg-gradient-to-br from-red-400 to-red-600 text-white hover:from-red-500 hover:to-red-700"
          >
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  )
}
