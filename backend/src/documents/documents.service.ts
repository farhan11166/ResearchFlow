import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import pdfParse from 'pdf-parse';
import { AiService } from '../ai/ai.service'; // ← Import this
@Injectable()
export class DocumentsService {
    constructor(private readonly prisma: PrismaService,private readonly aiService: AiService){}
    async saveDocument(file: Express.Multer.File, userId: string,workspaceId?: string){
        const fileBuffer = fs.readFileSync(file.path);

        const pdfData = await pdfParse(fileBuffer);
        const extractedText = pdfData.text;
        const chunks = await this.aiService.chunkText(extractedText);
        console.log(`Successfully split document into ${chunks.length} chunks!`);
        console.log(`Preview of Chunk 1:`, chunks[0]?.substring(0, 100)); // Preview the first 100 characters of first split
        const vectors = await this.aiService.embedChunks(chunks);
         console.log(`Successfully generated ${vectors.length} vectors! First vector size: ${vectors[0].length}`);

        
        

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
        return document;
    }
}
