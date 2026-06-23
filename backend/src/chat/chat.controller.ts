import { Controller, Post, Body, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from '../ai/ai.service';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
    constructor(private readonly aiService: AiService,
        private readonly chatService: ChatService 
    ){}

    @Post('new')
    async createChat(@Body('workspaceId') workspaceId: string){
         if (!workspaceId) return { error: 'workspaceId is required' };
        return this.chatService.creachat(workspaceId);

    }
    
    @Post(':chatId/stream')
    async sendMsg(@Param('chatId') chatId: string, @Body('query') query:string, @Res() res: Response){
        if(!query) return res.status(400).json({error: ' Search query is required'});
        await this.chatService.savemsg(chatId,'USER',query);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control','no-cache');
        res.setHeader('Connection','keep-alive');


        const history = await this.chatService.getHist(chatId);

        const matches = await this.aiService.searchSimilarChunks(query);
        const contextTexts = matches.map(m=>String(m.text));
        
        try {
            // Get the AI Stream pipe
            const stream = await this.aiService.generateAnswerStream(query, contextTexts, history);
            let fullAnswer = "";

            for await(const chunk of stream) {
                const chunkText = chunk.text();
                fullAnswer += chunkText;
                res.write(`data: ${JSON.stringify({text: chunkText})}\n\n`);
            }

            await this.chatService.savemsg(chatId,'AI',fullAnswer);
            res.write(`data: ${JSON.stringify({ done: true, sources: matches })}\n\n`);
        } catch (error: any) {
            console.error("AI Error:", error);
            
            // Dynamically extract the status and message from ANY error
            const statusCode = error.status || 500;
            const statusMessage = error.statusText || error.message || 'Internal Server Error';

            res.write(`data: ${JSON.stringify({ 
                error: true, 
                status: statusCode, 
                message: statusMessage 
            })}\n\n`);
        } finally {
            // Always close the stream connection!
            res.end();
        }
    }

    
}
