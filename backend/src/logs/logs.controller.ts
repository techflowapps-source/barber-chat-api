import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { LogsService } from './logs.service';

@ApiTags('logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('logs')
export class LogsController {
  constructor(private logs: LogsService) {}

  @Get()
  list(
    @Query('action') action?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.logs.list(action, take ? Number(take) : 100, skip ? Number(skip) : 0);
  }
}
