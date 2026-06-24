import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './workspaces.dto';

@Injectable()
export class WorkspacesService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

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
    // 1. Define a highly specific cache key for this exact user
    const cacheKey = `workspaces_user_${userId}`;

    // 2. Check if the data is already in Redis
    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) {
      console.log('⚡ Fetched Workspaces from Redis Cache!');
      return cachedData;
    }

    // 3. If not in Redis, run the heavy Postgres Query
    console.log('🐘 Fetched Workspaces from Postgres Database!');
    const workspaces = await this.prisma.workspace.findMany({
      where: { userId },
      include: {
        _count: {
          select: { documents: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 4. Save the result into Redis so it's fast next time (Cache for 30 seconds)
    await this.cacheManager.set(cacheKey, workspaces, 30000);

    return workspaces;
  }
}
