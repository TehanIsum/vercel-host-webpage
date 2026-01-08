"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SignUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignUpDialog({ open, onOpenChange }: SignUpDialogProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)

    try {
      // Add your sign-up API call here
      console.log("Sign-up attempt:", { email, password })
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      onOpenChange(false)
    } catch (err) {
      setError("Sign-up failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-[#1f1f1f] border-[#333]">
        <DialogHeader>
          <DialogTitle className="text-white">Sign Up</DialogTitle>
          <DialogDescription className="text-gray-400">
            Create an account to get started with AI Products by Tehan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signup-email" className="text-gray-300">
              Email
            </Label>
            <Input
              id="signup-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password" className="text-gray-300">
              Password
            </Label>
            <Input
              id="signup-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-gray-300">
              Confirm Password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-500"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-br from-blue-400 to-blue-600 text-white hover:from-blue-500 hover:to-blue-700"
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
