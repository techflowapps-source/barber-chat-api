import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ContactsController {
  constructor(private svc: ContactsService) {}

  @Get('contacts') list() { return this.svc.list(); }
  @Get('contacts/check') check(@Query('phone') p: string) { return this.svc.check(p); }
  @Get('contacts/picture') pic(@Query('phone') p: string) { return this.svc.picture(p); }
  @Get('contacts/name') name(@Query('phone') p: string) { return this.svc.name(p); }
  @Get('contacts/:id') one(@Param('id') id: string) { return this.svc.findOne(id); }
  @Get('groups') groups() { return this.svc.groups(); }
}
