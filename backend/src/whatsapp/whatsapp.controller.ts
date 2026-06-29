import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('session')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('session')
export class WhatsappController {
  constructor(private wa: WhatsappService) {}

  @Get() get() { return this.wa.getStatus(); }
  @Get('status') status() { return this.wa.getStatus(); }
  @Get('qrcode') qr() { return this.wa.getQrCode(); }

  @Post('connect') async connect() { await this.wa.connect(); return { ok: true }; }
  @Post('reconnect') async reconnect() { await this.wa.reconnect(); return { ok: true }; }
  @Post('disconnect') async disconnect() { await this.wa.disconnect(); return { ok: true }; }
}
