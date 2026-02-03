// ============================================================================
// Single Session Login API Endpoint
// ============================================================================
// Handles user login with single active session enforcement
// ============================================================================

import { createClient } from '@/lib/supabase/server';
import {
  createUserSession,
  generateSessionId,
  parseDeviceInfo,
  getClientIpAddress,
} from '@/lib/supabase/session-manager';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// ============================================================================
// POST /api/auth/single-session-login
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = await createClient();

    // Step 1: Authenticate with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !authData.user || !authData.session) {
      return NextResponse.json(
        { error: authError?.message || 'Authentication failed' },
        { status: 401 }
      );
    }

    const userId = authData.user.id;

    // Step 2: Generate unique session ID
    const sessionId = generateSessionId();

    // Step 3: Extract device and client information
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress = getClientIpAddress(request.headers);
    const deviceInfo = parseDeviceInfo(userAgent);

    // Step 4: Create new session and revoke all others
    const sessionResult = await createUserSession({
      userId,
      sessionId,
      deviceInfo,
      ipAddress,
      userAgent,
    });

    if (!sessionResult.success) {
      console.error('Failed to create session:', sessionResult.error);
      // Don't fail the login - session tracking is supplementary
      // The user is still authenticated via Supabase Auth
    }

    // Step 5: Store session ID in cookie
    const cookieStore = await cookies();
    cookieStore.set('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Step 6: Return success response
    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        user_metadata: authData.user.user_metadata,
      },
      sessionId,
    });
  } catch (error) {
    console.error('Error in single-session-login:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/auth/single-session-login (optional - check login status)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Get session ID from cookie
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      },
      hasSessionId: !!sessionId,
    });
  } catch (error) {
    console.error('Error checking login status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
