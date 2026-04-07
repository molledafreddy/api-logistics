// Tracking WebSocket events
export const TRACKING_EVENTS = {
  // Client → Server
  SUBSCRIBE_SHIPMENT: 'tracking:subscribe',
  UNSUBSCRIBE_SHIPMENT: 'tracking:unsubscribe',
  SEND_LOCATION: 'tracking:location',

  // Server → Client
  LOCATION_UPDATE: 'tracking:locationUpdate',
  STATUS_CHANGE: 'tracking:statusChange',
  GEOFENCE_ALERT: 'tracking:geofenceAlert',
  ETA_UPDATE: 'tracking:etaUpdate',
} as const;
