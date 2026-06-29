import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

export type AppEvent =
  | 'qr.updated'
  | 'session.connected'
  | 'session.disconnected'
  | 'session.failed'
  | 'message.received'
  | 'message.sent'
  | 'message.read'
  | 'message.deleted'
  | 'typing.start'
  | 'typing.stop'
  | 'presence.update'
  | 'appointment.created'
  | 'appointment.updated'
  | 'appointment.cancelled';

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private logger = new Logger(EventsGateway.name);

  handleConnection(c: Socket) { this.logger.log(`WS conn ${c.id}`); }
  handleDisconnect(c: Socket) { this.logger.log(`WS disc ${c.id}`); }

  emit(event: AppEvent, payload: unknown) {
    this.server?.emit(event, payload);
  }
}
