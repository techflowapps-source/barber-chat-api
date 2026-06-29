import { Module } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { PromotionsController } from './promotions.controller';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [WhatsappModule, WebhookModule],
  providers: [PromotionsService],
  controllers: [PromotionsController],
  exports: [PromotionsService],
})
export class PromotionsModule {}
