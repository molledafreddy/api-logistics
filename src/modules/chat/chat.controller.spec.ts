import { ChatController } from './chat.controller';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUserPayload } from '../../common/interfaces/user-payload.interface';

const user = (): IUserPayload =>
  ({ sub: 'u1', role: UserRole.ADMIN, companyId: 'c1' }) as never;

const svc = () => ({
  createConversation: jest.fn().mockResolvedValue('OK'),
  listConversations: jest.fn().mockResolvedValue('OK'),
  getConversation: jest.fn().mockResolvedValue('OK'),
  addParticipants: jest.fn().mockResolvedValue('OK'),
  removeParticipant: jest.fn().mockResolvedValue('OK'),
  leaveConversation: jest.fn().mockResolvedValue('OK'),
  sendMessage: jest.fn().mockResolvedValue('OK'),
  listMessages: jest.fn().mockResolvedValue('OK'),
  markAsRead: jest.fn().mockResolvedValue('OK'),
  deleteMessage: jest.fn().mockResolvedValue('OK'),
  getUnreadCount: jest.fn().mockResolvedValue({ count: 0 }),
});

describe('ChatController', () => {
  let s: ReturnType<typeof svc>;
  let c: ChatController;
  beforeEach(() => {
    s = svc();
    c = new ChatController(s as never);
  });

  it('createConversation', async () => {
    await c.createConversation({} as never, user());
    expect(s.createConversation).toHaveBeenCalled();
  });
  it('listConversations', async () => {
    await c.listConversations({} as never, user());
    expect(s.listConversations).toHaveBeenCalled();
  });
  it('getConversation', async () => {
    await c.getConversation('id', user());
    expect(s.getConversation).toHaveBeenCalledWith('id', user());
  });
  it('addParticipants', async () => {
    await c.addParticipants('id', {} as never, user());
    expect(s.addParticipants).toHaveBeenCalled();
  });
  it('removeParticipant', async () => {
    await c.removeParticipant('id', 'u2', user());
    expect(s.removeParticipant).toHaveBeenCalledWith('id', 'u2', user());
  });
  it('leave', async () => {
    await c.leave('id', user());
    expect(s.leaveConversation).toHaveBeenCalledWith('id', user());
  });
  it('sendMessage', async () => {
    await c.sendMessage('id', {} as never, user());
    expect(s.sendMessage).toHaveBeenCalled();
  });
  it('listMessages', async () => {
    await c.listMessages('id', {} as never, user());
    expect(s.listMessages).toHaveBeenCalled();
  });
  it('markAsRead', async () => {
    await c.markAsRead('id', user());
    expect(s.markAsRead).toHaveBeenCalledWith('id', user());
  });
  it('deleteMessage', async () => {
    await c.deleteMessage('mid', user());
    expect(s.deleteMessage).toHaveBeenCalledWith('mid', user());
  });
  it('unreadCount', async () => {
    await c.unreadCount(user());
    expect(s.getUnreadCount).toHaveBeenCalledWith(user());
  });
});
