import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [WhatsappModule, WebhookModule],
  providers: [AppointmentsService],
  controllers: [AppointmentsController],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
