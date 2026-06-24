import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { DocumentsModule } from './documents/documents.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { AiModule } from './ai/ai.module';
import { BullModule } from '@nestjs/bullmq';
import { ChatService } from './chat/chat.service';
import { ChatController } from './chat/chat.controller';
import { ChatModule } from './chat/chat.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
     ThrottlerModule.forRoot([{
            ttl:60000,
            limit: 10,
        }]),
    AuthModule, 
    PrismaModule, 
    DocumentsModule, 
    WorkspacesModule, 
    AiModule, ChatModule
  ],
  controllers: [AppController, ChatController],
  providers: [    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AppService, 
    ChatService],
})
export class AppModule {}
