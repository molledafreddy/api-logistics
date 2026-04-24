import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from './entities/driver.entity';
import { CreateDriverDto, UpdateDriverDto, QueryDriverDto } from './dto';
import { DriverStatus } from '../../common/enums/driver-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { PaginationResponseDto } from '../../common/dto/pagination-response.dto';

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
  ) {}

  async create(dto: CreateDriverDto, user: IUserPayload): Promise<Driver> {
    const companyId = this.requireCompanyId(user);

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
}
