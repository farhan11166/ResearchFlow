import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { AiModule } from '../ai/ai.module'; // Import AiModule

@Module({
  imports: [AiModule], // Add it to imports
  providers: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
