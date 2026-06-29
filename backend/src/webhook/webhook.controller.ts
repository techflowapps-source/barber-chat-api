import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';
import { Role } from '@prisma/client';
import { WebhookService } from './webhook.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

class WebhookDto {
  @IsString() event!: string;
  @IsUrl({ require_tld: false }) url!: string;
  @IsOptional() @IsString() secret?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

@ApiTags('webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('webhooks')
export class WebhookController {
  constructor(private svc: WebhookService) {}
  @Get() list() { return this.svc.list(); }
  @Post() create(@Body() dto: WebhookDto) { return this.svc.create(dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(id); }
}
