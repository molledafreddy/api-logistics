import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List my notifications (paginated)' })
  @ApiResponse({
    status: 200,
    description: 'List of notifications for current user',
  })
  findMine(
    @CurrentUser() user: IUserPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findByUser(
      user.sub,
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({
    status: 403,
    description: 'Notification does not belong to current user',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  markAsRead(@Param('id') id: string, @CurrentUser() user: IUserPayload) {
    return this.service.markAsRead(id, user.sub);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all unread notifications as read for current user',
  })
  @ApiResponse({
    status: 200,
    description: 'All unread notifications marked as read',
  })
  markAllRead(@CurrentUser() user: IUserPayload) {
    return this.service.markAllRead(user.sub);
  }

  @Post('push-tokens')
  @ApiOperation({
    summary: 'Register a push notification token for mobile app',
  })
  @ApiBody({ type: RegisterPushTokenDto })
  @ApiResponse({ status: 201, description: 'Push token registered' })
  @ApiResponse({ status: 400, description: 'Invalid token format' })
  registerPushToken(
    @CurrentUser() user: IUserPayload,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.service.registerPushToken(
      user.sub,
      dto.token,
      dto.platform,
      dto.deviceName,
    );
  }

  @Delete('push-tokens/:token')
  @ApiOperation({ summary: 'Unregister/deactivate a push notification token' })
  @ApiResponse({ status: 200, description: 'Push token deactivated' })
  @ApiResponse({ status: 404, description: 'Push token not found' })
  removePushToken(
    @CurrentUser() user: IUserPayload,
    @Param('token') token: string,
  ) {
    return this.service.removePushToken(user.sub, token);
  }
}
