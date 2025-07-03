// HeartbeatWorker.ts
let heartbeatInterval: NodeJS.Timeout | null = null;

function startHeartbeat() {
  if (heartbeatInterval) return;
  
  heartbeatInterval = setInterval(() => {
    // Post heartbeat message to parent
    self.postMessage({ type: 'heartbeat' });
  }, 30000); // Every 30 seconds
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// Listen for messages from the parent
self.addEventListener('message', (event) => {
  if (event.data === 'start') {
    startHeartbeat();
  } else if (event.data === 'stop') {
    stopHeartbeat();
  }
});

// Clean up on unload
self.addEventListener('beforeunload', () => {
  stopHeartbeat();
});

// Export for TypeScript
export type HeartbeatWorker = Worker; 