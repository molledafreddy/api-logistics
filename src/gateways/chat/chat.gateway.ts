import { Logger, UnauthorizedException } from '@nestjs/common';
import { CreateMessageDto } from '../../modules/chat/dto';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsAuthService } from '../ws-auth.service';
import { CHAT_EVENTS } from '../events/chat.events';
import {
  INTERNAL_EVENTS,
  type ChatMessageSentPayload,
} from '../events/internal.events';
import { ChatService } from '../../modules/chat/chat.service';
import { Message } from '../../modules/chat/entities/message.entity';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*', credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly wsAuth: WsAuthService,
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const user = await this.wsAuth.authenticate(client);
      client.data.user = user;
      await client.join(this.userRoom(user.sub));
      if (user.companyId) {
        await client.join(this.companyRoom(user.companyId));
      }
      this.logger.log(`[CHAT] Connected user=${user.sub} socket=${client.id}`);

      // Broadcast presence only to members of the same company
      if (user.companyId) {
        client
          .to(this.companyRoom(user.companyId))
          .emit(CHAT_EVENTS.USER_ONLINE, { userId: user.sub });
      }
      client.emit('connected', { userId: user.sub });
    } catch (err) {
      this.logger.warn(`[CHAT] Auth failed: ${(err as Error).message}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user as IUserPayload | undefined;
    if (user?.companyId) {
      client
        .to(this.companyRoom(user.companyId))
        .emit(CHAT_EVENTS.USER_OFFLINE, { userId: user.sub });
    }
    this.logger.log(`[CHAT] Disconnected socket=${client.id}`);
  }

  // ─── Cliente: unirse / salir de una conversación ──────────
  @SubscribeMessage(CHAT_EVENTS.JOIN_CONVERSATION)
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const user = this.requireUser(client);
    // Valida acceso vía servicio (lanza si no es participante)
    await this.chatService.getConversation(payload.conversationId, user);
    await client.join(this.convRoom(payload.conversationId));
    return { ok: true, conversationId: payload.conversationId };
  }

  @SubscribeMessage(CHAT_EVENTS.LEAVE_CONVERSATION)
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    await client.leave(this.convRoom(payload.conversationId));
    return { ok: true };
  }

  // ─── Cliente: enviar mensaje (la persistencia ocurre aquí) ────
  @SubscribeMessage(CHAT_EVENTS.SEND_MESSAGE)
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      conversationId: string;
      content: string;
      type?: 'text' | 'image' | 'file';
      fileUrl?: string;
      fileName?: string;
    },
  ) {
    const user = this.requireUser(client);
    const dto: CreateMessageDto = {
      content: payload.content,
      type: payload.type,
      fileUrl: payload.fileUrl,
      fileName: payload.fileName,
    };
    const message = await this.chatService.sendMessage(
      payload.conversationId,
      dto,
      user,
    );
    // No difundimos aquí: el service emite `internal.chat.message.sent`
    // y `handleMessageSent` se encarga de broadcastear al room.
    return { ok: true, messageId: message.id };
  }

  // ─── Cliente: typing indicators (sin persistencia) ─────────
  @SubscribeMessage(CHAT_EVENTS.TYPING_START)
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const user = this.requireUser(client);
    client
      .to(this.convRoom(payload.conversationId))
      .emit(CHAT_EVENTS.USER_TYPING, {
        conversationId: payload.conversationId,
        userId: user.sub,
        typing: true,
      });
  }

  @SubscribeMessage(CHAT_EVENTS.TYPING_STOP)
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const user = this.requireUser(client);
    client
      .to(this.convRoom(payload.conversationId))
      .emit(CHAT_EVENTS.USER_TYPING, {
        conversationId: payload.conversationId,
        userId: user.sub,
        typing: false,
      });
  }

  @SubscribeMessage(CHAT_EVENTS.MARK_READ)
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const user = this.requireUser(client);
    const result = await this.chatService.markAsRead(
      payload.conversationId,
      user,
    );
    this.server
      .to(this.convRoom(payload.conversationId))
      .emit(CHAT_EVENTS.MESSAGE_READ, {
        conversationId: payload.conversationId,
        userId: user.sub,
        updated: result.updated,
      });
    return { ok: true, updated: result.updated };
  }

  // ─── Bridge: servicio → WS (para mensajes creados vía REST) ──
  @OnEvent(INTERNAL_EVENTS.CHAT_MESSAGE_SENT)
  handleMessageSent({ message }: ChatMessageSentPayload) {
    this.broadcastMessage(message);
  }

  private broadcastMessage(message: Message) {
    if (!message?.conversationId) return;
    this.server
      .to(this.convRoom(message.conversationId))
      .emit(CHAT_EVENTS.NEW_MESSAGE, {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        type: message.type,
        content: message.content,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        createdAt: message.createdAt,
      });
  }

  // ─── Helpers ────────────────────────────────────────────────
  private requireUser(client: Socket): IUserPayload {
    const user = client.data.user as IUserPayload | undefined;
    if (!user) throw new UnauthorizedException('Not authenticated');
    return user;
  }

  private convRoom(conversationId: string): string {
    return `conv:${conversationId}`;
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private companyRoom(companyId: string): string {
    return `company:${companyId}`;
  }
}
