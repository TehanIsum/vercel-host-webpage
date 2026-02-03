"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { LoginDialog } from "@/components/login-dialog"
import { SignUpDialog } from "@/components/signup-dialog"
import { createClient } from "@/lib/supabase/client"

const AnimatedNavLink = ({ href, children, isActive }: { href: string; children: React.ReactNode; isActive: boolean }) => {
  const defaultTextColor = isActive ? "text-white" : "text-gray-300"
  const hoverTextColor = "text-white"
  const textSizeClass = "text-sm"

  return (
    <a href={href} className={`group relative inline-block overflow-hidden h-5 flex items-center ${textSizeClass}`}>
      <div className="flex flex-col transition-transform duration-400 ease-out transform group-hover:-translate-y-1/2">
        <span className={`${defaultTextColor} ${isActive ? 'font-bold' : ''}`}>{children}</span>
        <span className={hoverTextColor}>{children}</span>
      </div>
      {isActive && (
        <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 to-blue-600 shadow-lg shadow-blue-400/50"></span>
      )}
    </a>
  )
}

export function Navbar() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [headerShapeClass, setHeaderShapeClass] = useState("rounded-full")
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const [signupDialogOpen, setSignupDialogOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const shapeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Check user authentication status
  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    checkUser()
  }, [loginDialogOpen, signupDialogOpen])

  // Check URL parameters for login/signup triggers
  useEffect(() => {
    if (searchParams.get("login") === "true") {
      setLoginDialogOpen(true)
    }
    if (searchParams.get("signup") === "true") {
      setSignupDialogOpen(true)
    }
  }, [searchParams])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      setUser(null)
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  const toggleMenu = () => {
    setIsOpen(!isOpen)
  }

  useEffect(() => {
    if (shapeTimeoutRef.current) {
      clearTimeout(shapeTimeoutRef.current)
    }

    if (isOpen) {
      setHeaderShapeClass("rounded-xl")
    } else {
      shapeTimeoutRef.current = setTimeout(() => {
        setHeaderShapeClass("rounded-full")
      }, 300)
    }

    return () => {
      if (shapeTimeoutRef.current) {
        clearTimeout(shapeTimeoutRef.current)
      }
    }
  }, [isOpen])

  const logoElement = (
    <a href="/" className="relative w-6 h-6 flex items-center justify-center">
      <div className="absolute inset-0 border border-gray-300 rounded-sm opacity-60"></div>
      <div className="absolute w-2 h-2 bg-blue-400 rounded-full top-1 left-1"></div>
      <div className="absolute w-1 h-1 bg-gray-300 rounded-full top-1 right-1"></div>
      <div className="absolute w-1 h-1 bg-gray-300 rounded-full bottom-1 left-1"></div>
      <div className="absolute w-2 h-0.5 bg-gray-300 bottom-1.5 right-1"></div>
      <span className="absolute text-xs font-bold text-white">AI</span>
    </a>
  )

  const navLinksData = [
    { label: "Home", href: "/" },
    { label: "Services", href: "/#services" },
    { label: "Case Studies", href: "/#testimonials" },
    { label: "Blogs", href: "/blogs" },
  ]

  const isLinkActive = (href: string) => {
    if (href === "/") {
      return pathname === "/"
    }
    if (href.startsWith("/#")) {
      return pathname === "/" && (typeof window !== "undefined" && window.location.hash === href.substring(1))
    }
    return pathname?.startsWith(href)
  }

  const loginButtonElement = user ? (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="px-4 py-2 sm:px-3 text-xs sm:text-sm border border-[#333] bg-[rgba(31,31,31,0.62)] text-gray-300 rounded-full hover:border-red-500/50 hover:text-red-400 transition-colors duration-200 w-full sm:w-auto disabled:opacity-50"
    >
      {isLoggingOut ? 'Logging out...' : 'Log Out'}
    </button>
  ) : (
    <button
      onClick={() => setLoginDialogOpen(true)}
      className="px-4 py-2 sm:px-3 text-xs sm:text-sm border border-[#333] bg-[rgba(31,31,31,0.62)] text-gray-300 rounded-full hover:border-white/50 hover:text-white transition-colors duration-200 w-full sm:w-auto"
    >
      Log In
    </button>
  )

  const signupButtonElement = user ? null : (
    <div className="relative group w-full sm:w-auto">
      <div
        className="absolute inset-0 -m-2 rounded-full
                     hidden sm:block
                     bg-blue-400
                     opacity-40 filter blur-lg pointer-events-none
                     transition-all duration-300 ease-out
                     group-hover:opacity-60 group-hover:blur-xl group-hover:-m-3"
      ></div>
      <button
        onClick={() => setSignupDialogOpen(true)}
        className="relative z-10 px-4 py-2 sm:px-3 text-xs sm:text-sm font-semibold text-white bg-gradient-to-br from-blue-400 to-blue-600 rounded-full hover:from-blue-500 hover:to-blue-700 transition-all duration-200 w-full sm:w-auto"
      >
        Sign Up
      </button>
    </div>
  )

  return (
    <>
      <header
        className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-20
                         flex flex-col items-center
                         pl-6 pr-6 py-3 backdrop-blur-sm
                         ${headerShapeClass}
                         border border-[#333] bg-[#1f1f1f57]
                         w-[calc(100%-2rem)] sm:w-auto
                         transition-[border-radius] duration-0 ease-in-out`}
      >
        <div className="flex items-center justify-between w-full gap-x-6 sm:gap-x-8">
          <div className="flex items-center">{logoElement}</div>

          <nav className="hidden sm:flex items-center space-x-4 sm:space-x-6 text-sm">
            {navLinksData.map((link) => (
              <AnimatedNavLink key={link.href} href={link.href} isActive={isLinkActive(link.href)}>
                {link.label}
              </AnimatedNavLink>
            ))}
          </nav>

          <div className="hidden sm:flex items-center gap-2 sm:gap-3">
            {loginButtonElement}
            {signupButtonElement}
          </div>

          <button
            className="sm:hidden flex items-center justify-center w-8 h-8 text-gray-300 focus:outline-none"
            onClick={toggleMenu}
            aria-label={isOpen ? "Close Menu" : "Open Menu"}
          >
            {isOpen ? (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12M6 12h12"
                ></path>
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            )}
          </button>
        </div>

        <div
          className={`sm:hidden flex flex-col items-center w-full transition-all ease-in-out duration-300 overflow-hidden
                         ${isOpen ? "max-h-[1000px] opacity-100 pt-4" : "max-h-0 opacity-0 pt-0 pointer-events-none"}`}
        >
          <nav className="flex flex-col items-center space-y-4 text-base w-full">
            {navLinksData.map((link) => {
              const isActive = isLinkActive(link.href)
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`transition-colors w-full text-center relative ${
                    isActive ? "text-white font-bold" : "text-gray-300 hover:text-white"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute inset-0 bg-blue-400/10 rounded-md -z-10 border border-blue-400/30"></span>
                  )}
                </a>
              )
            })}
          </nav>
          <div className="flex flex-col items-center space-y-4 mt-4 w-full">
            {loginButtonElement}
            {signupButtonElement}
          </div>
        </div>
      </header>

      <LoginDialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen} />
      <SignUpDialog open={signupDialogOpen} onOpenChange={setSignupDialogOpen} />
    </>
  )
}
