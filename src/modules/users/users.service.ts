import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { User } from '../auth/entities/user.entity';
import { SupabaseService } from '../auth/supabase.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { PaginationResponseDto } from '../../common/dto/pagination-response.dto';

/**
 * Role hierarchy — higher index = higher privilege.
 * Used to enforce "you can't assign a role higher than yours".
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.VIEWER]: 1,
  [UserRole.DRIVER]: 2,
  [UserRole.ACCOUNTANT]: 3,
  [UserRole.DISPATCHER]: 4,
  [UserRole.MANAGER]: 5,
  [UserRole.ADMIN]: 6,
  [UserRole.COMPANY_OWNER]: 7,
  [UserRole.SUPER_ADMIN]: 8,
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly supabaseService: SupabaseService,
  ) {}

  // ─── List users of the company ─────────────────────
  async findAll(
    query: QueryUserDto,
    currentUser: IUserPayload,
  ): Promise<PaginationResponseDto<ReturnType<typeof this.sanitizeUser>>> {
    if (!currentUser.companyId && currentUser.role !== UserRole.SUPER_ADMIN) {
      return PaginationResponseDto.create([], 0, query.page, query.limit);
    }

    const qb = this.userRepository
      .createQueryBuilder('user')
      .where('user.deletedAt IS NULL');

    // Scope to company (super_admin sees all if no companyId filter)
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      qb.andWhere('user.companyId = :companyId', {
        companyId: currentUser.companyId,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }

    qb.orderBy('user.createdAt', 'DESC');
    qb.skip(query.skip).take(query.limit);

    const [users, total] = await qb.getManyAndCount();
    const sanitized = users.map((u) => this.sanitizeUser(u));
    return PaginationResponseDto.create(
      sanitized,
      total,
      query.page,
      query.limit,
    );
  }

  // ─── Get single user ───────────────────────────────
  async findOne(id: string, currentUser: IUserPayload) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verify same company (unless super_admin)
    if (
      currentUser.role !== UserRole.SUPER_ADMIN &&
      user.companyId !== currentUser.companyId
    ) {
      throw new ForbiddenException('No tienes acceso a este usuario');
    }

    return this.sanitizeUser(user);
  }

  // ─── Invite a new team member ──────────────────────
  async invite(dto: InviteUserDto, currentUser: IUserPayload) {
    // Must belong to a company
    if (!currentUser.companyId) {
      throw new BadRequestException('No perteneces a ninguna empresa');
    }

    // Check role hierarchy — can't invite someone with a higher role
    if (ROLE_HIERARCHY[dto.role] >= ROLE_HIERARCHY[currentUser.role]) {
      throw new ForbiddenException(
        'No puedes invitar a un usuario con un rol igual o superior al tuyo',
      );
    }

    // Only owner and admin can invite
    const canInvite = [UserRole.COMPANY_OWNER, UserRole.ADMIN];
    if (
      currentUser.role !== UserRole.SUPER_ADMIN &&
      !canInvite.includes(currentUser.role)
    ) {
      throw new ForbiddenException('No tienes permisos para invitar usuarios');
    }

    // Check if email already exists
    const existing = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException(
        'Este email ya está registrado en la plataforma',
      );
    }

    // Generate invitation token (URL-safe)
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72); // 72 hours

    // Create pending user
    const user = this.userRepository.create({
      email: dto.email.toLowerCase().trim(),
      firstName: dto.firstName || 'Invitado',
      lastName: dto.lastName || '',
      phone: dto.phone || null,
      role: dto.role,
      status: UserStatus.PENDING_VERIFICATION,
      companyId: currentUser.companyId,
      invitedById: currentUser.sub,
      invitationToken: token,
      invitationExpiresAt: expiresAt,
      authUid: null, // Will be set when they accept
    });

    const saved = await this.userRepository.save(user);

    this.logger.log(
      `User invited: ${saved.email} as ${saved.role} to company ${currentUser.companyId} by ${currentUser.email}`,
    );

    // TODO: In a later sprint, send invitation email with link containing the token
    // For now, return the token in the response for testing

    return {
      id: saved.id,
      email: saved.email,
      role: saved.role,
      status: saved.status,
      invitationToken: token,
      invitationExpiresAt: expiresAt,
      message: 'Invitación creada exitosamente',
    };
  }

  // ─── Accept invitation ─────────────────────────────
  async acceptInvite(dto: AcceptInviteDto) {
    const user = await this.userRepository.findOne({
      where: {
        invitationToken: dto.token,
        status: UserStatus.PENDING_VERIFICATION,
      },
    });

    if (!user) {
      throw new NotFoundException(
        'Invitación no encontrada o ya fue utilizada',
      );
    }

    if (user.invitationExpiresAt && user.invitationExpiresAt < new Date()) {
      throw new BadRequestException('La invitación ha expirado');
    }

    // Create Supabase auth user
    const supabaseUser = await this.supabaseService.createAuthUser(
      user.email,
      dto.password,
      {
        first_name: dto.firstName,
        last_name: dto.lastName,
      },
    );

    // Update local user
    user.authUid = supabaseUser.id;
    user.firstName = dto.firstName;
    user.lastName = dto.lastName;
    user.status = UserStatus.ACTIVE;
    user.invitationToken = null;
    user.invitationExpiresAt = null;

    const saved = await this.userRepository.save(user);

    this.logger.log(`Invitation accepted: ${saved.email} (${saved.id})`);

    return {
      user: this.sanitizeUser(saved),
      message: 'Invitación aceptada. Ya puedes iniciar sesión.',
    };
  }

  // ─── Update user info ──────────────────────────────
  async update(id: string, dto: UpdateUserDto, currentUser: IUserPayload) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (
      currentUser.role !== UserRole.SUPER_ADMIN &&
      user.companyId !== currentUser.companyId
    ) {
      throw new ForbiddenException('No tienes acceso a este usuario');
    }

    // Users can update their own info, or owner/admin can update anyone in the company
    const isSelf = currentUser.sub === id;
    const canEditOthers = [
      UserRole.SUPER_ADMIN,
      UserRole.COMPANY_OWNER,
      UserRole.ADMIN,
    ];
    if (!isSelf && !canEditOthers.includes(currentUser.role)) {
      throw new ForbiddenException(
        'No tienes permisos para editar este usuario',
      );
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phone !== undefined) user.phone = dto.phone || null;

    const saved = await this.userRepository.save(user);
    return this.sanitizeUser(saved);
  }

  // ─── Change user role ──────────────────────────────
  async updateRole(
    id: string,
    dto: UpdateUserRoleDto,
    currentUser: IUserPayload,
  ) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (
      currentUser.role !== UserRole.SUPER_ADMIN &&
      user.companyId !== currentUser.companyId
    ) {
      throw new ForbiddenException('No tienes acceso a este usuario');
    }

    // Owner cannot be demoted
    if (user.role === UserRole.COMPANY_OWNER) {
      throw new ForbiddenException('No se puede cambiar el rol del owner');
    }

    // Can't assign a role higher than your own
    if (ROLE_HIERARCHY[dto.role] >= ROLE_HIERARCHY[currentUser.role]) {
      throw new ForbiddenException(
        'No puedes asignar un rol igual o superior al tuyo',
      );
    }

    // Only owner can create admins
    if (
      dto.role === UserRole.ADMIN &&
      currentUser.role !== UserRole.COMPANY_OWNER
    ) {
      throw new ForbiddenException(
        'Solo el owner puede asignar el rol de admin',
      );
    }

    user.role = dto.role;
    const saved = await this.userRepository.save(user);

    this.logger.log(
      `User role changed: ${saved.email} → ${saved.role} by ${currentUser.email}`,
    );

    return this.sanitizeUser(saved);
  }

  // ─── Deactivate user ───────────────────────────────
  async deactivate(id: string, currentUser: IUserPayload) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (
      currentUser.role !== UserRole.SUPER_ADMIN &&
      user.companyId !== currentUser.companyId
    ) {
      throw new ForbiddenException('No tienes acceso a este usuario');
    }

    // Owner cannot be deactivated
    if (user.role === UserRole.COMPANY_OWNER) {
      throw new ForbiddenException(
        'No se puede desactivar al owner de la empresa',
      );
    }

    // Can't deactivate yourself
    if (currentUser.sub === id) {
      throw new ForbiddenException('No puedes desactivarte a ti mismo');
    }

    const canDeactivate = [
      UserRole.SUPER_ADMIN,
      UserRole.COMPANY_OWNER,
      UserRole.ADMIN,
    ];
    if (!canDeactivate.includes(currentUser.role)) {
      throw new ForbiddenException(
        'No tienes permisos para desactivar usuarios',
      );
    }

    user.status = UserStatus.INACTIVE;
    const saved = await this.userRepository.save(user);

    this.logger.log(`User deactivated: ${saved.email} by ${currentUser.email}`);

    return { message: 'Usuario desactivado exitosamente' };
  }

  // ─── Reactivate user ──────────────────────────────
  async reactivate(id: string, currentUser: IUserPayload) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (
      currentUser.role !== UserRole.SUPER_ADMIN &&
      user.companyId !== currentUser.companyId
    ) {
      throw new ForbiddenException('No tienes acceso a este usuario');
    }

    if (user.status !== UserStatus.INACTIVE) {
      throw new BadRequestException(
        'Solo se pueden reactivar usuarios inactivos',
      );
    }

    const canReactivate = [
      UserRole.SUPER_ADMIN,
      UserRole.COMPANY_OWNER,
      UserRole.ADMIN,
    ];
    if (!canReactivate.includes(currentUser.role)) {
      throw new ForbiddenException(
        'No tienes permisos para reactivar usuarios',
      );
    }

    user.status = UserStatus.ACTIVE;
    const saved = await this.userRepository.save(user);

    this.logger.log(`User reactivated: ${saved.email} by ${currentUser.email}`);

    return { message: 'Usuario reactivado exitosamente' };
  }

  // ─── Sanitize ──────────────────────────────────────
  private sanitizeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      companyId: user.companyId,
      timezone: user.timezone,
      language: user.language,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
