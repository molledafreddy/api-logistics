import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomBytes } from 'crypto';
import { Driver } from './entities/driver.entity';
import { User } from '../auth/entities/user.entity';
import {
  CreateDriverDto,
  UpdateDriverDto,
  QueryDriverDto,
  InviteDriverDto,
} from './dto';
import { DriverStatus } from '../../common/enums/driver-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { PaginationResponseDto } from '../../common/dto/pagination-response.dto';
import { MailService } from '../mail/mail.service';

const FREE_PLAN_MAX_DRIVERS = 1;

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {}

  async create(dto: CreateDriverDto, user: IUserPayload): Promise<Driver> {
    const companyId = this.requireCompanyId(user);

    if (user.role !== UserRole.SUPER_ADMIN) {
      await this.checkDriverPlanLimit(companyId);
    }

    const existing = await this.driverRepository.findOne({
      where: { companyId, licenseNumber: dto.licenseNumber },
    });
    if (existing) {
      throw new ConflictException(
        `Driver with license "${dto.licenseNumber}" already exists in this company`,
      );
    }

    const driver = this.driverRepository.create({
      ...dto,
      companyId,
      status: dto.status || DriverStatus.AVAILABLE,
    });

    const saved = await this.driverRepository.save(driver);
    this.logger.log(`Driver created: ${saved.fullName} (${saved.id})`);
    return saved;
  }

  async findAll(
    query: QueryDriverDto,
    user: IUserPayload,
  ): Promise<PaginationResponseDto<Driver>> {
    const qb = this.driverRepository
      .createQueryBuilder('driver')
      .where('driver.deletedAt IS NULL');

    if (user.role === UserRole.SUPER_ADMIN) {
      if (query.companyId) {
        qb.andWhere('driver.companyId = :companyId', {
          companyId: query.companyId,
        });
      }
    } else {
      const companyId = this.requireCompanyId(user);
      qb.andWhere('driver.companyId = :companyId', { companyId });
    }

    if (query.search) {
      qb.andWhere(
        '(driver.firstName ILIKE :search OR driver.lastName ILIKE :search OR driver.email ILIKE :search OR driver.licenseNumber ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.status) {
      qb.andWhere('driver.status = :status', { status: query.status });
    }
    if (query.truckId) {
      qb.andWhere('driver.currentTruckId = :truckId', {
        truckId: query.truckId,
      });
    }

    const allowedSort = [
      'firstName',
      'lastName',
      'status',
      'totalTrips',
      'ratingAvg',
      'createdAt',
    ];
    const sortBy = allowedSort.includes(query.sortBy || '')
      ? `driver.${query.sortBy}`
      : 'driver.createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortBy, sortOrder);

    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return PaginationResponseDto.create(data, total, query.page, query.limit);
  }

  async findOne(id: string, user: IUserPayload): Promise<Driver> {
    const driver = await this.driverRepository.findOne({ where: { id } });
    if (!driver) {
      throw new NotFoundException(`Driver ${id} not found`);
    }
    this.assertTenantAccess(driver, user);
    return driver;
  }

  async update(
    id: string,
    dto: UpdateDriverDto,
    user: IUserPayload,
  ): Promise<Driver> {
    const driver = await this.findOne(id, user);

    if (dto.licenseNumber && dto.licenseNumber !== driver.licenseNumber) {
      const dup = await this.driverRepository.findOne({
        where: {
          companyId: driver.companyId,
          licenseNumber: dto.licenseNumber,
        },
      });
      if (dup) {
        throw new ConflictException(
          `Driver with license "${dto.licenseNumber}" already exists in this company`,
        );
      }
    }

    Object.assign(driver, dto);
    const saved = await this.driverRepository.save(driver);
    this.logger.log(`Driver updated: ${saved.fullName} (${saved.id})`);
    return saved;
  }

  async updateStatus(
    id: string,
    status: DriverStatus,
    user: IUserPayload,
  ): Promise<Driver> {
    const driver = await this.findOne(id, user);
    driver.status = status;
    const saved = await this.driverRepository.save(driver);
    this.logger.log(`Driver ${saved.fullName} status -> ${status}`);
    return saved;
  }

  async getCurrentTrip(id: string, user: IUserPayload) {
    const driver = await this.findOne(id, user);
    return {
      driverId: driver.id,
      driverName: driver.fullName,
      status: driver.status,
      currentTruckId: driver.currentTruckId,
      onTrip: driver.status === DriverStatus.ON_TRIP,
    };
  }

  async getStats(id: string, user: IUserPayload) {
    const driver = await this.findOne(id, user);
    return {
      driverId: driver.id,
      driverName: driver.fullName,
      totalTrips: driver.totalTrips,
      ratingAvg: Number(driver.ratingAvg),
      status: driver.status,
    };
  }

  async inviteDriver(
    id: string,
    dto: InviteDriverDto,
    currentUser: IUserPayload,
  ): Promise<{
    driverId: string;
    userId: string;
    email: string;
    invitationToken: string;
    invitationExpiresAt: Date;
    emailSent: boolean;
    message: string;
  }> {
    const driver = await this.findOne(id, currentUser);

    const email = dto.email.toLowerCase().trim();
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const firstName = dto.firstName ?? driver.firstName;
    const lastName = dto.lastName ?? driver.lastName;

    // Helper para retornar solo el token sin modificar la BD (modo pruebas)
    const tokenOnlyResponse = async (userId: string) => {
      const companyRows = await this.dataSource
        .query<
          { name: string }[]
        >('SELECT name FROM companies WHERE id = $1', [driver.companyId])
        .catch(() => []);
      const companyName = companyRows[0]?.name ?? 'Tu empresa';
      const emailSent = await this.mailService.sendDriverInvitation({
        to: email,
        driverFirstName: firstName,
        companyName,
        token,
      });
      return {
        driverId: driver.id,
        userId,
        email,
        invitationToken: token,
        invitationExpiresAt: expiresAt,
        emailSent,
        message: 'Token generado para pruebas — comparte el token manualmente.',
      };
    };

    // Si el driver ya tiene cuenta activa, devolver solo el token
    if (driver.userId) {
      const linked = await this.userRepository.findOne({
        where: { id: driver.userId },
      });
      if (!linked || linked.status !== UserStatus.PENDING_VERIFICATION) {
        return tokenOnlyResponse(driver.userId);
      }
      driver.userId = null as any;
      await this.driverRepository.save(driver);
    }

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    let savedUser: User;

    if (existingUser) {
      if (existingUser.status !== UserStatus.PENDING_VERIFICATION) {
        // Email en uso por cuenta activa — devolver solo el token para pruebas
        return tokenOnlyResponse(existingUser.id);
      }
      // Reenvío: renovar token del usuario pendiente existente
      Object.assign(existingUser, {
        firstName,
        lastName,
        invitationToken: token,
        invitationExpiresAt: expiresAt,
        invitedById: currentUser.sub,
      });
      savedUser = await this.userRepository.save(existingUser);
    } else {
      const pendingUser = this.userRepository.create({
        email,
        firstName,
        lastName,
        phone: dto.phone ?? driver.phone ?? null,
        role: UserRole.DRIVER,
        status: UserStatus.PENDING_VERIFICATION,
        companyId: driver.companyId,
        invitedById: currentUser.sub,
        invitationToken: token,
        invitationExpiresAt: expiresAt,
        authUid: null,
      });
      savedUser = await this.userRepository.save(pendingUser);
    }

    driver.userId = savedUser.id;
    await this.driverRepository.save(driver);

    // Fetch company name for the email (non-critical, fallback on error)
    const companyRows = await this.dataSource
      .query<
        { name: string }[]
      >('SELECT name FROM companies WHERE id = $1', [driver.companyId])
      .catch(() => []);
    const companyName = companyRows[0]?.name ?? 'Tu empresa';

    // Send invitation email — non-blocking, failure doesn't abort the invite
    const emailSent = await this.mailService.sendDriverInvitation({
      to: email,
      driverFirstName: firstName,
      companyName,
      token,
    });

    this.logger.log(
      `Driver invited: ${savedUser.email} (driver=${id}) by user=${currentUser.sub} — email sent: ${emailSent}`,
    );

    return {
      driverId: driver.id,
      userId: savedUser.id,
      email: savedUser.email,
      invitationToken: token,
      invitationExpiresAt: expiresAt,
      emailSent,
      message: emailSent
        ? 'Invitación creada. Se envió un email al conductor con el token de activación.'
        : 'Invitación creada. Comparte el token con el conductor para que active su cuenta en la app.',
    };
  }

  async remove(id: string, user: IUserPayload): Promise<void> {
    const driver = await this.findOne(id, user);

    if (driver.status === DriverStatus.ON_TRIP) {
      throw new BadRequestException(
        'Cannot delete a driver who is currently on a trip',
      );
    }

    await this.driverRepository.softRemove(driver);
    this.logger.log(`Driver soft-deleted: ${driver.fullName} (${driver.id})`);
  }

  private requireCompanyId(user: IUserPayload): string {
    if (!user.companyId) {
      throw new ForbiddenException('User has no company associated');
    }
    return user.companyId;
  }

  private assertTenantAccess(driver: Driver, user: IUserPayload): void {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (driver.companyId !== user.companyId) {
      throw new ForbiddenException('You do not have access to this driver');
    }
  }

  /**
   * Verifica el límite de conductores según el plan activo de la empresa.
   * - Sin suscripción activa → FREE_PLAN_MAX_DRIVERS (1) como fallback.
   * - Con suscripción → lee global.max_drivers del jsonb del plan.
   * - Valor 99999 se trata como ilimitado (sentinel del seed enterprise).
   */
  private async checkDriverPlanLimit(companyId: string): Promise<void> {
    const rows: Array<{ limits: Record<string, Record<string, number>> }> =
      await this.dataSource.query(
        `SELECT p.limits
           FROM subscriptions s
           JOIN plans p ON p.id = s.plan_id
          WHERE s.company_id = $1 AND s.status IN ('active', 'pending_payment')
          ORDER BY s.created_at DESC
          LIMIT 1`,
        [companyId],
      );

    let maxDrivers: number;

    if (rows.length === 0) {
      maxDrivers = FREE_PLAN_MAX_DRIVERS;
    } else {
      const limits = rows[0].limits ?? {};
      const resolved = limits['global']?.['max_drivers'];

      if (resolved === undefined || resolved === -1 || resolved >= 99999) {
        return; // ilimitado
      }
      maxDrivers = resolved;
    }

    const currentCount = await this.driverRepository.count({
      where: { companyId },
    });

    if (currentCount >= maxDrivers) {
      throw new ForbiddenException(
        `Has alcanzado el límite de ${maxDrivers} conductor(es) en tu plan actual. Considera mejorar tu plan.`,
      );
    }
  }
}
