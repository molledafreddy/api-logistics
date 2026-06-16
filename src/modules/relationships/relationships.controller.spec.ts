import { RelationshipsController } from './relationships.controller';

const svc = () => ({
  create: jest.fn().mockResolvedValue('OK'),
  findByCompany: jest.fn().mockResolvedValue('OK'),
  findById: jest.fn().mockResolvedValue('OK'),
  respond: jest.fn().mockResolvedValue('OK'),
  terminate: jest.fn().mockResolvedValue('OK'),
  getLogs: jest.fn().mockResolvedValue('OK'),
});

const user = {
  sub: 'u1',
} as unknown as import('../../common/interfaces/user-payload.interface').IUserPayload;

describe('RelationshipsController', () => {
  let s: ReturnType<typeof svc>;
  let c: RelationshipsController;
  beforeEach(() => {
    s = svc();
    c = new RelationshipsController(s as never);
  });

  it('create passes user.sub', async () => {
    await c.create({} as never, user);
    expect(s.create).toHaveBeenCalledWith({}, 'u1');
  });
  it('findByCompany', async () => {
    await c.findByCompany('cid');
    expect(s.findByCompany).toHaveBeenCalledWith('cid');
  });
  it('findById', async () => {
    await c.findById('id');
    expect(s.findById).toHaveBeenCalledWith('id');
  });
  it('respond passes user.sub', async () => {
    await c.respond('id', { decision: 'accept' } as never, user);
    expect(s.respond).toHaveBeenCalledWith('id', { decision: 'accept' }, 'u1');
  });
  it('terminate passes user.sub', async () => {
    await c.terminate('id', { reason: 'r' } as never, user);
    expect(s.terminate).toHaveBeenCalledWith('id', { reason: 'r' }, 'u1');
  });
  it('getLogs', async () => {
    await c.getLogs('id');
    expect(s.getLogs).toHaveBeenCalledWith('id');
  });
});
