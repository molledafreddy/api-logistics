import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Headers,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
} from './dto/index';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import * as UserPayloadNS from '../../common/interfaces/user-payload.interface';

type IUserPayload = UserPayloadNS.IUserPayload;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  // Estricto: 3 registros / minuto, 10 / hora por IP
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 3_600_000 },
  })
  @ApiOperation({ summary: 'Registrar nuevo usuario y empresa' })
  @ApiResponse({ status: 201, description: 'Usuario registrado exitosamente' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  @ApiResponse({ status: 422, description: 'Datos de entrada inválidos' })
  async register(@Body() dto: RegisterDto, @Req() req: any) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    return this.authService.register(dto, ipAddress);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Estricto anti-bruteforce: 5 logins / minuto, 30 / hora por IP
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 30, ttl: 3_600_000 },
  })
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos' })
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    return this.authService.login(dto, ipAddress);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  // 20 refresh / minuto por IP
  @Throttle({ short: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Refrescar access token' })
  @ApiResponse({ status: 200, description: 'Token refrescado' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido' })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada' })
  async logout(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace('Bearer ', '') || '';
    return this.authService.logout(token);
  }

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil del usuario' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getProfile(@CurrentUser() user: IUserPayload) {
    return this.authService.getProfile(user.sub);
  }

  @Get('me/permissions')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Permisos del plan activo de la empresa del usuario',
  })
  @ApiResponse({ status: 200, description: 'Lista de códigos de permiso' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getMyPermissions(@CurrentUser() user: IUserPayload) {
    if (!user.companyId) return { permissions: [] };
    return this.authService.getMyPermissions(user.companyId);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  // 1 reenvío / minuto por IP (más el cooldown de 60s en el servicio, por email)
  @Throttle({ short: { limit: 1, ttl: 60_000 } })
  @ApiOperation({ summary: 'Re-enviar código de verificación de email' })
  @ApiResponse({ status: 200, description: 'Código de verificación enviado' })
  @ApiResponse({ status: 400, description: 'Cooldown de reenvío activo' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationCode(dto.email);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  // Anti-bruteforce del código de 6 dígitos: 5 intentos / minuto por IP
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verificar código de email de 6 dígitos' })
  @ApiResponse({ status: 200, description: 'Email verificado' })
  @ApiResponse({ status: 401, description: 'Código incorrecto o expirado' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmailCode(dto.email, dto.code);
  }

  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar contraseña del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada' })
  @ApiResponse({ status: 401, description: 'Contraseña actual incorrecta' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: IUserPayload,
  ) {
    return this.authService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
