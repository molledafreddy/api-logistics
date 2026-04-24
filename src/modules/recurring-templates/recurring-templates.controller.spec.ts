import { RecurringTemplatesController } from './recurring-templates.controller';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const user = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' }) as never;

const svc = () => ({
  create: jest.fn().mockResolvedValue('OK'),
  findAll: jest.fn().mockResolvedValue('OK'),
  findOne: jest.fn().mockResolvedValue('OK'),
  update: jest.fn().mockResolvedValue('OK'),
  generateForDate: jest.fn().mockResolvedValue('OK'),
  pause: jest.fn().mockResolvedValue('OK'),
  resume: jest.fn().mockResolvedValue('OK'),
  remove: jest.fn().mockResolvedValue(undefined),
});

describe('RecurringTemplatesController', () => {
  let s: ReturnType<typeof svc>;
  let c: RecurringTemplatesController;
  beforeEach(() => {
    s = svc();
    c = new RecurringTemplatesController(s as never);
  });

  it('create', async () => {
    await c.create({} as never, user());
    expect(s.create).toHaveBeenCalled();
  });
  it('findAll', async () => {
    await c.findAll({} as never, user());
    expect(s.findAll).toHaveBeenCalled();
  });
  it('findOne', async () => {
    await c.findOne('id', user());
    expect(s.findOne).toHaveBeenCalledWith('id', user());
  });
  it('update', async () => {
    await c.update('id', {} as never, user());
    expect(s.update).toHaveBeenCalled();
  });
  it('generate extracts dto.date', async () => {
    await c.generate('id', { date: '2026-01-01' } as never, user());
    expect(s.generateForDate).toHaveBeenCalledWith('id', '2026-01-01', user());
  });
  it('pause', async () => {
    await c.pause('id', user());
    expect(s.pause).toHaveBeenCalledWith('id', user());
  });
  it('resume', async () => {
    await c.resume('id', user());
    expect(s.resume).toHaveBeenCalledWith('id', user());
  });
  it('remove', async () => {
    await c.remove('id', user());
    expect(s.remove).toHaveBeenCalledWith('id', user());
  });
});
