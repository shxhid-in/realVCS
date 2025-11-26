/**
 * Menu Update Worker
 * Background worker to process queued menu update notifications
 */

import { centralAPIClient } from './centralAPIClient';
import {
  getQueuedMenuUpdates,
  removeQueuedMenuUpdate,
  incrementMenuUpdateRetry,
  isMenuUpdateReadyForRetry,
  MAX_RETRY_COUNT,
  getMenuUpdateRetryDelay
} from './orderQueue';

let workerInterval: NodeJS.Timeout | null = null;
const WORKER_INTERVAL = 30000; // Process queue every 30 seconds

/**
 * Process menu update queue
 */
async function processMenuUpdateQueue(): Promise<void> {
  const queuedUpdates = getQueuedMenuUpdates();
  
  if (queuedUpdates.length === 0) {
    return; // Nothing to process
  }

  console.log(`[MenuUpdateWorker] Processing ${queuedUpdates.length} queued menu updates`);

  for (const queued of queuedUpdates) {
    // Check if ready for retry
    if (!isMenuUpdateReadyForRetry(queued)) {
      continue; // Not ready yet, skip
    }

    try {
      console.log(`[MenuUpdateWorker] Retrying menu update notification for ${queued.butcherName} (attempt ${queued.retryCount + 1})`);
      
      // Attempt to notify Central API
      await centralAPIClient.notifyMenuUpdate(queued.butcherId, queued.butcherName);
      
      // Success! Remove from queue
      removeQueuedMenuUpdate(queued.butcherId, queued.butcherName);
      console.log(`[MenuUpdateWorker] ✅ Successfully sent menu update notification for ${queued.butcherName}`);
      
    } catch (error: any) {
      console.error(`[MenuUpdateWorker] ❌ Failed to send menu update for ${queued.butcherName}:`, error.message);
      
      // Increment retry count
      const canRetry = incrementMenuUpdateRetry(queued.butcherId, queued.butcherName);
      
      if (!canRetry) {
        // Max retries reached, remove from queue
        removeQueuedMenuUpdate(queued.butcherId, queued.butcherName);
        console.error(`[MenuUpdateWorker] ⚠️ Max retries reached for ${queued.butcherName}. Removed from queue.`);
      } else {
        const nextRetryDelay = getMenuUpdateRetryDelay(queued.retryCount);
        console.log(`[MenuUpdateWorker] Will retry ${queued.butcherName} in ${nextRetryDelay / 1000}s (attempt ${queued.retryCount + 1}/${MAX_RETRY_COUNT})`);
      }
    }
  }
}

/**
 * Start the menu update worker
 */
export function startMenuUpdateWorker(): void {
  if (workerInterval) {
    console.log('[MenuUpdateWorker] Worker already running');
    return;
  }

  console.log('[MenuUpdateWorker] Starting background worker...');
  
  // Process immediately on start
  processMenuUpdateQueue();
  
  // Then process every 30 seconds
  workerInterval = setInterval(() => {
    processMenuUpdateQueue();
  }, WORKER_INTERVAL);
  
  console.log(`[MenuUpdateWorker] Background worker started (interval: ${WORKER_INTERVAL}ms)`);
}

/**
 * Stop the menu update worker
 */
export function stopMenuUpdateWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[MenuUpdateWorker] Background worker stopped');
  }
}

// Auto-start worker when module is loaded (server-side only)
if (typeof window === 'undefined') {
  // Only run on server-side
  // Use setTimeout to ensure module is fully loaded
  setTimeout(() => {
    startMenuUpdateWorker();
  }, 1000); // Start after 1 second delay
}

