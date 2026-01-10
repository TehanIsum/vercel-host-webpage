"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { validateSriLankanNIC, validateNICMatch, formatDateForInput } from "@/lib/nic-validator"

interface SignUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignUpDialog({ open, onOpenChange }: SignUpDialogProps) {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [nic, setNic] = useState("")
  const [birthdate, setBirthdate] = useState("")
  const [gender, setGender] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [nicError, setNicError] = useState("")
  const [birthdateError, setBirthdateError] = useState("")
  const [genderError, setGenderError] = useState("")

  // Validate NIC format when it changes
  useEffect(() => {
    if (nic.length >= 10) {
      const nicInfo = validateSriLankanNIC(nic)
      if (!nicInfo.isValid) {
        setNicError(nicInfo.errorMessage || "Invalid NIC")
      } else {
        setNicError("")
      }
    } else if (nic.length > 0) {
      setNicError("NIC must be at least 10 characters")
    } else {
      setNicError("")
    }
  }, [nic])

  // Validate birthdate matches NIC when either changes
  useEffect(() => {
    if (nic.length >= 10 && birthdate) {
      const nicInfo = validateSriLankanNIC(nic)
      if (nicInfo.isValid && nicInfo.birthDate) {
        const nicMatch = validateNICMatch(nic, birthdate, gender || 'male')
        if (!nicMatch.isValid && nicMatch.errorMessage?.includes('Birth date')) {
          setBirthdateError(nicMatch.errorMessage)
        } else {
          setBirthdateError("")
        }
      }
    } else {
      setBirthdateError("")
    }
  }, [nic, birthdate, gender])

  // Validate gender matches NIC when either changes
  useEffect(() => {
    if (nic.length >= 10 && gender) {
      const nicInfo = validateSriLankanNIC(nic)
      if (nicInfo.isValid && nicInfo.gender) {
        const nicMatch = validateNICMatch(nic, birthdate || '2000-01-01', gender)
        if (!nicMatch.isValid && nicMatch.errorMessage?.includes('Gender')) {
          setGenderError(nicMatch.errorMessage)
        } else {
          setGenderError("")
        }
      }
    } else {
      setGenderError("")
    }
  }, [nic, gender, birthdate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccessMessage("")

    // Validate username
    if (!username || username.length < 3) {
      setError("Username must be at least 3 characters long.")
      return
    }

    // Validate NIC
    const nicValidation = validateSriLankanNIC(nic)
    if (!nicValidation.isValid) {
      setError(nicValidation.errorMessage || "Invalid NIC")
      return
    }

    // Validate birthdate is provided
    if (!birthdate) {
      setError("Birth date is required.")
      return
    }

    // Validate gender is provided
    if (!gender) {
      setError("Gender is required.")
      return
    }

    // Validate NIC matches birthdate and gender
    const nicMatch = validateNICMatch(nic, birthdate, gender)
    if (!nicMatch.isValid) {
      setError(nicMatch.errorMessage || "Birth date or gender does not match NIC")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.")
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            nic,
            birthdate,
            gender,
          },
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/`,
        },
      })

      if (authError) {
        setError(authError.message || "Sign-up failed. Please try again.")
        return
      }

      setSuccessMessage("Sign-up successful! Please check your email to confirm your account.")
      setUsername("")
      setEmail("")
      setNic("")
      setBirthdate("")
      setGender("")
      setPassword("")
      setConfirmPassword("")
      setTimeout(() => {
        onOpenChange(false)
        setSuccessMessage("")
      }, 3000)
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
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
            <Label htmlFor="signup-username" className="text-gray-300">
              Username
            </Label>
            <Input
              id="signup-username"
              type="text"
              placeholder="johndoe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-500"
            />
          </div>
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
            <Label htmlFor="signup-nic" className="text-gray-300">
              NIC Number
            </Label>
            <Input
              id="signup-nic"
              type="text"
              placeholder="200012345678 or 991234567V"
              value={nic}
              onChange={(e) => setNic(e.target.value.toUpperCase())}
              required
              className="bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-500"
            />
            {nicError && <p className="text-yellow-500 text-xs mt-1">{nicError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-birthdate" className="text-gray-300">
              Birth Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="signup-birthdate"
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              required
              className="bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-500"
            />
            {birthdateError && <p className="text-red-500 text-xs mt-1">{birthdateError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-gender" className="text-gray-300">
              Gender <span className="text-red-500">*</span>
            </Label>
            <select
              id="signup-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#333] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            {genderError && <p className="text-red-500 text-xs mt-1">{genderError}</p>}
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
          {successMessage && <p className="text-green-500 text-sm">{successMessage}</p>}
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
