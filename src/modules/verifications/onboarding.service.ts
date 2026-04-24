import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Verification } from './entities/verification.entity';
import { VerificationTier } from './entities/verification-tier.entity';
import { Company } from '../companies/entities/company.entity';

import { ServiceType } from '../../common/enums/service-type.enum';
import { BusinessModel } from '../../common/enums/business-model.enum';
import { VerificationStatus } from '../../common/enums/verification-status.enum';
import { VerificationTierCode } from '../../common/enums/verification-tier-code.enum';
import { OnboardingWizardDto, WizardStepDto } from './dto';

/**
 * OnboardingService — PARTE 7 · Sprint 6
 *
 * Genera el wizard interactivo que guía a una empresa al completar su setup
 * según `serviceType` + `businessModel`. Mostrar este wizard es responsabilidad
 * del frontend; el backend devuelve la lista ordenada de pasos + estado.
 *
 * Pasos comunes:
 *   1. company_profile
 *   2. add_drivers
 *   3. add_trucks
 *   4. tier_basic_verification
 *
 * Pasos extra para passenger / mixed (MV-002):
 *   5. tier_passenger_safe   ← obligatorio antes de operar
 *   6. enable_recurring      ← sugiere crear plantillas para rutas escolares
 */
@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Verification)
    private readonly verificationRepo: Repository<Verification>,
    @InjectRepository(VerificationTier)
    private readonly tierRepo: Repository<VerificationTier>,
  ) {}

  /**
   * Devuelve los pasos del wizard de onboarding para una empresa concreta,
   * marcando cuáles ya están completos.
   */
  async getWizardForCompany(companyId: string): Promise<OnboardingWizardDto> {
    const company = await this.companyRepo.findOne({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException(`Company ${companyId} not found`);

    const steps = await this.buildSteps(company);
    const total = steps.length;
    const done = steps.filter((s) => s.completed).length;
    const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);

    // "Completado" si todos los steps requeridos están done
    const completed = steps.every((s) => s.completed);

    return {
      companyId: company.id,
      serviceType: company.serviceType,
      businessModel: company.businessModel,
      steps,
      progressPct,
      completed,
    };
  }

  /**
   * Devuelve la versión "preview" del wizard (sin estado) para mostrar a
   * empresas que aún no se han registrado, dado un serviceType deseado.
   */
  async previewWizard(
    serviceType: ServiceType,
    businessModel: BusinessModel = BusinessModel.SMALL_FLEET,
  ): Promise<OnboardingWizardDto> {
    const fakeCompany = {
      id: '00000000-0000-0000-0000-000000000000',
      serviceType,
      businessModel,
    } as Company;
    const steps = await this.buildSteps(fakeCompany, /* preview */ true);
    return {
      companyId: fakeCompany.id,
      serviceType,
      businessModel,
      steps,
      progressPct: 0,
      completed: false,
    };
  }

  // ─── Helpers ───────────────────────────────────
  private async buildSteps(
    company: Company,
    preview = false,
  ): Promise<WizardStepDto[]> {
    const steps: WizardStepDto[] = [];

    // 1. Perfil de empresa
    steps.push({
      key: 'company_profile',
      title: 'Completa el perfil de empresa',
      description:
        'Razón social, dirección, identificación fiscal, contacto principal',
      order: 1,
      completed: preview ? false : !!company.id,
      requiredDocuments: [],
      unlocksServiceType: null,
    });

    // 2. Drivers
    steps.push({
      key: 'add_drivers',
      title: 'Agrega al menos 1 chofer',
      description: 'Sube datos básicos y licencia de conducir',
      order: 2,
      completed: preview ? false : false, // el frontend o un módulo futuro puede resolverlo
      requiredDocuments: ['driver_license'],
      unlocksServiceType: null,
    });

    // 3. Trucks
    steps.push({
      key: 'add_trucks',
      title: 'Registra tu flota',
      description: 'Al menos 1 vehículo con placa, capacidad y seguro',
      order: 3,
      completed: preview ? false : false,
      requiredDocuments: ['vehicle_registration', 'vehicle_insurance'],
      unlocksServiceType: null,
    });

    // 4. Verificación básica
    const basicVerified = preview
      ? false
      : await this.hasApprovedTier(company.id, VerificationTierCode.BASIC);
    steps.push({
      key: 'tier_basic_verification',
      title: 'Verificación básica',
      description: 'Documentos legales para operar como carrier verificado',
      order: 4,
      completed: basicVerified,
      requiredDocuments: ['business_license', 'tax_id'],
      unlocksServiceType: ServiceType.FREIGHT,
    });

    // 5. Compliance passenger (MV-002) — solo si aplica
    if (
      company.serviceType === ServiceType.PASSENGER ||
      company.serviceType === ServiceType.MIXED
    ) {
      const passengerSafe = preview
        ? false
        : await this.hasApprovedTier(
            company.id,
            VerificationTierCode.PASSENGER_SAFE,
          );
      const tierDef = await this.tierRepo.findOne({
        where: { code: VerificationTierCode.PASSENGER_SAFE },
      });
      steps.push({
        key: 'tier_passenger_safe',
        title: 'Compliance Passenger Safe',
        description:
          'Background checks, seguro de pasajeros, monitor a bordo, primeros auxilios. ' +
          'Requerido por MV-002 antes de operar transporte de personas.',
        order: 5,
        completed: passengerSafe,
        requiredDocuments: tierDef?.requiredDocuments ?? [
          'background_check',
          'school_insurance',
          'monitor_license',
          'vehicle_safety_inspect',
          'driver_first_aid',
        ],
        unlocksServiceType: ServiceType.PASSENGER,
      });

      // 6. Habilitar plantillas recurrentes (sugerido, no bloqueante)
      steps.push({
        key: 'enable_recurring',
        title: 'Configura plantillas recurrentes',
        description:
          'Crea una RecurringTemplate por cada ruta diaria (ej. "AM Lincoln Elementary"). ' +
          'El cron generará los DeliveryRuns automáticamente.',
        order: 6,
        completed: false, // sugerencia, no bloquea
        requiredDocuments: [],
        unlocksServiceType: null,
      });
    }

    return steps;
  }

  private async hasApprovedTier(
    companyId: string,
    code: VerificationTierCode,
  ): Promise<boolean> {
    const verifications = await this.verificationRepo.find({
      where: { companyId, status: VerificationStatus.APPROVED },
      relations: ['tier'],
    });
    const now = Date.now();
    return verifications.some(
      (v) =>
        v.tier?.code === code && (!v.expiresAt || v.expiresAt.getTime() > now),
    );
  }
}
