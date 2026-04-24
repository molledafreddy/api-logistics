import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Verification } from './entities/verification.entity';
import { VerificationTier } from './entities/verification-tier.entity';
import { VerificationDocument } from './entities/verification-document.entity';
import { Company } from '../companies/entities/company.entity';

import { VerificationStatus } from '../../common/enums/verification-status.enum';
import { VerificationTierCode } from '../../common/enums/verification-tier-code.enum';
import { ServiceType } from '../../common/enums/service-type.enum';
import { ComplianceStatusDto } from './dto';

/**
 * ComplianceService — PARTE 7 · Sprint 6
 *
 * Resuelve si una empresa puede operar en función de su `serviceType` y de
 * sus verificaciones aprobadas/vigentes. Implementa la regla MV-002:
 *   serviceType ∈ {passenger, mixed} ⇒ requiere tier `passenger_safe` aprobado y no expirado.
 *
 * También expone un helper `assertCanOperatePassenger(companyId)` para que
 * `DeliveryRunsService` lo invoque antes de iniciar runs con pasajeros.
 */
@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    @InjectRepository(Verification)
    private readonly verificationRepo: Repository<Verification>,
    @InjectRepository(VerificationTier)
    private readonly tierRepo: Repository<VerificationTier>,
    @InjectRepository(VerificationDocument)
    private readonly docRepo: Repository<VerificationDocument>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  /**
   * Devuelve el snapshot de cumplimiento de una empresa.
   * No lanza: el caller decide qué hacer con `canOperate=false`.
   */
  async getCompanyCompliance(companyId: string): Promise<ComplianceStatusDto> {
    const company = await this.companyRepo.findOne({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException(`Company ${companyId} not found`);

    const requiredTier = this.requiredTierFor(company.serviceType);

    // Cargar todas las verificaciones aprobadas y vigentes
    const approved = await this.verificationRepo.find({
      where: { companyId, status: VerificationStatus.APPROVED },
      relations: ['tier'],
      order: { approvedAt: 'DESC' },
    });

    const now = Date.now();
    const valid = approved.filter(
      (v) => !v.expiresAt || v.expiresAt.getTime() > now,
    );

    // Tier vigente "más alto" por displayOrder (criterio simple: el primero por approvedAt DESC vigente).
    const currentValid = valid[0] ?? null;
    const currentTier =
      (currentValid?.tier?.code as VerificationTierCode | undefined) ?? null;
    const currentTierExpiresAt = currentValid?.expiresAt ?? null;

    let hasRequiredTier = false;
    let blockReason: string | null = null;
    let missingDocuments: string[] = [];

    if (!requiredTier) {
      // serviceType=freight → no hay requisito extra de tier
      hasRequiredTier = true;
    } else {
      const matchingValid = valid.find((v) => v.tier?.code === requiredTier);
      if (matchingValid) {
        hasRequiredTier = true;
      } else {
        // Buscar la verificación más reciente del tier requerido (cualquier estado)
        // para identificar la razón exacta + documentos faltantes
        const latest = await this.verificationRepo.findOne({
          where: { companyId },
          relations: ['tier', 'documents'],
          order: { createdAt: 'DESC' },
        });
        if (!latest || latest.tier?.code !== requiredTier) {
          blockReason = 'no_verification';
          // Calcular documentos faltantes a partir del tier de catálogo
          const tierDef = await this.tierRepo.findOne({
            where: { code: requiredTier },
          });
          missingDocuments = tierDef?.requiredDocuments ?? [];
        } else if (latest.status === VerificationStatus.APPROVED) {
          // Está aprobada pero expirada (filtrada arriba)
          blockReason = 'tier_expired';
          missingDocuments = [];
        } else {
          blockReason = 'tier_not_approved';
          // Documentos requeridos por el tier menos los ya subidos en latest
          const tierDef = latest.tier;
          const required = tierDef?.requiredDocuments ?? [];
          const uploaded = new Set(
            (latest.documents ?? []).map((d) => d.documentType),
          );
          missingDocuments = required.filter((d) => !uploaded.has(d));
        }
      }
    }

    return {
      companyId,
      serviceType: company.serviceType,
      requiredTier,
      currentTier,
      currentTierExpiresAt,
      hasRequiredTier,
      canOperate: hasRequiredTier,
      blockReason,
      missingDocuments,
    };
  }

  /**
   * MV-002 — Garantiza que la empresa puede operar transporte de pasajeros.
   * Lanza `ForbiddenException` si no cumple. Llamar desde DeliveryRunsService.start()
   * cuando la empresa o el run involucran pasajeros.
   */
  async assertCanOperatePassenger(companyId: string): Promise<void> {
    const status = await this.getCompanyCompliance(companyId);
    if (status.serviceType === ServiceType.FREIGHT) return; // no aplica
    if (!status.canOperate) {
      throw new ForbiddenException(
        `MV-002: company ${companyId} cannot operate passenger transport ` +
          `(reason=${status.blockReason}, requiredTier=${status.requiredTier})`,
      );
    }
  }

  // ─── Helpers ───────────────────────────────────
  private requiredTierFor(serviceType: string): VerificationTierCode | null {
    if (
      serviceType === ServiceType.PASSENGER ||
      serviceType === ServiceType.MIXED
    ) {
      return VerificationTierCode.PASSENGER_SAFE;
    }
    return null;
  }
}
