import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './workspaces.dto';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async createWorkspace(dto: CreateWorkspaceDto, userId: string) {
    const workspace = await this.prisma.workspace.create({
      data: {
        name: dto.name,
        description: dto.description,
        userId: userId,
      },
    });
    // Bust the cache so the new workspace appears immediately
    await this.cacheManager.del(`workspaces_user_${userId}`);
    return workspace;
  }

  async getUserWorkspaces(userId: string) {
    // 1. Define a highly specific cache key for this exact user
    const cacheKey = `workspaces_user_${userId}`;

    // 2. Check if the data is already in Redis
    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) {
      this.logger.log('Workspaces served from Redis cache');
      return cachedData;
    }

    // 3. If not in Redis, run the heavy Postgres Query
    this.logger.log('Workspaces fetched from Postgres');
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
