import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// ============================================================================
// Session Validation Middleware
// ============================================================================
// Validates that the user's session is still the active session
// Enforces single active session policy across all requests
// ============================================================================

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Skip session validation for public routes and auth endpoints
  const isPublicRoute = 
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/terms") ||
    request.nextUrl.pathname.startsWith("/privacy") ||
    request.nextUrl.pathname.startsWith("/api/auth/single-session-login") ||
    request.nextUrl.pathname.startsWith("/api/auth/logout") ||
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/public");

  // If user is authenticated and not on a public route, validate session
  if (user && !isPublicRoute) {
    const sessionId = request.cookies.get('session_id')?.value;

    // If no session ID in cookie, force logout
    if (!sessionId) {
      console.log('No session ID found for authenticated user, forcing logout');
      return createLogoutResponse(request, 'Session expired. Please log in again.');
    }

    // Validate session is still active
    try {
      const { data: isValid, error } = await supabase.rpc('is_session_valid', {
        p_user_id: user.id,
        p_session_id: sessionId,
      });

      // If session is invalid/revoked, force logout
      if (error || !isValid) {
        console.log('Invalid session detected, forcing logout:', { userId: user.id, sessionId });
        return createLogoutResponse(
          request, 
          'Session expired. You have been logged in from another device.'
        );
      }
    } catch (error) {
      console.error('Error validating session in middleware:', error);
      // On error, allow request to proceed but log the issue
      // This prevents blocking users due to temporary database issues
    }
  }

  // Redirect to login if accessing protected routes without auth
  if (request.nextUrl.pathname.startsWith("/protected") && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.searchParams.set('message', 'Please log in to access this page')
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a logout response that clears cookies and redirects to home
 */
function createLogoutResponse(request: NextRequest, message: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set('session_revoked', 'true');
  url.searchParams.set('message', message);

  const response = NextResponse.redirect(url);
  
  // Clear session cookie
  response.cookies.delete('session_id');
  
  // Clear Supabase auth cookies
  const cookiesToClear = request.cookies.getAll()
    .filter(cookie => cookie.name.startsWith('sb-'))
    .map(cookie => cookie.name);
  
  cookiesToClear.forEach(cookieName => {
    response.cookies.delete(cookieName);
  });

  return response;
}
