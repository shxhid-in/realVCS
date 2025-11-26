import { NextRequest } from 'next/server';
import { verifyUserToken, extractTokenFromHeader } from '@/lib/auth/jwt';
import { addConnection, removeConnection } from '@/lib/sseConnectionManager';
import { getAllOrdersFromCache } from '@/lib/orderCache';

/**
 * GET /api/orders/stream
 * Server-Sent Events endpoint for real-time order updates
 * 
 * Security:
 * - Requires JWT authentication
 * - Validates user has access to requested butcher
 * - Connection limits per user/butcher
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    // Note: EventSource doesn't support custom headers, so token is passed in query string
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const token = searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }

    const user = verifyUserToken(token);
    if (!user) {
      return new Response('Invalid token', { status: 401 });
    }

    // 2. Authorization - Get butcher ID from query params
    const requestedButcherId = searchParams.get('butcherId');

    if (!requestedButcherId) {
      return new Response('Butcher ID required', { status: 400 });
    }

    // Verify user has access to this butcher
    // Admin users can access any butcher's stream, regular users can only access their own
    if (user.butcherId !== requestedButcherId && user.role !== 'admin') {
      return new Response('Forbidden', { status: 403 });
    }

    // 3. Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        // Add connection (with security checks)
        const connectionAdded = addConnection(
          requestedButcherId,
          user.id || user.butcherId,
          controller
        );

        if (!connectionAdded) {
          controller.close();
          return;
        }

        // Send initial connection message
        const initialMessage = `data: ${JSON.stringify({ type: 'connected', butcherId: requestedButcherId })}\n\n`;
        controller.enqueue(new TextEncoder().encode(initialMessage));

        // Send existing cached orders immediately
        const cachedOrders = getAllOrdersFromCache(requestedButcherId);
        if (cachedOrders.length > 0) {
          const ordersMessage = `data: ${JSON.stringify({ 
            type: 'initial-orders', 
            orders: cachedOrders 
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(ordersMessage));
        }

        // Keep-alive ping every 30 seconds
        const keepAliveInterval = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(': keep-alive\n\n'));
          } catch (error) {
            // Connection closed
            clearInterval(keepAliveInterval);
          }
        }, 30000);

        // Cleanup on connection close
        request.signal.addEventListener('abort', () => {
          clearInterval(keepAliveInterval);
          removeConnection(
            requestedButcherId,
            user.id || user.butcherId,
            controller
          );
          try {
            controller.close();
          } catch (error) {
            // Controller might already be closed
          }
        });
      }
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'Access-Control-Allow-Origin': '*', // Adjust for production
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  } catch (error: any) {
    console.error('[SSE] Error creating stream:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

