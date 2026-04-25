import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
@Controller('/')
export class RootController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Root endpoint (smoke check)' })
  root() {
    return 'Hello World!';
  }
}
