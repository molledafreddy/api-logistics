import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { RecurringTemplatesService } from './recurring-templates.service';
import { RecurringTemplate } from './entities/recurring-template.entity';
import { RecurrencePattern } from '../../common/enums/recurrence-pattern.enum';
import { DeliveryRunStatus } from '../../common/enums/delivery-run-status.enum';
import { ShipmentStatus } from '../../common/enums/shipment-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { INTERNAL_EVENTS } from '../../gateways/events/internal.events';

/**
 * Tests unitarios — RecurringTemplatesService.
 * Mockea repos + dataSource. Cubre RT-001…RT-005 + idempotencia + cron filtering.
 */
describe('RecurringTemplatesService', () => {
  const COMPANY_A = 'company-a-uuid';
  const COMPANY_B = 'company-b-uuid';

  let service: RecurringTemplatesService;
  let templateRepo: any;
  let runRepo: any;
  let shipmentRepo: any;
  let truckRepo: any;
  let driverRepo: any;
  let dataSource: any;
  let eventEmitter: EventEmitter2;

  const managerUser = (companyId = COMPANY_A) => ({
    sub: 'mgr-1',
    email: 'mgr@a.com',
    role: UserRole.MANAGER,
    companyId,
  });
  const driverUser = () => ({
    sub: 'drv-1',
    email: 'd@a.com',
    role: UserRole.DRIVER,
    companyId: COMPANY_A,
  });

  function buildTemplate(
    overrides: Partial<RecurringTemplate> = {},
  ): RecurringTemplate {
    return Object.assign(new RecurringTemplate(), {
      id: 'tpl-1',
      companyId: COMPANY_A,
      name: 'AM Lincoln',
      pattern: RecurrencePattern.WEEKLY,
      daysOfWeek: [1, 2, 3, 4, 5],
      time: '07:00',
      startDate: '2026-01-01',
      endDate: null,
      exceptions: [],
      driverId: 'driver-uuid-1',
      truckId: 'truck-uuid-1',
      routeId: null,
      shipmentTemplates: [
        {
          originAddress: 'A',
          destinationAddress: 'B',
          description: 'Bart',
          cargoType: 'passenger',
          metadata: { passenger: { fullName: 'Bart Simpson' } },
        },
      ],
      active: true,
      lastGeneratedAt: null,
      metadata: {},
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as RecurringTemplate);
  }

  beforeEach(() => {
    const state: any = { templates: [], runs: [], shipments: [] };

    templateRepo = {
      _state: state,
      create: (data: any) => Object.assign(new RecurringTemplate(), data),
      save: jest.fn(async (tpl: any) => {
        if (!tpl.id) tpl.id = 'tpl-' + (state.templates.length + 1);
        const idx = state.templates.findIndex((t: any) => t.id === tpl.id);
        if (idx >= 0) state.templates[idx] = tpl;
        else state.templates.push(tpl);
        return tpl;
      }),
      softRemove: jest.fn(async (tpl: any) => {
        tpl.deletedAt = new Date();
        return tpl;
      }),
      findOne: jest.fn(
        async (opts: any) =>
          state.templates.find((t: any) => t.id === opts.where.id) ?? null,
      ),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: () => {
        const conds: Array<(t: any) => boolean> = [];
        const params: any = {};
        const qb: any = {
          where: (sql: string) => {
            applyCond(sql, params, conds);
            return qb;
          },
          andWhere: (sql: string, p?: any) => {
            Object.assign(params, p ?? {});
            applyCond(sql, params, conds);
            return qb;
          },
          orderBy: () => qb,
          skip: () => qb,
          take: () => qb,
          getManyAndCount: async () => {
            const filtered = state.templates.filter((t: any) =>
              conds.every((fn) => fn(t)),
            );
            return [filtered, filtered.length];
          },
          getMany: async () =>
            state.templates.filter((t: any) => conds.every((fn) => fn(t))),
        };
        return qb;
      },
    };

    runRepo = {
      _state: state,
      findOne: jest.fn(async (opts: any) => {
        return (
          state.runs.find((r: any) => {
            if (opts.where.id && r.id !== opts.where.id) return false;
            if (
              opts.where.recurringTemplateId &&
              r.recurringTemplateId !== opts.where.recurringTemplateId
            )
              return false;
            if (
              opts.where.scheduledDate &&
              r.scheduledDate !== opts.where.scheduledDate
            )
              return false;
            if (opts.where.status && opts.where.status._type === 'not') {
              if (r.status === opts.where.status._value) return false;
            }
            return true;
          }) ?? null
        );
      }),
    };

    shipmentRepo = {
      _state: state,
      find: jest.fn(async (opts: any) =>
        state.shipments.filter(
          (s: any) => s.deliveryRunId === opts.where?.deliveryRunId,
        ),
      ),
      findOne: jest.fn(async () => null),
    };

    truckRepo = {
      findOne: jest.fn(async (opts: any) => ({
        id: opts.where.id,
        companyId: COMPANY_A,
      })),
    };
    driverRepo = {
      findOne: jest.fn(async (opts: any) => ({
        id: opts.where.id,
        companyId: COMPANY_A,
      })),
    };

    // EntityManager fake usado dentro de transactions
    const em: any = {
      create: (_e: any, data: any) => data,
      save: jest.fn(async (entity: any) => {
        if (!entity.id)
          entity.id = 'gen-' + Math.random().toString(36).slice(2, 10);
        // Detectar tipo: tiene optimizedSequence => DeliveryRun, tiene trackingCode => Shipment, tiene shipmentTemplates => Template
        if ('optimizedSequence' in entity || entity.scheduledDate) {
          const idx = state.runs.findIndex((r: any) => r.id === entity.id);
          if (idx >= 0) state.runs[idx] = entity;
          else state.runs.push(entity);
        } else if ('trackingCode' in entity) {
          const idx = state.shipments.findIndex((s: any) => s.id === entity.id);
          if (idx >= 0) state.shipments[idx] = entity;
          else state.shipments.push(entity);
        } else {
          const idx = state.templates.findIndex((t: any) => t.id === entity.id);
          if (idx >= 0) state.templates[idx] = entity;
          else state.templates.push(entity);
        }
        return entity;
      }),
      findOne: jest.fn(async (entityCls: any, opts: any) => {
        // Discriminar por entity class
        if (entityCls?.name === 'Shipment') {
          return (
            state.shipments.find((s: any) => {
              if (opts.where.companyId && s.companyId !== opts.where.companyId)
                return false;
              if (
                opts.where.trackingCode &&
                s.trackingCode !== opts.where.trackingCode
              )
                return false;
              return true;
            }) ?? null
          );
        }
        // DeliveryRun
        return (
          state.runs.find((r: any) => {
            if (
              opts.where.recurringTemplateId &&
              r.recurringTemplateId !== opts.where.recurringTemplateId
            )
              return false;
            if (
              opts.where.scheduledDate &&
              r.scheduledDate !== opts.where.scheduledDate
            )
              return false;
            if (opts.where.status && opts.where.status._type === 'not') {
              if (r.status === opts.where.status._value) return false;
            }
            return true;
          }) ?? null
        );
      }),
      find: jest.fn(async () => []),
    };

    dataSource = {
      transaction: jest.fn(async (fn: any) => fn(em)),
      query: jest
        .fn()
        .mockResolvedValue([{ limits: { global: { max_templates: 99999 } } }]),
    };

    eventEmitter = new EventEmitter2();
    jest.spyOn(eventEmitter, 'emit');

    service = new RecurringTemplatesService(
      templateRepo,
      runRepo,
      shipmentRepo,
      truckRepo,
      driverRepo,
      dataSource,
      eventEmitter,
    );
  });

  // ──────────────────────────────────────────────
  // Helpers para parser SQL ingenuo en createQueryBuilder
  // ──────────────────────────────────────────────
  // (ver bottom)

  // ═══════════════════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════════════════
  describe('create — RT-001 + validaciones', () => {
    const validDto = () => ({
      name: 'AM Lincoln',
      pattern: RecurrencePattern.WEEKLY,
      daysOfWeek: [1, 2, 3, 4, 5],
      time: '07:00',
      startDate: '2026-01-01',
      shipmentTemplates: [
        {
          originAddress: '742 Evergreen',
          destinationAddress: 'Lincoln Elementary',
          description: 'Bart',
          cargoType: 'passenger',
        },
      ],
    });

    it('crea plantilla válida', async () => {
      const tpl = await service.create(validDto() as any, managerUser() as any);
      expect(tpl.companyId).toBe(COMPANY_A);
      expect(tpl.active).toBe(true);
    });

    it('RT-001: rechaza driver (rol)', async () => {
      await expect(
        service.create(validDto() as any, driverUser() as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rechaza sin company', async () => {
      const u = { ...managerUser(), companyId: null };
      await expect(
        service.create(validDto() as any, u as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rechaza weekly sin daysOfWeek', async () => {
      const dto: any = validDto();
      dto.daysOfWeek = [];
      await expect(
        service.create(dto, managerUser() as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza endDate < startDate', async () => {
      const dto: any = { ...validDto(), endDate: '2025-01-01' };
      await expect(
        service.create(dto, managerUser() as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════
  // GENERATE — RT-002 idempotencia
  // ═══════════════════════════════════════════════════════
  describe('generateForDate — RT-002 idempotente', () => {
    it('genera DeliveryRun + N Shipments y emite evento', async () => {
      const tpl = buildTemplate();
      templateRepo._state.templates.push(tpl);

      const result = await service.generateForDate(tpl.id, '2026-04-23');

      expect(result.skipped).toBe(false);
      expect(result.runId).toBeTruthy();
      expect(result.shipmentIds).toHaveLength(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        INTERNAL_EVENTS.RECURRING_GENERATED,
        expect.objectContaining({ templateId: tpl.id, runId: result.runId }),
      );

      // Run quedó en READY (driver+truck+stop)
      const run = templateRepo._state.runs[0];
      expect(run.status).toBe(DeliveryRunStatus.READY);
      expect(run.totalStops).toBe(1);
      expect(run.optimizedSequence).toEqual([result.shipmentIds[0]]);

      // Shipment vinculado al run
      const ship = templateRepo._state.shipments[0];
      expect(ship.deliveryRunId).toBe(run.id);
      expect(ship.runSequence).toBe(1);
      expect(ship.status).toBe(ShipmentStatus.CONFIRMED);
      expect(ship.trackingCode).toMatch(/^SHP-/);
    });

    it('skip por exception (RT)', async () => {
      const tpl = buildTemplate({ exceptions: ['2026-04-23'] });
      templateRepo._state.templates.push(tpl);
      const r = await service.generateForDate(tpl.id, '2026-04-23');
      expect(r.skipped).toBe(true);
      expect(r.skipReason).toBe('exception');
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        INTERNAL_EVENTS.RECURRING_GENERATED,
        expect.anything(),
      );
    });

    it('skip por pattern_mismatch (weekly + día no incluido)', async () => {
      // 2026-04-25 es sábado (ISO 6) → no en [1..5]
      const tpl = buildTemplate();
      templateRepo._state.templates.push(tpl);
      const r = await service.generateForDate(tpl.id, '2026-04-25');
      expect(r.skipped).toBe(true);
      expect(r.skipReason).toBe('pattern_mismatch');
    });

    it('skip por paused (active=false)', async () => {
      const tpl = buildTemplate({ active: false });
      templateRepo._state.templates.push(tpl);
      const r = await service.generateForDate(tpl.id, '2026-04-23');
      expect(r.skipped).toBe(true);
      expect(r.skipReason).toBe('paused');
    });

    it('skip por out_of_range (antes de startDate)', async () => {
      const tpl = buildTemplate({ startDate: '2027-01-01' });
      templateRepo._state.templates.push(tpl);
      const r = await service.generateForDate(tpl.id, '2026-04-23');
      expect(r.skipped).toBe(true);
      expect(r.skipReason).toBe('out_of_range');
    });

    it('RT-002: idempotente — segunda llamada devuelve el run existente', async () => {
      const tpl = buildTemplate();
      templateRepo._state.templates.push(tpl);

      const first = await service.generateForDate(tpl.id, '2026-04-23');
      expect(first.skipped).toBe(false);

      // Reset spy para verificar que no emite de nuevo
      (eventEmitter.emit as jest.Mock).mockClear();

      const second = await service.generateForDate(tpl.id, '2026-04-23');
      expect(second.skipped).toBe(true);
      expect(second.skipReason).toBe('already_generated');
      expect(second.runId).toBe(first.runId);
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        INTERNAL_EVENTS.RECURRING_GENERATED,
        expect.anything(),
      );
      // Solo un run y un shipment en estado
      expect(templateRepo._state.runs).toHaveLength(1);
      expect(templateRepo._state.shipments).toHaveLength(1);
    });

    it('404 si template no existe', async () => {
      await expect(
        service.generateForDate('missing', '2026-04-23'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('multi-tenant: usuario de company B no puede generar template de A', async () => {
      const tpl = buildTemplate();
      templateRepo._state.templates.push(tpl);
      await expect(
        service.generateForDate(
          tpl.id,
          '2026-04-23',
          managerUser(COMPANY_B) as any,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ═══════════════════════════════════════════════════════
  // PAUSE / RESUME — RT-004
  // ═══════════════════════════════════════════════════════
  describe('pause/resume — RT-004', () => {
    it('pause setea active=false', async () => {
      const tpl = buildTemplate();
      templateRepo._state.templates.push(tpl);
      const out = await service.pause(tpl.id, managerUser() as any);
      expect(out.active).toBe(false);
    });

    it('resume setea active=true', async () => {
      const tpl = buildTemplate({ active: false });
      templateRepo._state.templates.push(tpl);
      const out = await service.resume(tpl.id, managerUser() as any);
      expect(out.active).toBe(true);
    });

    it('pause rechaza si rol no permitido', async () => {
      const tpl = buildTemplate();
      templateRepo._state.templates.push(tpl);
      await expect(
        service.pause(tpl.id, driverUser() as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ═══════════════════════════════════════════════════════
  // SOFT DELETE — RT-005
  // ═══════════════════════════════════════════════════════
  describe('remove — RT-005', () => {
    it('soft-delete preserva el registro', async () => {
      const tpl = buildTemplate();
      templateRepo._state.templates.push(tpl);
      await service.remove(tpl.id, managerUser() as any);
      expect(templateRepo.softRemove).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════
  // listDueForDate (cron)
  // ═══════════════════════════════════════════════════════
  describe('listDueForDate', () => {
    it('filtra por active + pattern + ventana + appliesTo', async () => {
      const t1 = buildTemplate({ id: 't1' }); // weekly L-V → 2026-04-23 (jueves) sí
      const t2 = buildTemplate({ id: 't2', active: false }); // pausada → no
      const t3 = buildTemplate({ id: 't3', pattern: RecurrencePattern.CUSTOM }); // custom → no
      const t4 = buildTemplate({ id: 't4', startDate: '2027-01-01' }); // futuro → no
      const t5 = buildTemplate({ id: 't5', endDate: '2026-01-01' }); // pasado → no
      const t6 = buildTemplate({ id: 't6', exceptions: ['2026-04-23'] }); // excepción → no
      const all = [t1, t2, t3, t4, t5, t6];

      // Override: simular que el SQL ya filtró active+pattern+ventana
      // (esto es lo que hace TypeORM en realidad). El service luego
      // aplica .appliesTo() en memoria que es el contrato bajo test.
      templateRepo.createQueryBuilder = () => ({
        where: () => templateRepo.createQueryBuilder(),
        andWhere: () => templateRepo.createQueryBuilder(),
        getMany: async () =>
          all.filter(
            (t) =>
              t.active &&
              !t.deletedAt &&
              t.pattern !== RecurrencePattern.CUSTOM &&
              t.startDate <= '2026-04-23' &&
              (!t.endDate || t.endDate >= '2026-04-23'),
          ),
      });

      const due = await service.listDueForDate('2026-04-23');
      expect(due.map((t) => t.id)).toEqual(['t1']);
    });
  });
});

// ─── Helpers SQL parser ingenuo para createQueryBuilder ───
function applyCond(
  sql: string,
  params: any,
  conds: Array<(t: any) => boolean>,
): void {
  const m = sql.match(/tpl\.(\w+)\s*(=|<>|<=|>=)\s*:(\w+)/);
  if (m) {
    const [, field, op, key] = m;
    conds.push((t: any) => {
      const v = params[key];
      switch (op) {
        case '=':
          return t[field] === v;
        case '<>':
          return t[field] !== v;
        case '<=':
          return t[field] <= v;
        case '>=':
          return t[field] >= v;
        default:
          return true;
      }
    });
    return;
  }
  if (sql.includes('tpl.deletedAt IS NULL')) {
    conds.push((t: any) => t.deletedAt == null);
    return;
  }
  if (sql.includes('tpl.endDate IS NULL OR tpl.endDate >=')) {
    conds.push((t: any) => t.endDate == null || t.endDate >= params.date);
    return;
  }
  // tpl.active = true literal
  if (sql.includes('tpl.active = true')) {
    conds.push((t: any) => t.active === true);
  }
}
