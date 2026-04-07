// Chat WebSocket events
export const CHAT_EVENTS = {
  // Client → Server
  JOIN_CONVERSATION: 'chat:join',
  LEAVE_CONVERSATION: 'chat:leave',
  SEND_MESSAGE: 'chat:send',
  TYPING_START: 'chat:typingStart',
  TYPING_STOP: 'chat:typingStop',
  MARK_READ: 'chat:markRead',

  // Server → Client
  NEW_MESSAGE: 'chat:newMessage',
  MESSAGE_READ: 'chat:messageRead',
  USER_TYPING: 'chat:userTyping',
  USER_ONLINE: 'chat:userOnline',
  USER_OFFLINE: 'chat:userOffline',
} as const;
