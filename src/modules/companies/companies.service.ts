import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { QueryCompanyDto } from './dto/query-company.dto';
import { CompanyStatus } from '../../common/enums/company-status.enum';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';
import { UserRole } from '../../common/enums/user-role.enum';
import { PaginationResponseDto } from '../../common/dto/pagination-response.dto';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  /**
   * Create a new company.
   * Called internally during registration or by super_admin.
   */
  async create(dto: CreateCompanyDto, ownerId?: string): Promise<Company> {
    const company = this.companyRepository.create({
      ...dto,
      ownerId: ownerId || null,
      status: CompanyStatus.PENDING_VERIFICATION,
    });

    const saved = await this.companyRepository.save(company);
    this.logger.log(`Company created: ${saved.name} (${saved.id})`);
    return saved;
  }

  /**
   * Find all companies with filters and pagination.
   * super_admin sees all; company users see only their own.
   */
  async findAll(
    query: QueryCompanyDto,
    currentUser: IUserPayload,
  ): Promise<PaginationResponseDto<Company>> {
    const qb = this.companyRepository
      .createQueryBuilder('company')
      .where('company.deletedAt IS NULL');

    // Non-super_admin can only see their own company
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      if (!currentUser.companyId) {
        return PaginationResponseDto.create([], 0, query.page, query.limit);
      }
      qb.andWhere('company.id = :companyId', {
        companyId: currentUser.companyId,
      });
    }

    // Filters
    if (query.search) {
      qb.andWhere('company.name ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    if (query.type) {
      qb.andWhere('company.type = :type', { type: query.type });
    }

    if (query.status) {
      qb.andWhere('company.status = :status', { status: query.status });
    }

    // Sorting
    const allowedSortFields = ['name', 'type', 'status', 'createdAt'];
    const sortBy = allowedSortFields.includes(query.sortBy || '')
      ? `company.${query.sortBy}`
      : 'company.createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortBy, sortOrder);

    // Pagination
    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return PaginationResponseDto.create(data, total, query.page, query.limit);
  }

  /**
   * Find a company by ID.
   * Validates access based on user role.
   */
  async findOne(id: string, currentUser: IUserPayload): Promise<Company> {
    const company = await this.companyRepository.findOne({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Access check: only super_admin or members of the company
    if (
      currentUser.role !== UserRole.SUPER_ADMIN &&
      currentUser.companyId !== company.id
    ) {
      throw new ForbiddenException('No tienes acceso a esta empresa');
    }

    return company;
  }

  /**
   * Update a company.
   * Only owner, admin, or super_admin can update.
   */
  async update(
    id: string,
    dto: UpdateCompanyDto,
    currentUser: IUserPayload,
  ): Promise<Company> {
    const company = await this.findOne(id, currentUser);

    // Only owner, admin roles or super_admin can update
    const canUpdate = [
      UserRole.SUPER_ADMIN,
      UserRole.COMPANY_OWNER,
      UserRole.ADMIN,
    ];
    if (!canUpdate.includes(currentUser.role)) {
      throw new ForbiddenException(
        'No tienes permisos para actualizar esta empresa',
      );
    }

    Object.assign(company, dto);
    const updated = await this.companyRepository.save(company);

    this.logger.log(`Company updated: ${updated.name} (${updated.id})`);
    return updated;
  }

  /**
   * Soft delete a company.
   * Only super_admin or company_owner can delete.
   */
  async remove(id: string, currentUser: IUserPayload): Promise<void> {
    const company = await this.findOne(id, currentUser);

    const canDelete = [UserRole.SUPER_ADMIN, UserRole.COMPANY_OWNER];
    if (!canDelete.includes(currentUser.role)) {
      throw new ForbiddenException(
        'No tienes permisos para eliminar esta empresa',
      );
    }

    await this.companyRepository.softRemove(company);
    this.logger.log(`Company soft-deleted: ${company.name} (${company.id})`);
  }

  /**
   * Find a company by ID without access control (internal use).
   */
  async findById(id: string): Promise<Company | null> {
    return this.companyRepository.findOne({ where: { id } });
  }
}
