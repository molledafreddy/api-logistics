import { paginate } from './pagination.util';

describe('paginate', () => {
  const mkQb = (data: unknown[], total: number) => {
    const qb: any = {
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([data, total]),
    };
    return qb;
  };

  it('paginates page 1 with hasNextPage', async () => {
    const qb = mkQb([{ id: 1 }, { id: 2 }], 25);
    const res = await paginate(qb, { page: 1, limit: 10 } as never);
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(res.meta).toEqual({
      total: 25,
      page: 1,
      limit: 10,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(res.data).toHaveLength(2);
  });
  it('paginates last page with hasPreviousPage', async () => {
    const qb = mkQb([], 25);
    const res = await paginate(qb, { page: 3, limit: 10 } as never);
    expect(qb.skip).toHaveBeenCalledWith(20);
    expect(res.meta.hasNextPage).toBe(false);
    expect(res.meta.hasPreviousPage).toBe(true);
  });
  it('handles empty results', async () => {
    const qb = mkQb([], 0);
    const res = await paginate(qb, { page: 1, limit: 10 } as never);
    expect(res.meta.totalPages).toBe(0);
    expect(res.meta.hasNextPage).toBe(false);
  });
});
