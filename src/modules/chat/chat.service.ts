import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { In, Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { User } from '../auth/entities/user.entity';
import {
  CreateConversationDto,
  CreateMessageDto,
  QueryMessagesDto,
  QueryConversationsDto,
  AddParticipantsDto,
} from './dto';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { INTERNAL_EVENTS } from '../../gateways/events/internal.events';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─────────────────────────────────────────────
  // CONVERSATIONS
  // ─────────────────────────────────────────────
  async createConversation(
    dto: CreateConversationDto,
    user: IUserPayload,
  ): Promise<Conversation> {
    const companyId = this.requireCompanyId(user);

    const participantIds = Array.from(
      new Set([...dto.participantIds, user.sub]),
    );

    if (dto.type === 'direct' && participantIds.length !== 2) {
      throw new BadRequestException(
        'Direct conversations must have exactly 2 participants',
      );
    }

    const conversation = this.conversationRepository.create({
      companyId,
      type: dto.type,
      title: dto.title || null,
      shipmentId: dto.shipmentId || null,
      participantIds,
      createdBy: user.sub,
    });

    const saved = await this.conversationRepository.save(conversation);
    this.logger.log(`Conversation created: ${saved.id} (${saved.type})`);
    return saved;
  }

  async listConversations(
    query: QueryConversationsDto,
    user: IUserPayload,
  ): Promise<(Conversation & { participantName: string | null })[]> {
    const companyId = this.requireCompanyId(user);

    const qb = this.conversationRepository
      .createQueryBuilder('c')
      .where('c.deletedAt IS NULL')
      .andWhere('c.companyId = :companyId', { companyId })
      .andWhere(`c.participantIds @> :uid::jsonb`, {
        uid: JSON.stringify([user.sub]),
      });

    if (query.type) qb.andWhere('c.type = :type', { type: query.type });
    if (query.shipmentId)
      qb.andWhere('c.shipmentId = :sid', { sid: query.shipmentId });

    qb.orderBy('c.lastMessageAt', 'DESC', 'NULLS LAST').addOrderBy(
      'c.createdAt',
      'DESC',
    );

    const conversations = await qb.getMany();

    // Resolve names for the other participant in direct conversations
    const otherIds = [
      ...new Set(
        conversations
          .filter((c) => c.type === 'direct')
          .flatMap((c) => c.participantIds.filter((id) => id !== user.sub)),
      ),
    ];

    const nameMap = new Map<string, string>();
    if (otherIds.length > 0) {
      const users = await this.userRepository.find({
        where: { id: In(otherIds) },
        select: ['id', 'firstName', 'lastName'],
      });
      users.forEach((u) => nameMap.set(u.id, `${u.firstName} ${u.lastName}`));
    }

    return conversations.map((c) => ({
      ...c,
      participantName:
        c.type === 'direct'
          ? (nameMap.get(
              c.participantIds.find((id) => id !== user.sub) ?? '',
            ) ?? null)
          : null,
    }));
  }

  async getConversation(id: string, user: IUserPayload): Promise<Conversation> {
    const conv = await this.conversationRepository.findOne({ where: { id } });
    if (!conv) throw new NotFoundException(`Conversation ${id} not found`);
    this.assertParticipant(conv, user);
    return conv;
  }

  async addParticipants(
    id: string,
    dto: AddParticipantsDto,
    user: IUserPayload,
  ): Promise<Conversation> {
    const conv = await this.getConversation(id, user);

    if (conv.type === 'direct') {
      throw new BadRequestException(
        'Cannot add participants to a direct conversation',
      );
    }

    const newSet = Array.from(
      new Set([...conv.participantIds, ...dto.userIds]),
    );
    conv.participantIds = newSet;
    return this.conversationRepository.save(conv);
  }

  async removeParticipant(
    id: string,
    userId: string,
    user: IUserPayload,
  ): Promise<Conversation> {
    const conv = await this.getConversation(id, user);

    if (conv.type === 'direct') {
      throw new BadRequestException(
        'Cannot remove participants from direct conversation',
      );
    }

    conv.participantIds = conv.participantIds.filter((u) => u !== userId);
    return this.conversationRepository.save(conv);
  }

  async leaveConversation(id: string, user: IUserPayload): Promise<void> {
    const conv = await this.getConversation(id, user);
    conv.participantIds = conv.participantIds.filter((u) => u !== user.sub);
    if (conv.participantIds.length === 0) {
      await this.conversationRepository.softRemove(conv);
    } else {
      await this.conversationRepository.save(conv);
    }
  }

  // ─────────────────────────────────────────────
  // MESSAGES
  // ─────────────────────────────────────────────
  async sendMessage(
    conversationId: string,
    dto: CreateMessageDto,
    user: IUserPayload,
  ): Promise<Message> {
    const conv = await this.getConversation(conversationId, user);

    const message = this.messageRepository.create({
      conversationId: conv.id,
      senderId: user.sub,
      type: dto.type || 'text',
      content: dto.content,
      fileUrl: dto.fileUrl || null,
      fileName: dto.fileName || null,
      readBy: [user.sub],
    });

    const saved = await this.messageRepository.save(message);

    // Update conversation preview
    conv.lastMessageAt = saved.createdAt;
    conv.lastMessagePreview = dto.content.substring(0, 200);
    await this.conversationRepository.save(conv);

    // Bridge a WebSocket
    this.eventEmitter.emit(INTERNAL_EVENTS.CHAT_MESSAGE_SENT, saved);

    return saved;
  }

  async listMessages(
    conversationId: string,
    query: QueryMessagesDto,
    user: IUserPayload,
  ): Promise<Message[]> {
    await this.getConversation(conversationId, user); // valida acceso

    const qb = this.messageRepository
      .createQueryBuilder('m')
      .where('m.conversationId = :cid', { cid: conversationId })
      .andWhere('m.deletedAt IS NULL');

    if (query.before) {
      const cursor = await this.messageRepository.findOne({
        where: { id: query.before },
      });
      if (cursor) {
        qb.andWhere('m.createdAt < :ts', { ts: cursor.createdAt });
      }
    }

    qb.orderBy('m.createdAt', 'DESC').take(query.limit);
    return qb.getMany();
  }

  async markAsRead(
    conversationId: string,
    user: IUserPayload,
  ): Promise<{ updated: number }> {
    await this.getConversation(conversationId, user);

    const messages = await this.messageRepository.find({
      where: { conversationId },
    });

    let updated = 0;
    for (const msg of messages) {
      if (!msg.readBy.includes(user.sub)) {
        msg.readBy = [...msg.readBy, user.sub];
        await this.messageRepository.save(msg);
        updated++;
      }
    }

    return { updated };
  }

  async deleteMessage(messageId: string, user: IUserPayload): Promise<void> {
    const msg = await this.messageRepository.findOne({
      where: { id: messageId },
    });
    if (!msg) throw new NotFoundException(`Message ${messageId} not found`);

    if (msg.senderId !== user.sub) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.messageRepository.softRemove(msg);
  }

  async getUnreadCount(user: IUserPayload): Promise<{ unread: number }> {
    const companyId = this.requireCompanyId(user);

    // Conversaciones del usuario
    const convs = await this.conversationRepository
      .createQueryBuilder('c')
      .where('c.companyId = :companyId', { companyId })
      .andWhere('c.deletedAt IS NULL')
      .andWhere(`c.participantIds @> :uid::jsonb`, {
        uid: JSON.stringify([user.sub]),
      })
      .select(['c.id'])
      .getMany();

    if (convs.length === 0) return { unread: 0 };

    const ids = convs.map((c) => c.id);
    const count = await this.messageRepository
      .createQueryBuilder('m')
      .where('m.conversationId IN (:...ids)', { ids })
      .andWhere('m.deletedAt IS NULL')
      .andWhere('m.senderId != :uid', { uid: user.sub })
      .andWhere(`NOT (m.readBy @> :uidArr::jsonb)`, {
        uidArr: JSON.stringify([user.sub]),
      })
      .getCount();

    return { unread: count };
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  private requireCompanyId(user: IUserPayload): string {
    if (!user.companyId) {
      throw new ForbiddenException('User has no company associated');
    }
    return user.companyId;
  }

  private assertParticipant(conv: Conversation, user: IUserPayload): void {
    if (!conv.participantIds.includes(user.sub)) {
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }
  }
}
