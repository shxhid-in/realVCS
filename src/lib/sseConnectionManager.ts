/**
 * SSE Connection Manager
 * Manages Server-Sent Events connections for real-time order updates
 * Security: Authentication, authorization, connection limits
 */

import type { Order } from './types';

// Connection type: ReadableStreamController for SSE
type SSEConnection = {
  controller: ReadableStreamDefaultController;
  butcherId: string;
  userId: string;
  connectedAt: Date;
};

// Track all active connections: butcherId → Set of connections
const connections = new Map<string, Set<SSEConnection>>();

// Track connections per user: userId → Set of connections
const userConnections = new Map<string, Set<SSEConnection>>();

// Connection limits
const MAX_CONNECTIONS_PER_USER = 3;
const MAX_CONNECTIONS_PER_BUTCHER = 50; // Safety limit

/**
 * Clean up stale connections for a specific user (older than 1 minute)
 */
function cleanupStaleConnectionsForUser(userId: string): void {
  const userConnSet = userConnections.get(userId);
  if (!userConnSet) return;
  
  const now = new Date();
  const staleThreshold = 60000; // 1 minute
  
  for (const conn of userConnSet) {
    const age = now.getTime() - conn.connectedAt.getTime();
    if (age > staleThreshold) {
      // Remove stale connection
      const butcherConnSet = connections.get(conn.butcherId);
      if (butcherConnSet) {
        butcherConnSet.delete(conn);
        if (butcherConnSet.size === 0) {
          connections.delete(conn.butcherId);
        }
      }
      userConnSet.delete(conn);
    }
  }
  
  if (userConnSet.size === 0) {
    userConnections.delete(userId);
  }
}

/**
 * Add a new SSE connection
 */
export function addConnection(
  butcherId: string,
  userId: string,
  controller: ReadableStreamDefaultController
): boolean {
  // ✅ FIX: Clean up stale connections before checking limit
  cleanupStaleConnectionsForUser(userId);
  
  // Check user connection limit
  const userConnSet = userConnections.get(userId) || new Set();
  if (userConnSet.size >= MAX_CONNECTIONS_PER_USER) {
    // Try to remove the oldest connection to make room
    if (userConnSet.size > 0) {
      const connectionsArray = Array.from(userConnSet);
      connectionsArray.sort((a, b) => a.connectedAt.getTime() - b.connectedAt.getTime());
      const oldest = connectionsArray[0];
      removeConnection(oldest.butcherId, userId, oldest.controller);
    } else {
      return false;
    }
  }

  // Check butcher connection limit
  const butcherConnSet = connections.get(butcherId) || new Set();
  if (butcherConnSet.size >= MAX_CONNECTIONS_PER_BUTCHER) {
    return false;
  }

  // Create connection object
  const connection: SSEConnection = {
    controller,
    butcherId,
    userId,
    connectedAt: new Date()
  };

  // Add to butcher connections
  if (!connections.has(butcherId)) {
    connections.set(butcherId, new Set());
  }
  connections.get(butcherId)!.add(connection);

  // Add to user connections
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId)!.add(connection);

  console.log(`[SSE] Connected: butcher=${butcherId}, user=${userId}`);
  
  return true;
}

/**
 * Remove a connection
 */
export function removeConnection(butcherId: string, userId: string, controller: ReadableStreamDefaultController): void {
  const butcherConnSet = connections.get(butcherId);
  const userConnSet = userConnections.get(userId);

  if (butcherConnSet) {
    for (const conn of butcherConnSet) {
      if (conn.controller === controller && conn.userId === userId) {
        butcherConnSet.delete(conn);
        console.log(`[SSE] Removed: butcher=${butcherId}, user=${userId}`);
        break;
      }
    }
    
    // Clean up empty sets
    if (butcherConnSet.size === 0) {
      connections.delete(butcherId);
    }
  }

  if (userConnSet) {
    for (const conn of userConnSet) {
      if (conn.controller === controller && conn.butcherId === butcherId) {
        userConnSet.delete(conn);
        break;
      }
    }
    
    // Clean up empty sets
    if (userConnSet.size === 0) {
      userConnections.delete(userId);
    }
  }
}

/**
 * Get all connections for a specific butcher
 */
export function getConnectionsForButcher(butcherId: string): SSEConnection[] {
  const connSet = connections.get(butcherId);
  return connSet ? Array.from(connSet) : [];
}

/**
 * Send SSE message to all connections for a butcher
 */
export function sendMessageToButcher(butcherId: string, data: any): void {
  const connSet = connections.get(butcherId);
  if (!connSet || connSet.size === 0) {
    return; // No connections
  }

  const message = `data: ${JSON.stringify(data)}\n\n`;
  const deadConnections: SSEConnection[] = [];

  for (const conn of connSet) {
    try {
      conn.controller.enqueue(new TextEncoder().encode(message));
    } catch (error) {
      // Connection is dead, mark for removal
      deadConnections.push(conn);
    }
  }

  // Remove dead connections
  for (const deadConn of deadConnections) {
    removeConnection(deadConn.butcherId, deadConn.userId, deadConn.controller);
  }
}

/**
 * Send order update via SSE
 */
export function sendOrderUpdate(butcherId: string, order: Order): void {
  sendMessageToButcher(butcherId, {
    type: 'new-order',
    order,
    timestamp: new Date().toISOString()
  });
}

/**
 * Send order status update with full order data
 */
export function sendOrderStatusUpdate(butcherId: string, order: Order): void {
  sendMessageToButcher(butcherId, {
    type: 'order-status-update',
    order,  // ✅ FIX: Send full order data, not just status
    timestamp: new Date().toISOString()
  });
}

/**
 * Get connection statistics
 */
export function getConnectionStats(): {
  totalConnections: number;
  connectionsPerButcher: { butcherId: string; count: number }[];
  connectionsPerUser: { userId: string; count: number }[];
} {
  const butcherStats = Array.from(connections.entries()).map(([butcherId, connSet]) => ({
    butcherId,
    count: connSet.size
  }));

  const userStats = Array.from(userConnections.entries()).map(([userId, connSet]) => ({
    userId,
    count: connSet.size
  }));

  const totalConnections = Array.from(connections.values()).reduce(
    (sum, connSet) => sum + connSet.size,
    0
  );

  return {
    totalConnections,
    connectionsPerButcher: butcherStats,
    connectionsPerUser: userStats
  };
}

/**
 * Clean up stale connections (older than 1 hour)
 */
export function cleanupStaleConnections(): void {
  const now = new Date();
  const maxAge = 60 * 60 * 1000; // 1 hour

  for (const [butcherId, connSet] of connections.entries()) {
    const staleConnections: SSEConnection[] = [];

    for (const conn of connSet) {
      const age = now.getTime() - conn.connectedAt.getTime();
      if (age > maxAge) {
        staleConnections.push(conn);
      }
    }

    for (const staleConn of staleConnections) {
      removeConnection(staleConn.butcherId, staleConn.userId, staleConn.controller);
    }
  }
}

// Run cleanup every 30 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupStaleConnections, 30 * 60 * 1000);
}

