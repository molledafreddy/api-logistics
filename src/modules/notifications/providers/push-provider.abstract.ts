export interface PushPayload {
  title: string;
  body?: string;
  data?: Record<string, string>;
}

export abstract class PushProvider {
  abstract sendPush(token: string, payload: PushPayload): Promise<void>;
}
