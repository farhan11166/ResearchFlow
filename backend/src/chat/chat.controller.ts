import { Controller,Post,Body } from '@nestjs/common';
import { AiService } from '../ai/ai.service';

@Controller('chat')
export class ChatController {
    constructor(private readonly aiService: AiService){}

    @Post('search')
    async searchDocuments(@Body('query') query: string){
        if(!query){
            return {error: 'Search query is required'};
        }

        const matches = await this.aiService.searchSimilarChunks(query);

        const contextTexts = matches.map(m => String(m.text));


        const answer = await this.aiService.generateAnswer(query, contextTexts);
        

        
        return {
            query: query,
            answer: answer,
            matches: matches
        };
    }
}
