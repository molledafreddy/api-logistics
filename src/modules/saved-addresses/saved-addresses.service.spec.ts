import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SavedAddressesService } from './saved-addresses.service';
import { UserRole } from '../../common/enums/user-role.enum';
import type { CreateSavedAddressDto } from './dto';

/**
 * Sprint C.6 — Unit tests del SavedAddressesService.
 *
 * Cubre:
 *   SAV-001 tenancy (no-admin no ve favoritos de otra compañía)
 *   SAV-002 unicidad de label por compañía (create + update)
 *   SAV-003 soft-delete (softRemove)
 *   SUPER_ADMIN bypass de tenancy
 *   companyId requerido (Forbidden si user.companyId vacío)
 */
describe('SavedAddressesService', () => {
  const COMPANY = 'co-1';

  function makeRepo() {
    return {
      findOne: jest.fn(),
      create: jest.fn((x: any) => ({ id: 'addr-1', ...x })),
      save: jest.fn(async (x: any) => x),
      merge: jest.fn((entity: any, patch: any) => Object.assign(entity, patch)),
      softRemove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    } as any;
  }

  function manager(companyId = COMPANY): any {
    return { sub: 'u1', role: UserRole.MANAGER, companyId };
  }
  function superAdmin(): any {
    return { sub: 'u-admin', role: UserRole.SUPER_ADMIN, companyId: null };
  }

  function dto(
    overrides: Partial<CreateSavedAddressDto> = {},
  ): CreateSavedAddressDto {
    return {
      label: 'Depot Quilicura',
      kind: 'depot',
      formatted: 'Av. X 100',
      lat: -33.4 as any,
      lng: -70.6 as any,
      ...overrides,
    } as CreateSavedAddressDto;
  }

  it('create OK: persiste con companyId del usuario y stringifica lat/lng', async () => {
    const repo = makeRepo();
    repo.findOne.mockResolvedValue(null);
    const svc = new SavedAddressesService(repo);
    const out = await svc.create(dto(), manager());
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY,
        createdBy: 'u1',
        lat: '-33.4',
        lng: '-70.6',
        kind: 'depot',
      }),
    );
    expect(out).toMatchObject({ id: 'addr-1' });
  });

  it('create: SAV-002 lanza ConflictException si label duplicado en la compañía', async () => {
    const repo = makeRepo();
    repo.findOne.mockResolvedValue({ id: 'dup', label: 'Depot' });
    const svc = new SavedAddressesService(repo);
    await expect(
      svc.create(dto({ label: 'Depot' }), manager()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('create: Forbidden si el usuario no tiene companyId', async () => {
    const repo = makeRepo();
    const svc = new SavedAddressesService(repo);
    await expect(
      svc.create(dto(), {
        sub: 'x',
        role: UserRole.MANAGER,
        companyId: null,
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('findOne: NotFound si no existe', async () => {
    const repo = makeRepo();
    repo.findOne.mockResolvedValue(null);
    const svc = new SavedAddressesService(repo);
    await expect(svc.findOne('zzz', manager())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findOne: SAV-001 Forbidden si la dirección es de otra compañía', async () => {
    const repo = makeRepo();
    repo.findOne.mockResolvedValue({ id: 'a1', companyId: 'other-co' });
    const svc = new SavedAddressesService(repo);
    await expect(svc.findOne('a1', manager())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('findOne: SUPER_ADMIN puede acceder a cualquier compañía', async () => {
    const repo = makeRepo();
    repo.findOne.mockResolvedValue({ id: 'a1', companyId: 'other-co' });
    const svc = new SavedAddressesService(repo);
    const out = await svc.findOne('a1', superAdmin());
    expect(out.id).toBe('a1');
  });

  it('update: SAV-002 cuando se cambia label a uno duplicado', async () => {
    const repo = makeRepo();
    // findOne se llama 2 veces:
    //   1) cargar el addr actual
    //   2) buscar duplicado por nuevo label
    repo.findOne
      .mockResolvedValueOnce({ id: 'a1', companyId: COMPANY, label: 'Old' })
      .mockResolvedValueOnce({ id: 'dup', companyId: COMPANY, label: 'Nuevo' });
    const svc = new SavedAddressesService(repo);
    await expect(
      svc.update('a1', { label: 'Nuevo' } as any, manager()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('update: cambia campos sin tocar label → no chequea duplicado', async () => {
    const repo = makeRepo();
    repo.findOne.mockResolvedValueOnce({
      id: 'a1',
      companyId: COMPANY,
      label: 'Old',
    });
    const svc = new SavedAddressesService(repo);
    const out = await svc.update(
      'a1',
      { formatted: 'Nueva dirección' } as any,
      manager(),
    );
    expect(repo.findOne).toHaveBeenCalledTimes(1);
    expect(out).toMatchObject({ formatted: 'Nueva dirección' });
  });

  it('remove: SAV-003 hace softRemove', async () => {
    const repo = makeRepo();
    repo.findOne.mockResolvedValue({ id: 'a1', companyId: COMPANY });
    const svc = new SavedAddressesService(repo);
    await svc.remove('a1', manager());
    expect(repo.softRemove).toHaveBeenCalledWith({
      id: 'a1',
      companyId: COMPANY,
    });
  });

  it('findAll (manager): aplica where companyId del usuario y filtros opcionales', async () => {
    const repo = makeRepo();
    const qb = makeQbStub([{ id: 'a1' }], 1);
    repo.createQueryBuilder.mockReturnValue(qb);
    const svc = new SavedAddressesService(repo);
    const out = await svc.findAll(
      { kind: 'depot', q: 'depot', page: 1, limit: 10, skip: 0 } as any,
      manager(),
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'addr.companyId = :cid',
      expect.objectContaining({ cid: COMPANY }),
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'addr.kind = :kind',
      expect.objectContaining({ kind: 'depot' }),
    );
    expect(out.meta.total).toBe(1);
    expect(out.data).toHaveLength(1);
  });

  it('findAll (SUPER_ADMIN sin companyId query): no aplica filtro de tenant', async () => {
    const repo = makeRepo();
    const qb = makeQbStub([], 0);
    repo.createQueryBuilder.mockReturnValue(qb);
    const svc = new SavedAddressesService(repo);
    await svc.findAll({ page: 1, limit: 10, skip: 0 } as any, superAdmin());
    // Solo se llama con WHERE deletedAt IS NULL (sin filtro companyId)
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      'addr.companyId = :cid',
      expect.anything(),
    );
  });
});

function makeQbStub(rows: any[], total: number) {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
  };
  return qb;
}
