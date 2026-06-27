import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from '../ai/ai.service';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly aiService: AiService,
    private readonly chatService: ChatService,
  ) {}

  @Post('new')
  async createChat(@Body('workspaceId') workspaceId: string, @Request() req) {
    if (!workspaceId) return { error: 'workspaceId is required' };
    return this.chatService.creachat(workspaceId, req.user.id);
  }

  /**
   * Simple one-shot chat endpoint for the frontend.
   * Creates a chat session if needed, runs the full RAG pipeline,
   * and returns the AI answer as a plain JSON response.
   */
  @Post('message')
  async sendMessage(
    @Body('message') message: string,
    @Body('workspaceId') workspaceId: string,
    @Body('chatId') chatId: string,
    @Request() req,
  ) {
    if (!message) return { error: 'message is required' };

    // Auto-create a chat session if none provided
    let sessionId = chatId;
    if (!sessionId && workspaceId) {
      const chat = await this.chatService.creachat(workspaceId, req.user.id);
      sessionId = chat.id;
    }

    if (sessionId) {
      await this.chatService.savemsg(sessionId, 'USER', message);
    }

    const history = sessionId ? await this.chatService.getHist(sessionId) : [];

    const allowedDocumentIds = sessionId
      ? await this.chatService.getChatDocumentIds(sessionId, req.user.id)
      : [];

    const matches = await this.aiService.searchSimilarChunks(
      message,
      4,
      allowedDocumentIds,
    );
    const contextTexts = matches.map((m) => String(m.text));

    const answer = await this.aiService.generateAnswer(
      message,
      contextTexts,
      history,
    );

    if (sessionId) {
      await this.chatService.savemsg(sessionId, 'AI', answer);
    }

    return { response: answer, chatId: sessionId, sources: matches };
  }

  @Post(':chatId/stream')
  async sendMsg(
    @Param('chatId') chatId: string,
    @Body('query') query: string,
    @Request() req,
    @Res() res: Response,
  ) {
    if (!query)
      return res.status(400).json({ error: 'Search query is required' });
    await this.chatService.savemsg(chatId, 'USER', query);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const history = await this.chatService.getHist(chatId);

    const allowedDocumentIds = await this.chatService.getChatDocumentIds(
      chatId,
      req.user.id,
    );

    const matches = await this.aiService.searchSimilarChunks(
      query,
      4,
      allowedDocumentIds,
    );
    const contextTexts = matches.map((m) => String(m.text));

    try {
      const stream = await this.aiService.generateAnswerStream(
        query,
        contextTexts,
        history,
      );
      let fullAnswer = '';

      for await (const chunk of stream) {
        const chunkText = chunk.text();
        fullAnswer += chunkText;
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }

      await this.chatService.savemsg(chatId, 'AI', fullAnswer);
      res.write(
        `data: ${JSON.stringify({ done: true, sources: matches })}\n\n`,
      );
    } catch (error: any) {
      console.error('AI Error:', error);
      const statusCode = error.status || 500;
      const statusMessage =
        error.statusText || error.message || 'Internal Server Error';
      res.write(
        `data: ${JSON.stringify({
          error: true,
          status: statusCode,
          message: statusMessage,
        })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  @Get('history/:chatId')
  async getHistory(@Param('chatId') chatId: string) {
    return this.chatService.getHist(chatId);
  }

  @Get('workspace/:workspaceId')
  async getWorkspaceChats(
    @Param('workspaceId') workspaceId: string,
    @Request() req,
  ) {
    const chats = await this.chatService.getWorkspaceChats(workspaceId, req.user.id);
    return chats;
  }
}
