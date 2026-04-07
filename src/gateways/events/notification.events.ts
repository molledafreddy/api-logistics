// Notification WebSocket events
export const NOTIFICATION_EVENTS = {
  // Server → Client
  NEW_NOTIFICATION: 'notification:new',
  NOTIFICATION_COUNT: 'notification:count',

  // Client → Server
  MARK_AS_READ: 'notification:markRead',
  MARK_ALL_AS_READ: 'notification:markAllRead',
} as const;
