import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { AiModule } from '../ai/ai.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    AiModule,
    BullModule.registerQueue({
      name: 'document-processing',
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService]
})
export class DocumentsModule {}
