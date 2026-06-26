import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async creachat(workspaceId: string, userId: string, title?: string) {
    // SECURITY CHECK: Verify the workspace exists and belongs to the user
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    if (workspace.userId !== userId)
      throw new ForbiddenException('You do not own this workspace!');

    return this.prisma.chat.create({
      data: {
        workspaceId: workspaceId,
        title: title || 'New chat',
      },
    });
  }

  async getHist(chatId: string) {
    return this.prisma.message.findMany({
      where: { chatId: chatId },
      orderBy: { createdAt: 'asc' }, // Oldest first
      take: 10, // Only grab the last 10 messages so we don't blow up token limits
    });
  }

  async savemsg(chatId: string, role: 'USER' | 'AI', content: string) {
    return this.prisma.message.create({
      data: {
        chatId,
        role,
        content,
      },
    });
  }
  async getChatDocumentIds(chatId: string, userId: string): Promise<string[]> {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      // selects all worksapce and document ids
      include: {
        workspace: { include: { documents: { select: { id: true } } } },
      },
    });

    if (!chat) throw new NotFoundException('Chat not found');

    if (chat.workspace.userId !== userId)
      throw new ForbiddenException('You do not own this chat!');

    // Return an array of pure document IDs (e.g. ["doc1", "doc2"])
    return chat.workspace.documents.map((doc) => doc.id);
  }
}
