import { Controller, Get, Param, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { buildReferralLandingHtml } from './referrals-landing.template';

@ApiTags('ReferralsLanding')
@Controller('referrals/join')
@Public()
export class ReferralsLandingController {
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
  @ApiOperation({ summary: 'Página de bienvenida para link de referido' })
  @ApiParam({ name: 'token', description: 'Token único del link de referido' })
  getPage(@Param('token') token: string, @Res() res: Response): void {
    const html = buildReferralLandingHtml(token, this.apiBase);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.send(html);
  }
}
