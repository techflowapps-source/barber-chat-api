import { Module, forwardRef } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { ChatbotService } from './chatbot.service';
import { WebsocketModule } from '../websocket/websocket.module';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [WebsocketModule, forwardRef(() => WebhookModule)],
  providers: [WhatsappService, ChatbotService],
  controllers: [WhatsappController],
  exports: [WhatsappService],
})
export class WhatsappModule {}
