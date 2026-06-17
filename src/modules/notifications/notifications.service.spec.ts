import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { PushSenderService } from './push-sender.service';
import { Notification } from './entities/notification.entity';
import { PushToken } from './entities/push-token.entity';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { DevicePlatform } from './entities/push-token.entity';

const repoMock = () => ({
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 'n1', ...x })),
  find: jest.fn(async () => []),
  findOneBy: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  })),
});

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notifRepo: ReturnType<typeof repoMock>;
  let pushRepo: ReturnType<typeof repoMock>;
  let emitter: { emit: jest.Mock };

  beforeEach(async () => {
    notifRepo = repoMock();
    pushRepo = repoMock();
    emitter = { emit: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
        { provide: getRepositoryToken(PushToken), useValue: pushRepo },
        { provide: EventEmitter2, useValue: emitter },
        {
          provide: PushSenderService,
          useValue: {
            sendPushToUser: jest
              .fn()
              .mockResolvedValue({ pushed: true, error: null }),
          },
        },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('persists and emits internal event', async () => {
      const res = await service.create({
        userId: 'u1',
        type: NotificationType.SYSTEM,
        title: 'Hi',
      });
      expect(notifRepo.create).toHaveBeenCalled();
      expect(notifRepo.save).toHaveBeenCalled();
      expect(emitter.emit).toHaveBeenCalledTimes(1);
      expect(res).toMatchObject({ id: 'n1', userId: 'u1', title: 'Hi' });
    });
  });

  describe('findByUser', () => {
    it('paginates with skip/take', async () => {
      await service.findByUser('u1', 2, 10);
      expect(notifRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe('markAsRead', () => {
    it('updates readAt', async () => {
      const res = await service.markAsRead('n1', 'u1');
      expect(notifRepo.update).toHaveBeenCalledWith(
        'n1',
        expect.objectContaining({ readAt: expect.any(Date) }),
      );
      expect(res).toEqual({ success: true });
    });
  });

  describe('markAllRead', () => {
    it('runs query builder update', async () => {
      const res = await service.markAllRead('u1');
      expect(notifRepo.createQueryBuilder).toHaveBeenCalled();
      expect(res).toEqual({ success: true });
    });
  });

  describe('registerPushToken', () => {
    it('returns existing token if already registered', async () => {
      pushRepo.findOneBy.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u1',
        token: 't',
      });
      const res = await service.registerPushToken(
        'u1',
        't',
        DevicePlatform.IOS,
      );
      expect(res).toMatchObject({ id: 'p1' });
      expect(pushRepo.save).not.toHaveBeenCalled();
    });

    it('creates new token if missing', async () => {
      pushRepo.findOneBy.mockResolvedValueOnce(undefined);
      const res = await service.registerPushToken(
        'u1',
        't',
        DevicePlatform.IOS,
        'iPhone',
      );
      expect(pushRepo.create).toHaveBeenCalled();
      expect(pushRepo.save).toHaveBeenCalled();
      expect(res).toMatchObject({
        token: 't',
        platform: DevicePlatform.IOS,
        deviceName: 'iPhone',
      });
    });
  });

  describe('removePushToken', () => {
    it('marks token as inactive', async () => {
      const res = await service.removePushToken('u1', 't');
      expect(pushRepo.update).toHaveBeenCalledWith(
        { userId: 'u1', token: 't' },
        { isActive: false },
      );
      expect(res).toEqual({ success: true });
    });
  });
});
