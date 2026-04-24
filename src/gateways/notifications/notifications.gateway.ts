import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsAuthService } from '../ws-auth.service';
import { NOTIFICATION_EVENTS } from '../events/notification.events';
import { INTERNAL_EVENTS } from '../events/internal.events';
import { Notification } from '../../modules/notifications/entities/notification.entity';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: '*', credentials: true },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly wsAuth: WsAuthService) {}

  async handleConnection(client: Socket) {
    try {
      const user = await this.wsAuth.authenticate(client);
      client.data.user = user;
      // El usuario se une a su propia "room" para recibir notificaciones dirigidas
      await client.join(this.userRoom(user.sub));
      this.logger.log(`[NS] Connected user=${user.sub} socket=${client.id}`);
      client.emit('connected', { userId: user.sub });
    } catch (err) {
      this.logger.warn(
        `[NS] Auth failed for socket=${client.id}: ${(err as Error).message}`,
      );
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user as IUserPayload | undefined;
    this.logger.log(
      `[NS] Disconnected user=${user?.sub ?? 'unknown'} socket=${client.id}`,
    );
  }

  // ─── Bridge: servicio → WebSocket ───────────────────────────
  @OnEvent(INTERNAL_EVENTS.NOTIFICATION_CREATED)
  handleNotificationCreated(notification: Notification) {
    if (!notification?.userId) return;
    this.server
      .to(this.userRoom(notification.userId))
      .emit(NOTIFICATION_EVENTS.NEW_NOTIFICATION, {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        createdAt: notification.createdAt,
      });
  }

  // ─── Acciones del cliente ──────────────────────────────────
  @SubscribeMessage(NOTIFICATION_EVENTS.MARK_AS_READ)
  handleMarkAsRead(@ConnectedSocket() client: Socket, payload: { id: string }) {
    // Solo confirmamos recibo; la persistencia se hace por endpoint REST.
    return { ok: true, id: payload?.id };
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
