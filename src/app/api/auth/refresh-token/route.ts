import { NextRequest, NextResponse } from 'next/server';
import { generateUserToken, verifyUserToken } from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token required' },
        { status: 400 }
      );
    }

    // Verify token (even if expired)
    const decoded = verifyUserToken(token, true); // Allow expired
    
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Generate new token
    const newToken = generateUserToken({
      id: decoded.id,
      butcherId: decoded.butcherId,
      name: decoded.name,
      role: decoded.role || 'butcher'
    });

    return NextResponse.json({
      success: true,
      token: newToken
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}

