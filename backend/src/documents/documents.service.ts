import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import pdfParse from 'pdf-parse';

@Injectable()
export class DocumentsService {
    constructor(private readonly prisma: PrismaService){}

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
        return document;
    }
}
