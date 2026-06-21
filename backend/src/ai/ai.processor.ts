import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AiService } from './ai.service';
import { Injectable } from '@nestjs/common';

@Injectable()
@Processor('document-processing')
export class AiProcessor extends WorkerHost {
  constructor(private readonly aiService: AiService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    console.log(`[Queue Worker] Picked up job ${job.id} for document ${job.data.documentId}`);
    
    try {
      await this.aiService.processAndStoreDocument(
        job.data.documentId,
        job.data.text
      );
      console.log(`[Queue Worker] Finished job ${job.id} successfully!`);
    } catch (error) {
      console.error(`[Queue Worker] Failed job ${job.id}:`, error);
      throw error; // Let BullMQ handle retries
    }
  }
}
