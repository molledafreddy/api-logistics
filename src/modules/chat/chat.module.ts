import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { User } from '../auth/entities/user.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatNotificationListener } from './chat-notification.listener';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, User]),
    NotificationsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatNotificationListener],
  exports: [ChatService],
})
export class ChatModule {}
