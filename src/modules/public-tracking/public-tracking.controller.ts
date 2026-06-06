import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PublicTrackingService } from './public-tracking.service';

@ApiTags('Public Tracking')
@Controller('public/tracking')
@Public()
export class PublicTrackingController {
  constructor(private readonly service: PublicTrackingService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Seguimiento público de envío — sin autenticación' })
  @ApiParam({ name: 'token', description: 'Token único del envío (UUID)' })
  getTracking(@Param('token') token: string) {
    return this.service.getByToken(token);
  }
}
