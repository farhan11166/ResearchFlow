import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { BullModule } from '@nestjs/bullmq';
import { AiProcessor } from './ai.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'document-processing',
    }),
  ],
  providers: [AiService, AiProcessor],
  exports: [AiService, BullModule],
})
export class AiModule {}
