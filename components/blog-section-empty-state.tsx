"use client"

import { Button } from "@/components/ui/button"
import { SignUpDialog } from "@/components/signup-dialog"
import { ArrowRight } from "lucide-react"
import { useState } from "react"

interface BlogSectionEmptyStateProps {
  onSignUpClick?: () => void
}

export function BlogSectionEmptyState({ onSignUpClick }: BlogSectionEmptyStateProps) {
  const [signupDialogOpen, setSignupDialogOpen] = useState(false)

  const handleGetStarted = () => {
    if (onSignUpClick) {
      onSignUpClick()
    } else {
      setSignupDialogOpen(true)
    }
  }

  return (
    <>
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">No blog posts yet. Sign up to be the first to share your insights!</p>
        <Button
          size="lg"
          className="bg-white text-black hover:bg-gray-100 mt-6"
          onClick={handleGetStarted}
        >
          Get Started
        </Button>
      </div>
      <SignUpDialog open={signupDialogOpen} onOpenChange={setSignupDialogOpen} />
    </>
  )
}
