import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { User } from '../modules/auth/entities/user.entity';
import { ChatModule } from '../modules/chat/chat.module';
import { TrackingModule } from '../modules/tracking/tracking.module';
import { WsAuthService } from './ws-auth.service';
import { NotificationsGateway } from './notifications/notifications.gateway';
import { ChatGateway } from './chat/chat.gateway';
import { TrackingGateway } from './tracking/tracking.gateway';

/**
 * Módulo que agrupa los WebSocket Gateways del sistema.
 * - /notifications  → push de notificaciones por usuario
 * - /chat           → mensajería en tiempo real (rooms por conversación)
 * - /tracking       → ubicaciones GPS en vivo (rooms por shipment/truck)
 *
 * Autenticación: JWT Supabase vía handshake (auth.token | Authorization header).
 * Bridging service ↔ gateway: vía EventEmitter2 (eventos `internal.*`).
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User]),
    ChatModule,
    TrackingModule,
  ],
  providers: [
    WsAuthService,
    NotificationsGateway,
    ChatGateway,
    TrackingGateway,
  ],
  exports: [WsAuthService],
})
export class GatewaysModule {}
