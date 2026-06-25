import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import pdfParse from 'pdf-parse';
import { Module } from '@nestjs/common';
import { AiService } from '../ai/ai.service'; // ← Import this
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';





@Injectable()
export class DocumentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly aiService: AiService,
        @InjectQueue('document-processing') private readonly documentQueue: Queue
    ){}
    
    async saveDocument(file: Express.Multer.File, userId: string,workspaceId?: string){
        const fileBuffer = fs.readFileSync(file.path);

        const pdfData = await pdfParse(fileBuffer);
        const extractedText = pdfData.text;

        const document = await this.prisma.document.create({
            data: {
                filename: file.originalname,
                size: file.size,
                type: file.mimetype, // pdf only
                url: file.path, //path where it is saved
                uploadStatus: 'COMPLETED',
                text: extractedText,
                userId: userId,
                workspaceId: workspaceId || null,
            },
        });
// Add the heavy AI processing to the background queue!
        await this.documentQueue.add('process-document',{
            documentId: document.id,
            text: extractedText
        },{

            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            }
        });

        
        return document;
    }
}

