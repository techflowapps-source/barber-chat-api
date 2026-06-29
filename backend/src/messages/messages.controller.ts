import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SendMediaDto } from './dto/send-media.dto';
import { SendLocationDto } from './dto/send-location.dto';
import { SendContactDto } from './dto/send-contact.dto';
import { SendListDto } from './dto/send-list.dto';
import { SendButtonsDto } from './dto/send-buttons.dto';
import { SendReactionDto } from './dto/send-reaction.dto';
import { MarkReadDto } from './dto/mark-read.dto';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private svc: MessagesService) {}

  @Get() list(@Query('remoteJid') jid?: string) { return this.svc.list(jid); }
  @Get('conversations') conversations(@Query('take') take?: string) {
    return this.svc.conversations(take ? Number(take) : 50);
  }

  @Post('send') send(@Body() dto: SendMessageDto) { return this.svc.sendText(dto); }
  @Post('image') image(@Body() dto: SendMediaDto) { return this.svc.sendMedia('image', dto); }
  @Post('audio') audio(@Body() dto: SendMediaDto) { return this.svc.sendMedia('audio', dto); }
  @Post('document') doc(@Body() dto: SendMediaDto) { return this.svc.sendMedia('document', dto); }
  @Post('location') location(@Body() dto: SendLocationDto) { return this.svc.sendLocation(dto); }
  @Post('contact') contact(@Body() dto: SendContactDto) { return this.svc.sendContact(dto); }
  @Post('list') listMsg(@Body() dto: SendListDto) { return this.svc.sendList(dto); }
  @Post('buttons') buttons(@Body() dto: SendButtonsDto) { return this.svc.sendButtons(dto); }
  @Post('reaction') reaction(@Body() dto: SendReactionDto) { return this.svc.sendReaction(dto); }
  @Post('read') read(@Body() dto: MarkReadDto) { return this.svc.markRead(dto); }
}
