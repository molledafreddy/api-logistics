import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route } from './entities/route.entity';
import { CreateRouteDto, UpdateRouteDto, QueryRouteDto } from './dto';
import { UserRole } from '../../common/enums/user-role.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { PaginationResponseDto } from '../../common/dto/pagination-response.dto';

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
  ) {}

  async create(dto: CreateRouteDto, user: IUserPayload): Promise<Route> {
    const companyId = this.requireCompanyId(user);

    const route = this.routeRepository.create({
      ...dto,
      companyId,
      status: dto.status || 'draft',
      currency: dto.currency || 'USD',
      waypoints: dto.waypoints || [],
    });

    const saved = await this.routeRepository.save(route);
    this.logger.log(`Route created: ${saved.name} (${saved.id})`);
    return saved;
  }

  async findAll(
    query: QueryRouteDto,
    user: IUserPayload,
  ): Promise<PaginationResponseDto<Route>> {
    const qb = this.routeRepository
      .createQueryBuilder('route')
      .where('route.deletedAt IS NULL');

    if (user.role === UserRole.SUPER_ADMIN) {
      if (query.companyId) {
        qb.andWhere('route.companyId = :companyId', {
          companyId: query.companyId,
        });
      }
    } else {
      const companyId = this.requireCompanyId(user);
      qb.andWhere('route.companyId = :companyId', { companyId });
    }

    if (query.search) {
      qb.andWhere(
        '(route.name ILIKE :search OR route.originAddress ILIKE :search OR route.destinationAddress ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.status) {
      qb.andWhere('route.status = :status', { status: query.status });
    }

    const allowedSort = [
      'name',
      'status',
      'distanceKm',
      'estimatedDurationMin',
      'createdAt',
    ];
    const sortBy = allowedSort.includes(query.sortBy || '')
      ? `route.${query.sortBy}`
      : 'route.createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortBy, sortOrder);

    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return PaginationResponseDto.create(data, total, query.page, query.limit);
  }

  async findOne(id: string, user: IUserPayload): Promise<Route> {
    const route = await this.routeRepository.findOne({ where: { id } });
    if (!route) {
      throw new NotFoundException(`Route ${id} not found`);
    }
    this.assertTenantAccess(route, user);
    return route;
  }

  async update(
    id: string,
    dto: UpdateRouteDto,
    user: IUserPayload,
  ): Promise<Route> {
    const route = await this.findOne(id, user);
    Object.assign(route, dto);
    const saved = await this.routeRepository.save(route);
    this.logger.log(`Route updated: ${saved.name} (${saved.id})`);
    return saved;
  }

  async duplicate(id: string, user: IUserPayload): Promise<Route> {
    const original = await this.findOne(id, user);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt, updatedAt, deletedAt, ...rest } = original;
    const copy = this.routeRepository.create({
      ...rest,
      name: `${original.name} (copy)`,
      status: 'draft',
    });
    const saved = await this.routeRepository.save(copy);
    this.logger.log(`Route duplicated: ${original.name} -> ${saved.id}`);
    return saved;
  }

  async setStatus(
    id: string,
    status: 'draft' | 'active' | 'archived',
    user: IUserPayload,
  ): Promise<Route> {
    const route = await this.findOne(id, user);
    route.status = status;
    return this.routeRepository.save(route);
  }

  async remove(id: string, user: IUserPayload): Promise<void> {
    const route = await this.findOne(id, user);
    await this.routeRepository.softRemove(route);
    this.logger.log(`Route soft-deleted: ${route.name} (${route.id})`);
  }

  private requireCompanyId(user: IUserPayload): string {
    if (!user.companyId) {
      throw new ForbiddenException('User has no company associated');
    }
    return user.companyId;
  }

  private assertTenantAccess(route: Route, user: IUserPayload): void {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (route.companyId !== user.companyId) {
      throw new ForbiddenException('You do not have access to this route');
    }
  }
}
