import { NextRequest, NextResponse } from 'next/server';
import { generateUserToken } from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, butcherId, name, role } = body;

    if (!id || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name' },
        { status: 400 }
      );
    }

    // Generate JWT token
    const token = generateUserToken({
      id,
      butcherId: butcherId || id,
      name,
      role: role || 'butcher'
    });

    return NextResponse.json({
      success: true,
      token
    });
  } catch (error) {
    console.error('Error generating token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}

