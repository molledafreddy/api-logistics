import { Controller, Get, Param, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { buildTrackingPageHtml } from './tracking-page.template';

@ApiTags('TrackingPage')
@Controller('tracking')
@Public()
export class TrackingPageController {
  private readonly apiBase: string;

  constructor(private readonly config: ConfigService) {
    const appUrl = config.get<string>(
      'APP_PUBLIC_URL',
      'http://localhost:3000',
    );
    const apiPrefix = config.get<string>('API_PREFIX', 'v1');
    this.apiBase = `${appUrl}/${apiPrefix}`;
  }

  @Get(':token')
  @ApiOperation({ summary: 'Página de seguimiento público de envío' })
  @ApiParam({ name: 'token', description: 'Token único del envío' })
  getPage(@Param('token') token: string, @Res() res: Response): void {
    const html = buildTrackingPageHtml(token, this.apiBase);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.send(html);
  }
}
