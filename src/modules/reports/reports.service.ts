import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment } from '../shipments/entities/shipment.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Truck } from '../trucks/entities/truck.entity';
import { ShipmentStatus } from '../../common/enums/shipment-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { ReportQueryDto, ShipmentReportQueryDto } from './dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Shipment)
    private readonly shipmentRepo: Repository<Shipment>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(Driver) private readonly driverRepo: Repository<Driver>,
    @InjectRepository(Truck) private readonly truckRepo: Repository<Truck>,
  ) {}

  // ─── Reporte de Shipments ───────────────
  async shipments(query: ShipmentReportQueryDto, user: IUserPayload) {
    const companyId = this.resolveCompanyId(query, user);

    const qb = this.shipmentRepo
      .createQueryBuilder('s')
      .where('s.deletedAt IS NULL');
    if (companyId) qb.andWhere('s.companyId = :cid', { cid: companyId });
    if (query.status)
      qb.andWhere('s.status = :status', { status: query.status });
    if (query.from) qb.andWhere('s.createdAt >= :from', { from: query.from });
    if (query.to) qb.andWhere('s.createdAt <= :to', { to: query.to });

    const shipments = await qb
      .orderBy('s.createdAt', 'DESC')
      .take(10000)
      .getMany();

    return shipments.map((s) => ({
      id: s.id,
      trackingCode: s.trackingCode,
      status: s.status,
      originAddress: s.originAddress,
      destinationAddress: s.destinationAddress,
      price: Number(s.price || 0),
      driverId: s.driverId,
      truckId: s.truckId,
      createdAt: s.createdAt,
      pickedUpAt: s.pickedUpAt,
      deliveredAt: s.deliveredAt,
    }));
  }

  // ─── Reporte de Expenses ────────────────
  async expenses(query: ReportQueryDto, user: IUserPayload) {
    const companyId = this.resolveCompanyId(query, user);

    const qb = this.expenseRepo
      .createQueryBuilder('e')
      .where('e.deletedAt IS NULL');
    if (companyId) qb.andWhere('e.companyId = :cid', { cid: companyId });
    if (query.from) qb.andWhere('e.expenseDate >= :from', { from: query.from });
    if (query.to) qb.andWhere('e.expenseDate <= :to', { to: query.to });

    const expenses = await qb
      .orderBy('e.expenseDate', 'DESC')
      .take(10000)
      .getMany();

    return expenses.map((e) => ({
      id: e.id,
      category: e.category,
      amount: Number(e.amount),
      currency: e.currency,
      status: e.status,
      expenseDate: e.expenseDate,
      shipmentId: e.shipmentId,
      truckId: e.truckId,
      driverId: e.driverId,
      createdBy: e.createdBy,
      approvedBy: e.approvedBy,
      reimbursedAt: e.reimbursedAt,
    }));
  }

  // ─── Reporte de performance de drivers ──
  async driversPerformance(query: ReportQueryDto, user: IUserPayload) {
    const companyId = this.resolveCompanyId(query, user);

    const drivers = await this.driverRepo
      .createQueryBuilder('d')
      .where('d.deletedAt IS NULL')
      .andWhere(companyId ? 'd.companyId = :cid' : '1=1', { cid: companyId })
      .orderBy('d.totalTrips', 'DESC')
      .getMany();

    const result = [] as Array<Record<string, unknown>>;
    for (const d of drivers) {
      const sQb = this.shipmentRepo
        .createQueryBuilder('s')
        .where('s.deletedAt IS NULL')
        .andWhere('s.driverId = :did', { did: d.id });
      if (query.from)
        sQb.andWhere('s.createdAt >= :from', { from: query.from });
      if (query.to) sQb.andWhere('s.createdAt <= :to', { to: query.to });

      const [completed, cancelled, totalRevenue] = await Promise.all([
        sQb
          .clone()
          .andWhere('s.status = :st', { st: ShipmentStatus.COMPLETED })
          .getCount(),
        sQb
          .clone()
          .andWhere('s.status = :st', { st: ShipmentStatus.CANCELLED })
          .getCount(),
        sQb
          .clone()
          .andWhere('s.status = :st', { st: ShipmentStatus.COMPLETED })
          .select('COALESCE(SUM(s.price), 0)', 'total')
          .getRawOne()
          .then((r) => Number(r?.total || 0)),
      ]);

      result.push({
        driverId: d.id,
        name: d.fullName,
        status: d.status,
        totalTripsLifetime: d.totalTrips,
        ratingAvg: Number(d.ratingAvg),
        completedInPeriod: completed,
        cancelledInPeriod: cancelled,
        revenueGenerated: totalRevenue,
      });
    }

    return result;
  }

  // ─── Reporte financiero ─────────────────
  async financialSummary(query: ReportQueryDto, user: IUserPayload) {
    const companyId = this.resolveCompanyId(query, user);

    const sQb = this.shipmentRepo
      .createQueryBuilder('s')
      .where('s.deletedAt IS NULL')
      .andWhere('s.status = :st', { st: ShipmentStatus.COMPLETED });
    if (companyId) sQb.andWhere('s.companyId = :cid', { cid: companyId });
    if (query.from)
      sQb.andWhere('s.deliveredAt >= :from', { from: query.from });
    if (query.to) sQb.andWhere('s.deliveredAt <= :to', { to: query.to });

    const eQb = this.expenseRepo
      .createQueryBuilder('e')
      .where('e.deletedAt IS NULL');
    if (companyId) eQb.andWhere('e.companyId = :cid', { cid: companyId });
    if (query.from)
      eQb.andWhere('e.expenseDate >= :from', { from: query.from });
    if (query.to) eQb.andWhere('e.expenseDate <= :to', { to: query.to });

    const [revenueRow, expenseRow, expensesByCat] = await Promise.all([
      sQb
        .select('COALESCE(SUM(s.price), 0)', 'total')
        .addSelect('COUNT(*)', 'count')
        .getRawOne(),
      eQb
        .clone()
        .select('COALESCE(SUM(e.amount), 0)', 'total')
        .addSelect('COUNT(*)', 'count')
        .getRawOne(),
      eQb
        .clone()
        .select('e.category', 'category')
        .addSelect('COALESCE(SUM(e.amount), 0)', 'total')
        .groupBy('e.category')
        .getRawMany(),
    ]);

    const totalRevenue = Number(revenueRow?.total || 0);
    const totalExpenses = Number(expenseRow?.total || 0);
    const netProfit = totalRevenue - totalExpenses;

    return {
      period: { from: query.from || null, to: query.to || null },
      revenue: {
        total: totalRevenue,
        shipments: Number(revenueRow?.count || 0),
      },
      expenses: {
        total: totalExpenses,
        count: Number(expenseRow?.count || 0),
        byCategory: expensesByCat.map((r) => ({
          category: r.category,
          total: Number(r.total),
        })),
      },
      netProfit,
      profitMargin: totalRevenue > 0 ? netProfit / totalRevenue : 0,
    };
  }

  // ─── Helpers ────────────────────────────
  toCsv(rows: Array<Record<string, unknown>>): string {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const escape = (v: unknown) => {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map((h) => escape(row[h])).join(','));
    }
    return lines.join('\n');
  }

  private resolveCompanyId(
    query: ReportQueryDto,
    user: IUserPayload,
  ): string | null {
    if (user.role === UserRole.SUPER_ADMIN) {
      return query.companyId || null;
    }
    if (!user.companyId) {
      throw new ForbiddenException('User has no company associated');
    }
    return user.companyId;
  }
}
