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
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

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
    @CurrentUser() user: any,
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
  @ApiResponse({ status: 404, description: 'Notification not found' })
  markAsRead(@Param('id') id: string) {
    return this.service.markAsRead(id);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all unread notifications as read for current user',
  })
  @ApiResponse({
    status: 200,
    description: 'All unread notifications marked as read',
  })
  markAllRead(@CurrentUser() user: any) {
    return this.service.markAllRead(user.sub);
  }

  @Post('push-tokens')
  @ApiOperation({
    summary: 'Register a push notification token for mobile app',
  })
  @ApiResponse({ status: 201, description: 'Push token registered' })
  @ApiResponse({ status: 400, description: 'Invalid token format' })
  registerPushToken(
    @CurrentUser() user: any,
    @Body() body: { token: string; platform: string; deviceName?: string },
  ) {
    return this.service.registerPushToken(
      user.sub,
      body.token,
      body.platform,
      body.deviceName,
    );
  }

  @Delete('push-tokens/:token')
  @ApiOperation({ summary: 'Unregister/deactivate a push notification token' })
  @ApiResponse({ status: 200, description: 'Push token deactivated' })
  @ApiResponse({ status: 404, description: 'Push token not found' })
  removePushToken(@CurrentUser() user: any, @Param('token') token: string) {
    return this.service.removePushToken(user.sub, token);
  }
}
