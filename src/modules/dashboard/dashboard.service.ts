import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment } from '../shipments/entities/shipment.entity';
import { Truck } from '../trucks/entities/truck.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { ShipmentStatus } from '../../common/enums/shipment-status.enum';
import { TruckStatus } from '../../common/enums/truck-status.enum';
import { DriverStatus } from '../../common/enums/driver-status.enum';
import { ExpenseStatus } from '../../common/enums/expense-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { DashboardQueryDto } from './dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Shipment)
    private readonly shipmentRepo: Repository<Shipment>,
    @InjectRepository(Truck) private readonly truckRepo: Repository<Truck>,
    @InjectRepository(Driver) private readonly driverRepo: Repository<Driver>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
  ) {}

  // ─── Resumen general (KPIs) ──────────────
  async overview(query: DashboardQueryDto, user: IUserPayload) {
    const companyId = this.resolveCompanyId(query, user);

    const [
      shipmentsTotal,
      shipmentsActive,
      shipmentsCompleted,
      trucksTotal,
      trucksAvailable,
      trucksInTransit,
      driversTotal,
      driversOnTrip,
      expensesPending,
    ] = await Promise.all([
      this.countShipments(companyId, {}),
      this.countShipments(companyId, {
        statusIn: [
          ShipmentStatus.ASSIGNED,
          ShipmentStatus.PICKED_UP,
          ShipmentStatus.IN_TRANSIT,
          ShipmentStatus.AT_STOP,
        ],
      }),
      this.countShipments(companyId, { statusIn: [ShipmentStatus.COMPLETED] }),
      this.countTrucks(companyId, {}),
      this.countTrucks(companyId, { status: TruckStatus.AVAILABLE }),
      this.countTrucks(companyId, { status: TruckStatus.IN_TRANSIT }),
      this.countDrivers(companyId, {}),
      this.countDrivers(companyId, { status: DriverStatus.ON_TRIP }),
      this.countExpenses(companyId, { status: ExpenseStatus.PENDING }),
    ]);

    return {
      shipments: {
        total: shipmentsTotal,
        active: shipmentsActive,
        completed: shipmentsCompleted,
      },
      trucks: {
        total: trucksTotal,
        available: trucksAvailable,
        inTransit: trucksInTransit,
        utilization: trucksTotal > 0 ? trucksInTransit / trucksTotal : 0,
      },
      drivers: {
        total: driversTotal,
        onTrip: driversOnTrip,
      },
      expenses: {
        pendingApproval: expensesPending,
      },
    };
  }

  async shipmentsByStatus(query: DashboardQueryDto, user: IUserPayload) {
    const companyId = this.resolveCompanyId(query, user);

    const qb = this.shipmentRepo
      .createQueryBuilder('s')
      .where('s.deletedAt IS NULL');
    if (companyId) qb.andWhere('s.companyId = :companyId', { companyId });
    if (query.from) qb.andWhere('s.createdAt >= :from', { from: query.from });
    if (query.to) qb.andWhere('s.createdAt <= :to', { to: query.to });

    const rows = await qb
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('s.status')
      .getRawMany();

    return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
  }

  async revenue(query: DashboardQueryDto, user: IUserPayload) {
    const companyId = this.resolveCompanyId(query, user);

    const qb = this.shipmentRepo
      .createQueryBuilder('s')
      .where('s.deletedAt IS NULL')
      .andWhere('s.status = :status', { status: ShipmentStatus.COMPLETED });
    if (companyId) qb.andWhere('s.companyId = :companyId', { companyId });
    if (query.from) qb.andWhere('s.deliveredAt >= :from', { from: query.from });
    if (query.to) qb.andWhere('s.deliveredAt <= :to', { to: query.to });

    const result = await qb
      .select('SUM(s.price)', 'totalRevenue')
      .addSelect('COUNT(*)', 'shipments')
      .addSelect('AVG(s.price)', 'avgPerShipment')
      .getRawOne();

    return {
      totalRevenue: Number(result?.totalRevenue || 0),
      shipments: Number(result?.shipments || 0),
      avgPerShipment: Number(result?.avgPerShipment || 0),
    };
  }

  async expensesByCategory(query: DashboardQueryDto, user: IUserPayload) {
    const companyId = this.resolveCompanyId(query, user);

    const qb = this.expenseRepo
      .createQueryBuilder('e')
      .where('e.deletedAt IS NULL');
    if (companyId) qb.andWhere('e.companyId = :companyId', { companyId });
    if (query.from) qb.andWhere('e.expenseDate >= :from', { from: query.from });
    if (query.to) qb.andWhere('e.expenseDate <= :to', { to: query.to });

    const rows = await qb
      .select('e.category', 'category')
      .addSelect('SUM(e.amount)', 'total')
      .addSelect('COUNT(*)', 'count')
      .groupBy('e.category')
      .orderBy('total', 'DESC')
      .getRawMany();

    return rows.map((r) => ({
      category: r.category,
      total: Number(r.total),
      count: Number(r.count),
    }));
  }

  async fleetUtilization(query: DashboardQueryDto, user: IUserPayload) {
    const companyId = this.resolveCompanyId(query, user);

    const qb = this.truckRepo
      .createQueryBuilder('t')
      .where('t.deletedAt IS NULL');
    if (companyId) qb.andWhere('t.companyId = :companyId', { companyId });

    const rows = await qb
      .select('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.status')
      .getRawMany();

    const total = rows.reduce((acc, r) => acc + Number(r.count), 0);

    return {
      total,
      byStatus: rows.map((r) => ({
        status: r.status,
        count: Number(r.count),
        percentage: total > 0 ? Number(r.count) / total : 0,
      })),
    };
  }

  async topDrivers(query: DashboardQueryDto, user: IUserPayload) {
    const companyId = this.resolveCompanyId(query, user);

    const qb = this.driverRepo
      .createQueryBuilder('d')
      .where('d.deletedAt IS NULL');
    if (companyId) qb.andWhere('d.companyId = :companyId', { companyId });

    qb.orderBy('d.totalTrips', 'DESC')
      .addOrderBy('d.ratingAvg', 'DESC')
      .take(10);

    const drivers = await qb.getMany();

    return drivers.map((d) => ({
      id: d.id,
      name: d.fullName,
      totalTrips: d.totalTrips,
      rating: Number(d.ratingAvg),
      status: d.status,
    }));
  }

  // ─── Helpers ────────────────────────────
  private resolveCompanyId(
    query: DashboardQueryDto,
    user: IUserPayload,
  ): string | null {
    if (user.role === UserRole.SUPER_ADMIN) {
      return query.companyId || null; // null = todos
    }
    if (!user.companyId) {
      throw new ForbiddenException('User has no company associated');
    }
    return user.companyId;
  }

  private async countShipments(
    companyId: string | null,
    filters: { statusIn?: ShipmentStatus[] },
  ): Promise<number> {
    const qb = this.shipmentRepo
      .createQueryBuilder('s')
      .where('s.deletedAt IS NULL');
    if (companyId) qb.andWhere('s.companyId = :cid', { cid: companyId });
    if (filters.statusIn?.length) {
      qb.andWhere('s.status IN (:...statuses)', { statuses: filters.statusIn });
    }
    return qb.getCount();
  }

  private async countTrucks(
    companyId: string | null,
    filters: { status?: TruckStatus },
  ): Promise<number> {
    const qb = this.truckRepo
      .createQueryBuilder('t')
      .where('t.deletedAt IS NULL');
    if (companyId) qb.andWhere('t.companyId = :cid', { cid: companyId });
    if (filters.status) qb.andWhere('t.status = :s', { s: filters.status });
    return qb.getCount();
  }

  private async countDrivers(
    companyId: string | null,
    filters: { status?: DriverStatus },
  ): Promise<number> {
    const qb = this.driverRepo
      .createQueryBuilder('d')
      .where('d.deletedAt IS NULL');
    if (companyId) qb.andWhere('d.companyId = :cid', { cid: companyId });
    if (filters.status) qb.andWhere('d.status = :s', { s: filters.status });
    return qb.getCount();
  }

  private async countExpenses(
    companyId: string | null,
    filters: { status?: ExpenseStatus },
  ): Promise<number> {
    const qb = this.expenseRepo
      .createQueryBuilder('e')
      .where('e.deletedAt IS NULL');
    if (companyId) qb.andWhere('e.companyId = :cid', { cid: companyId });
    if (filters.status) qb.andWhere('e.status = :s', { s: filters.status });
    return qb.getCount();
  }
}
