import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import {
  CreateConversationDto,
  CreateMessageDto,
  QueryMessagesDto,
  QueryConversationsDto,
  AddParticipantsDto,
} from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import * as UserPayloadNS from '../../common/interfaces/user-payload.interface';

type IUserPayload = UserPayloadNS.IUserPayload;

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ─── Conversaciones ─────────────────────
  @Post('conversations')
  @ApiOperation({ summary: 'Crear conversación (direct, group o shipment)' })
  @ApiResponse({ status: 201, description: 'Conversación creada' })
  createConversation(
    @Body() dto: CreateConversationDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.chatService.createConversation(dto, user);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Listar mis conversaciones' })
  listConversations(
    @Query() query: QueryConversationsDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.chatService.listConversations(query, user);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Obtener una conversación' })
  getConversation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.chatService.getConversation(id, user);
  }

  @Patch('conversations/:id/participants')
  @ApiOperation({ summary: 'Agregar participantes a la conversación' })
  addParticipants(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddParticipantsDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.chatService.addParticipants(id, dto, user);
  }

  @Delete('conversations/:id/participants/:userId')
  @ApiOperation({ summary: 'Quitar un participante' })
  removeParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.chatService.removeParticipant(id, userId, user);
  }

  @Post('conversations/:id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Abandonar la conversación' })
  leave(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.chatService.leaveConversation(id, user);
  }

  // ─── Mensajes ───────────────────────────
  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Enviar mensaje en una conversación' })
  sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.chatService.sendMessage(id, dto, user);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Listar mensajes (paginación con cursor "before")' })
  listMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryMessagesDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.chatService.listMessages(id, query, user);
  }

  @Patch('conversations/:id/read')
  @ApiOperation({ summary: 'Marcar todos los mensajes como leídos' })
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.chatService.markAsRead(id, user);
  }

  @Delete('messages/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un mensaje (solo el autor)' })
  deleteMessage(
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.chatService.deleteMessage(messageId, user);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Cantidad de mensajes no leídos del usuario' })
  unreadCount(@CurrentUser() user: IUserPayload) {
    return this.chatService.getUnreadCount(user);
  }
}
