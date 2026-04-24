import { Logger, UnauthorizedException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsAuthService } from '../ws-auth.service';
import { TRACKING_EVENTS } from '../events/tracking.events';
import { INTERNAL_EVENTS } from '../events/internal.events';
import { TrackingService } from '../../modules/tracking/tracking.service';
import { TrackingPoint } from '../../modules/tracking/entities/tracking-point.entity';
import { IUserPayload } from '../../common/interfaces/user-payload.interface';

@WebSocketGateway({
  namespace: '/tracking',
  cors: { origin: '*', credentials: true },
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(TrackingGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly wsAuth: WsAuthService,
    private readonly trackingService: TrackingService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const user = await this.wsAuth.authenticate(client);
      client.data.user = user;
      this.logger.log(`[TRACK] Connected user=${user.sub} socket=${client.id}`);
      client.emit('connected', { userId: user.sub });
    } catch (err) {
      this.logger.warn(`[TRACK] Auth failed: ${(err as Error).message}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[TRACK] Disconnected socket=${client.id}`);
  }

  // ─── Cliente: suscribirse a un shipment ────────────────────
  @SubscribeMessage(TRACKING_EVENTS.SUBSCRIBE_SHIPMENT)
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { shipmentId?: string; truckId?: string },
  ) {
    this.requireUser(client);
    if (payload.shipmentId) {
      await client.join(this.shipmentRoom(payload.shipmentId));
    }
    if (payload.truckId) {
      await client.join(this.truckRoom(payload.truckId));
    }
    return { ok: true, subscribed: payload };
  }

  @SubscribeMessage(TRACKING_EVENTS.UNSUBSCRIBE_SHIPMENT)
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { shipmentId?: string; truckId?: string },
  ) {
    if (payload.shipmentId)
      await client.leave(this.shipmentRoom(payload.shipmentId));
    if (payload.truckId) await client.leave(this.truckRoom(payload.truckId));
    return { ok: true };
  }

  // ─── Cliente (driver app): enviar ubicación en tiempo real ─
  @SubscribeMessage(TRACKING_EVENTS.SEND_LOCATION)
  async handleSendLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      shipmentId?: string;
      truckId?: string;
      driverId?: string;
      lat: number;
      lng: number;
      speed?: number;
      heading?: number;
      capturedAt?: string;
    },
  ) {
    const user = this.requireUser(client);
    const point = await this.trackingService.create(payload as never, user);
    // No llamamos a broadcastLocation aquí porque el service ya emite
    // `internal.tracking.point.created` y `handlePointCreated` lo difunde.
    return { ok: true, id: point.id };
  }

  // ─── Bridge: servicio → WS (puntos creados vía REST) ───────
  @OnEvent(INTERNAL_EVENTS.TRACKING_POINT_CREATED)
  handlePointCreated(point: TrackingPoint) {
    this.broadcastLocation(point);
  }

  @OnEvent(INTERNAL_EVENTS.TRACKING_BULK_CREATED)
  handleBulkCreated(points: TrackingPoint[]) {
    for (const p of points) this.broadcastLocation(p);
  }

  // ─── PARTE 7 · Sprint 1 — DeliveryRun events ───────────────
  @OnEvent(INTERNAL_EVENTS.DELIVERY_RUN_STARTED)
  handleRunStarted(payload: {
    runId: string;
    companyId: string;
    driverId: string | null;
    truckId: string | null;
    totalStops: number;
    startedAt: Date;
  }) {
    this.server
      .to(this.runRoom(payload.runId))
      .emit('delivery-run:started', payload);
  }

  @OnEvent(INTERNAL_EVENTS.DELIVERY_RUN_STOP_DONE)
  handleStopDone(payload: {
    runId: string;
    shipmentId: string;
    companyId: string;
    status: string;
    completedStops: number;
    totalStops: number;
  }) {
    const evt = { ...payload, kind: 'done' as const };
    this.server
      .to(this.runRoom(payload.runId))
      .emit('delivery-run:stopUpdate', evt);
    this.server
      .to(this.shipmentRoom(payload.shipmentId))
      .emit('delivery-run:stopUpdate', evt);
  }

  @OnEvent(INTERNAL_EVENTS.DELIVERY_RUN_STOP_INCIDENT)
  handleStopIncident(payload: {
    runId: string;
    shipmentId: string;
    companyId: string;
    reason: string;
    photoUrl: string | null;
    completedStops: number;
    totalStops: number;
  }) {
    const evt = { ...payload, kind: 'incident' as const };
    this.server
      .to(this.runRoom(payload.runId))
      .emit('delivery-run:stopUpdate', evt);
    this.server
      .to(this.shipmentRoom(payload.shipmentId))
      .emit('delivery-run:stopUpdate', evt);
  }

  @OnEvent(INTERNAL_EVENTS.DELIVERY_RUN_COMPLETED)
  handleRunCompleted(payload: {
    runId: string;
    companyId: string;
    finishedAt: Date;
    totalStops: number;
    deliveredCount: number;
    incidentCount: number;
  }) {
    this.server
      .to(this.runRoom(payload.runId))
      .emit('delivery-run:completed', payload);
  }

  @OnEvent(INTERNAL_EVENTS.DELIVERY_RUN_CANCELLED)
  handleRunCancelled(payload: {
    runId: string;
    companyId: string;
    reason: string;
    cancelledAt: Date;
  }) {
    this.server
      .to(this.runRoom(payload.runId))
      .emit('delivery-run:cancelled', payload);
  }

  // ─── Cliente: suscribirse a un DeliveryRun ─────────────────
  @SubscribeMessage('subscribe:run')
  async handleSubscribeRun(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { runId: string },
  ) {
    this.requireUser(client);
    if (payload?.runId) await client.join(this.runRoom(payload.runId));
    return { ok: true, subscribed: { runId: payload?.runId } };
  }

  @SubscribeMessage('unsubscribe:run')
  async handleUnsubscribeRun(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { runId: string },
  ) {
    if (payload?.runId) await client.leave(this.runRoom(payload.runId));
    return { ok: true };
  }

  private broadcastLocation(point: TrackingPoint) {
    const payload = {
      id: point.id,
      shipmentId: point.shipmentId,
      truckId: point.truckId,
      driverId: point.driverId,
      lat: Number(point.lat),
      lng: Number(point.lng),
      speed: point.speed != null ? Number(point.speed) : null,
      heading: point.heading != null ? Number(point.heading) : null,
      capturedAt: point.capturedAt,
    };

    if (point.shipmentId) {
      this.server
        .to(this.shipmentRoom(point.shipmentId))
        .emit(TRACKING_EVENTS.LOCATION_UPDATE, payload);
    }
    if (point.truckId) {
      this.server
        .to(this.truckRoom(point.truckId))
        .emit(TRACKING_EVENTS.LOCATION_UPDATE, payload);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────
  private requireUser(client: Socket): IUserPayload {
    const user = client.data.user as IUserPayload | undefined;
    if (!user) throw new UnauthorizedException('Not authenticated');
    return user;
  }

  private shipmentRoom(id: string): string {
    return `shipment:${id}`;
  }

  private truckRoom(id: string): string {
    return `truck:${id}`;
  }

  private runRoom(id: string): string {
    return `run:${id}`;
  }
}
