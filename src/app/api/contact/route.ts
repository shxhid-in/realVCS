import { NextRequest, NextResponse } from 'next/server';
import { saveSupportRequest, getSupportRequests, updateSupportRequest, deleteSupportRequest } from '../../../lib/supportSheets';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      butcherId,
      butcherName,
      message,
      packingRequests,
      timestamp,
      type
    } = body;

    // Validate required fields
    if (!butcherId || !butcherName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create support request
    const supportRequest = {
      butcherId,
      butcherName,
      message: message || null,
      packingRequests: packingRequests || null,
      timestamp,
      type: type || 'general_contact',
      status: 'pending' as const,
      adminResponse: null
    };

    // Save to Google Sheets
    const requestId = await saveSupportRequest(supportRequest);


    return NextResponse.json({
      success: true,
      requestId,
      message: 'Support request submitted successfully'
    });

  } catch (error) {
    console.error('Error processing contact request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const butcherId = searchParams.get('butcherId');

    // Get support requests from Google Sheets
    let requests = await getSupportRequests(butcherId || undefined);

    // Filter by status if provided
    const status = searchParams.get('status');
    if (status) {
      requests = requests.filter(req => req.status === status);
    }

    return NextResponse.json({
      success: true,
      requests,
      total: requests.length
    });

  } catch (error) {
    console.error('Error fetching support requests:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, status, adminResponse } = body;

    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      );
    }

    // Update the request in Google Sheets
    await updateSupportRequest(requestId, {
      status: status || undefined,
      adminResponse: adminResponse || undefined
    });


    return NextResponse.json({
      success: true,
      message: 'Support request updated successfully'
    });

  } catch (error) {
    console.error('Error updating support request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('requestId');

    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      );
    }

    // Delete the request from Google Sheets
    await deleteSupportRequest(requestId);


    return NextResponse.json({
      success: true,
      message: 'Support request deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting support request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
