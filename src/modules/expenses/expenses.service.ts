import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { CreateExpenseDto, UpdateExpenseDto, QueryExpenseDto } from './dto';
import { ExpenseStatus } from '../../common/enums/expense-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { requireCompanyId } from '../../common/helpers/tenant.helpers';
import { PaginationResponseDto } from '../../common/dto/pagination-response.dto';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async create(dto: CreateExpenseDto, user: IUserPayload): Promise<Expense> {
    const companyId = requireCompanyId(user);

    const expense = this.expenseRepository.create({
      ...dto,
      companyId,
      createdBy: user.sub,
      status: ExpenseStatus.PENDING,
      currency: dto.currency || 'USD',
    });

    const saved = await this.expenseRepository.save(expense);
    this.logger.log(
      `Expense created: ${saved.amount} ${saved.currency} (${saved.id})`,
    );
    return saved;
  }

  async findAll(
    query: QueryExpenseDto,
    user: IUserPayload,
  ): Promise<PaginationResponseDto<Expense>> {
    const qb = this.expenseRepository
      .createQueryBuilder('exp')
      .where('exp.deletedAt IS NULL');

    if (user.role === UserRole.SUPER_ADMIN) {
      if (query.companyId) {
        qb.andWhere('exp.companyId = :companyId', {
          companyId: query.companyId,
        });
      }
    } else {
      const companyId = requireCompanyId(user);
      qb.andWhere('exp.companyId = :companyId', { companyId });

      // Drivers solo ven los suyos
      if (user.role === UserRole.DRIVER) {
        qb.andWhere('exp.createdBy = :uid', { uid: user.sub });
      }
    }

    if (query.search) {
      qb.andWhere(
        '(exp.description ILIKE :search OR exp.vendorName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.status)
      qb.andWhere('exp.status = :status', { status: query.status });
    if (query.category)
      qb.andWhere('exp.category = :category', { category: query.category });
    if (query.deliveryRunId)
      qb.andWhere('exp.deliveryRunId = :runId', { runId: query.deliveryRunId });
    if (query.shipmentId)
      qb.andWhere('exp.shipmentId = :sid', { sid: query.shipmentId });
    if (query.truckId)
      qb.andWhere('exp.truckId = :tid', { tid: query.truckId });
    if (query.driverId)
      qb.andWhere('exp.driverId = :did', { did: query.driverId });
    if (query.dateFrom)
      qb.andWhere('exp.expenseDate >= :df', { df: query.dateFrom });
    if (query.dateTo)
      qb.andWhere('exp.expenseDate <= :dt', { dt: query.dateTo });

    const allowedSort = [
      'amount',
      'expenseDate',
      'status',
      'category',
      'createdAt',
    ];
    const sortBy = allowedSort.includes(query.sortBy || '')
      ? `exp.${query.sortBy}`
      : 'exp.expenseDate';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortBy, sortOrder);

    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return PaginationResponseDto.create(data, total, query.page, query.limit);
  }

  async findOne(id: string, user: IUserPayload): Promise<Expense> {
    const expense = await this.expenseRepository.findOne({ where: { id } });
    if (!expense) {
      throw new NotFoundException(`Expense ${id} not found`);
    }
    this.assertTenantAccess(expense, user);
    return expense;
  }

  async update(
    id: string,
    dto: UpdateExpenseDto,
    user: IUserPayload,
  ): Promise<Expense> {
    const expense = await this.findOne(id, user);

    if (expense.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException(
        `Only pending expenses can be edited (current: ${expense.status})`,
      );
    }

    Object.assign(expense, dto);
    return this.expenseRepository.save(expense);
  }

  async approve(id: string, user: IUserPayload): Promise<Expense> {
    const expense = await this.findOne(id, user);

    if (expense.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException(
        `Only pending expenses can be approved (current: ${expense.status})`,
      );
    }

    expense.status = ExpenseStatus.APPROVED;
    expense.approvedBy = user.sub;
    expense.approvedAt = new Date();

    return this.expenseRepository.save(expense);
  }

  async reject(
    id: string,
    reason: string,
    user: IUserPayload,
  ): Promise<Expense> {
    const expense = await this.findOne(id, user);

    if (expense.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException(
        `Only pending expenses can be rejected (current: ${expense.status})`,
      );
    }

    expense.status = ExpenseStatus.REJECTED;
    expense.rejectionReason = reason;
    expense.approvedBy = user.sub;
    expense.approvedAt = new Date();

    return this.expenseRepository.save(expense);
  }

  async reimburse(id: string, user: IUserPayload): Promise<Expense> {
    const expense = await this.findOne(id, user);

    if (expense.status !== ExpenseStatus.APPROVED) {
      throw new BadRequestException(
        `Only approved expenses can be reimbursed (current: ${expense.status})`,
      );
    }

    expense.status = ExpenseStatus.REIMBURSED;
    expense.reimbursedAt = new Date();

    return this.expenseRepository.save(expense);
  }

  async getSummary(query: QueryExpenseDto, user: IUserPayload) {
    const qb = this.expenseRepository
      .createQueryBuilder('exp')
      .where('exp.deletedAt IS NULL');

    if (user.role !== UserRole.SUPER_ADMIN) {
      const companyId = requireCompanyId(user);
      qb.andWhere('exp.companyId = :companyId', { companyId });
    } else if (query.companyId) {
      qb.andWhere('exp.companyId = :companyId', { companyId: query.companyId });
    }

    if (query.dateFrom)
      qb.andWhere('exp.expenseDate >= :df', { df: query.dateFrom });
    if (query.dateTo)
      qb.andWhere('exp.expenseDate <= :dt', { dt: query.dateTo });

    const rows = await qb
      .select('exp.category', 'category')
      .addSelect('exp.status', 'status')
      .addSelect('SUM(exp.amount)', 'total')
      .addSelect('COUNT(*)', 'count')
      .groupBy('exp.category')
      .addGroupBy('exp.status')
      .getRawMany();

    const totalAmount = rows.reduce((acc, r) => acc + Number(r.total), 0);

    return {
      totalAmount,
      totalCount: rows.reduce((acc, r) => acc + Number(r.count), 0),
      byCategoryStatus: rows.map((r) => ({
        category: r.category,
        status: r.status,
        total: Number(r.total),
        count: Number(r.count),
      })),
    };
  }

  async remove(id: string, user: IUserPayload): Promise<void> {
    const expense = await this.findOne(id, user);

    if (expense.status === ExpenseStatus.REIMBURSED) {
      throw new BadRequestException('Cannot delete a reimbursed expense');
    }

    await this.expenseRepository.softRemove(expense);
  }

  private assertTenantAccess(expense: Expense, user: IUserPayload): void {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (expense.companyId !== user.companyId) {
      throw new ForbiddenException('You do not have access to this expense');
    }
    if (user.role === UserRole.DRIVER && expense.createdBy !== user.sub) {
      throw new ForbiddenException(
        'Drivers can only access their own expenses',
      );
    }
  }
}
