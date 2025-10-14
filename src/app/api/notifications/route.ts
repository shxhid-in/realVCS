import { NextRequest, NextResponse } from 'next/server';

// In a real application, you would store this in a database
// For now, we'll use a simple in-memory store
let notifications: any[] = [];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      type,
      butcherId,
      butcherName,
      orderId,
      orderNumber,
      reason,
      timestamp,
      data
    } = body;

    // Validate required fields
    if (!type || !butcherId || !butcherName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create notification
    const notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      butcherId,
      butcherName,
      orderId: orderId || null,
      orderNumber: orderNumber || null,
      reason: reason || null,
      timestamp,
      data: data || null,
      read: false,
      createdAt: new Date().toISOString()
    };

    // Add to notifications
    notifications.push(notification);

    // In a real application, you would:
    // 1. Save to database
    // 2. Send email notification to admin
    // 3. Send push notification
    // 4. Send real-time notification via WebSocket


    return NextResponse.json({
      success: true,
      notificationId: notification.id,
      message: 'Notification created successfully'
    });

  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const read = searchParams.get('read');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Ensure notifications array is initialized
    if (!notifications) {
      notifications = [];
    }

    let filteredNotifications = notifications;

    // Filter by type if provided
    if (type) {
      filteredNotifications = filteredNotifications.filter(notif => notif.type === type);
    }

    // Filter by read status if provided
    if (read !== null) {
      const isRead = read === 'true';
      filteredNotifications = filteredNotifications.filter(notif => notif.read === isRead);
    }

    // Sort by creation date (newest first)
    filteredNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Limit results
    filteredNotifications = filteredNotifications.slice(0, limit);


    return NextResponse.json({
      success: true,
      notifications: filteredNotifications,
      total: filteredNotifications.length,
      unreadCount: notifications.filter(n => !n.read).length
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationId, read } = body;

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    // Find and update the notification
    const notificationIndex = notifications.findIndex(notif => notif.id === notificationId);
    
    if (notificationIndex === -1) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Update the notification
    notifications[notificationIndex] = {
      ...notifications[notificationIndex],
      read: read !== undefined ? read : notifications[notificationIndex].read,
      updatedAt: new Date().toISOString()
    };


    return NextResponse.json({
      success: true,
      message: 'Notification updated successfully'
    });

  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
