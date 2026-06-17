import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../common/enums/notification-type.enum';
import {
  INTERNAL_EVENTS,
  type ChatMessageSentPayload,
} from '../../gateways/events/internal.events';

const MAX_BODY_LENGTH = 100;
const TRUNCATE_AT = 97;

@Injectable()
export class ChatNotificationListener {
  private readonly logger = new Logger(ChatNotificationListener.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent(INTERNAL_EVENTS.CHAT_MESSAGE_SENT)
  async handle({
    message,
    conversation,
  }: ChatMessageSentPayload): Promise<void> {
    const recipientIds = conversation.participantIds.filter(
      (id) => id !== message.senderId,
    );
    if (!recipientIds.length) return;

    const sender = await this.userRepository.findOne({
      where: { id: message.senderId },
      select: ['firstName', 'lastName'],
    });
    const senderName = sender
      ? `${sender.firstName} ${sender.lastName}`.trim()
      : 'Nuevo mensaje';

    const body =
      message.content.length > MAX_BODY_LENGTH
        ? `${message.content.substring(0, TRUNCATE_AT)}…`
        : message.content;

    const results = await Promise.allSettled(
      recipientIds.map((userId) =>
        this.notificationsService.create({
          userId,
          type: NotificationType.MESSAGE_NEW,
          title: senderName,
          body,
          data: { type: 'message_received', conversationId: conversation.id },
        }),
      ),
    );

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        this.logger.warn(
          `Push notification failed for recipient ${recipientIds[i]}: ${r.reason}`,
        );
      }
    });
  }
}
