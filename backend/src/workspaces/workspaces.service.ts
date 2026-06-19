import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './workspaces.dto';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async createWorkspace(dto: CreateWorkspaceDto, userId: string) {
    return this.prisma.workspace.create({
      data: {
        name: dto.name,
        description: dto.description,
        userId: userId,
      },
    });
  }

  async getUserWorkspaces(userId: string) {
    return this.prisma.workspace.findMany({
      where: { userId },
      include: {
        _count: {
          select: { documents: true }, // Returns how many documents are in this workspace
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
