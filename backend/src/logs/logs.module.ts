import { Global, Module } from '@nestjs/common';
import { LogsController } from './logs.controller';
import { LogsRepository } from './logs.repository';
import { LogsService } from './logs.service';

@Global()
@Module({
  providers: [LogsRepository, LogsService],
  controllers: [LogsController],
  exports: [LogsService],
})
export class LogsModule {}
