import { Module } from '@nestjs/common';
import { AiService } from './ai.service';

@Module({
  providers: [AiService],
  exports: [AiService], // ← We need to export this so other modules can use it
})
export class AiModule {}
