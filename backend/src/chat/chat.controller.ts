import { Controller, Post, Body, Param } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
    constructor(
        private readonly aiService: AiService,
        private readonly chatService: ChatService
    ) {}

    @Post('new')
    async createChat(@Body('workspaceId') workspaceId: string) {
        if (!workspaceId) return { error: 'workspaceId is required' };
        return this.chatService.creachat(workspaceId);
    }

    @Post(':chatId/message')
    async searchDocuments(@Param('chatId') chatId: string, @Body('query') query: string) {
        if(!query) {
            return {error: 'Search query is required'};
        }

        // 1. Save User Message
        await this.chatService.savemsg(chatId, 'USER', query);

        // 2. Fetch history
        const history = await this.chatService.getHist(chatId);

        // 3. AI search and generation
        const matches = await this.aiService.searchSimilarChunks(query);
        const contextTexts = matches.map(m => String(m.text));
        
        // Pass the history into generateAnswer!
        const answer = await this.aiService.generateAnswer(query, contextTexts, history);
        
        // 4. Save AI response
        await this.chatService.savemsg(chatId, 'AI', answer);
        
        return {
            query: query,
            answer: answer,
            matches: matches
        };
    }
}
