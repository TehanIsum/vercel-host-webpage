// ============================================================================
// Logout API Endpoint
// ============================================================================
// Handles user logout with session cleanup
// Revokes the active session and signs out from Supabase Auth
// ============================================================================

import { createClient } from '@/lib/supabase/server';
import { revokeSession } from '@/lib/supabase/session-manager';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// ============================================================================
// POST /api/auth/logout
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Get session ID from cookie
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;

    // Step 1: Revoke session in database (if exists)
    if (user && sessionId) {
      const revoked = await revokeSession(user.id, sessionId);
      if (!revoked) {
        console.error('Failed to revoke session:', { userId: user.id, sessionId });
        // Continue with logout even if revocation fails
      }
    }

    // Step 2: Sign out from Supabase Auth
    if (user) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error('Error signing out from Supabase:', signOutError);
        // Continue even if sign out fails
      }
    }

    // Step 3: Clear session cookie
    cookieStore.delete('session_id');

    // Step 4: Clear all Supabase auth cookies
    const allCookies = cookieStore.getAll();
    allCookies.forEach((cookie) => {
      if (cookie.name.startsWith('sb-')) {
        cookieStore.delete(cookie.name);
      }
    });

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Error in logout endpoint:', error);
    
    // Even on error, try to clear cookies
    try {
      const cookieStore = await cookies();
      cookieStore.delete('session_id');
      
      const allCookies = cookieStore.getAll();
      allCookies.forEach((cookie) => {
        if (cookie.name.startsWith('sb-')) {
          cookieStore.delete(cookie.name);
        }
      });
    } catch (cookieError) {
      console.error('Error clearing cookies:', cookieError);
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Logout error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/auth/logout (alternative for simple logout links)
// ============================================================================

export async function GET(request: NextRequest) {
  // Redirect to POST handler by returning a response that instructs client
  return NextResponse.json(
    {
      error: 'Method not allowed',
      message: 'Please use POST method for logout',
    },
    { status: 405 }
  );
}
