import type { Message } from '../../modules/chat/entities/message.entity';
import type { Conversation } from '../../modules/chat/entities/conversation.entity';

export interface ChatMessageSentPayload {
  message: Message;
  conversation: Pick<Conversation, 'id' | 'participantIds'>;
}

/**
 * Eventos internos del bus EventEmitter2.
 * Los servicios los emiten; los gateways los escuchan y los reenvían por WebSocket.
 */
export const INTERNAL_EVENTS = {
  // Notifications
  NOTIFICATION_CREATED: 'internal.notification.created',

  // Chat
  CHAT_MESSAGE_SENT: 'internal.chat.message.sent',
  CHAT_MESSAGE_READ: 'internal.chat.message.read',

  // Tracking
  TRACKING_POINT_CREATED: 'internal.tracking.point.created',
  TRACKING_BULK_CREATED: 'internal.tracking.bulk.created',

  // PARTE 7 · Sprint 1 — DeliveryRun
  DELIVERY_RUN_STARTED: 'internal.delivery-run.started',
  DELIVERY_RUN_COMPLETED: 'internal.delivery-run.completed',
  DELIVERY_RUN_CANCELLED: 'internal.delivery-run.cancelled',
  DELIVERY_RUN_STOP_DONE: 'internal.delivery-run.stop.done',
  DELIVERY_RUN_STOP_INCIDENT: 'internal.delivery-run.stop.incident',

  // PARTE 7 · Sprint 2 — RecurringTemplate
  RECURRING_GENERATED: 'internal.recurring.generated',

  // PARTE 7 · Sprint 7 — Optimization
  DELIVERY_RUN_OPTIMIZED: 'internal.delivery-run.optimized',
} as const;
