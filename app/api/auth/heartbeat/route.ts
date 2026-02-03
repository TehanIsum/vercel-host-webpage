// ============================================================================
// Session Heartbeat API Endpoint
// ============================================================================
// Updates session activity and validates session is still active
// Called periodically by client-side session monitor
// ============================================================================

import { createClient } from '@/lib/supabase/server';
import {
  validateSession,
  updateSessionActivity,
} from '@/lib/supabase/session-manager';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// ============================================================================
// POST /api/auth/heartbeat
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // If not authenticated, return error
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated', revoked: false },
        { status: 401 }
      );
    }

    // Get session ID from cookie
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;

    // If no session ID, session is invalid
    if (!sessionId) {
      return NextResponse.json(
        {
          error: 'No session ID found',
          revoked: true,
          message: 'Your session has expired. Please log in again.',
        },
        { status: 401 }
      );
    }

    // Validate session is still active
    const validationResult = await validateSession(user.id, sessionId);

    if (!validationResult.isValid) {
      // Session was revoked or is invalid
      return NextResponse.json(
        {
          error: 'Session invalid',
          revoked: true,
          reason: validationResult.reason,
          message:
            validationResult.message ||
            'Your session ended because you logged in from another device.',
        },
        { status: 401 }
      );
    }

    // Session is valid - update activity timestamp
    const activityUpdated = await updateSessionActivity(sessionId);

    if (!activityUpdated) {
      console.error('Failed to update session activity:', { userId: user.id, sessionId });
      // Don't fail the heartbeat if activity update fails
    }

    // Return success
    return NextResponse.json({
      success: true,
      message: 'Session is active',
      userId: user.id,
      sessionId,
    });
  } catch (error) {
    console.error('Error in heartbeat endpoint:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        revoked: false,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/auth/heartbeat (optional - for testing)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;

    return NextResponse.json({
      authenticated: !!user,
      userId: user?.id,
      hasSessionId: !!sessionId,
      sessionId: sessionId || null,
    });
  } catch (error) {
    console.error('Error in heartbeat GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
