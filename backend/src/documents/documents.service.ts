import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import pdfParse from 'pdf-parse';
import { AiService } from '../ai/ai.service'; // ← Import this
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as Tesseract from 'tesseract.js';
import * as pdf2img from 'pdf-img-convert';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    @InjectQueue('document-processing') private readonly documentQueue: Queue,
  ) {}

  async saveDocument(
    file: Express.Multer.File,
    userId: string,
    workspaceId?: string,
  ) {
    const fileBuffer = fs.readFileSync(file.path);

    const pdfData = await pdfParse(fileBuffer);
    let extractedText = pdfData.text.trim();

    if (extractedText.length < 50) {
      this.logger.warn('No text found by pdf-parse. Triggering local Tesseract OCR...');

      const pdfImages = await pdf2img.convert(fileBuffer);
      let ocrText = '';

      for (let i = 0; i < pdfImages.length; i++) {
        this.logger.log(`Scanning page ${i + 1} with Tesseract...`);
        // pdfImages[i] is a Uint8Array, so we wrap it in a Node Buffer
        const result = await Tesseract.recognize(
          Buffer.from(pdfImages[i]),
          'eng',
        );
        ocrText += result.data.text + '\n\n';
      }

      extractedText = ocrText.trim();
      this.logger.log('Tesseract OCR completed successfully.');
    }

    const document = await this.prisma.document.create({
      data: {
        filename: file.originalname,
        size: file.size,
        type: file.mimetype, // pdf only
        url: file.path, //path where it is saved
        uploadStatus: 'COMPLETED',
        text: extractedText, // ocr if normal failed;
        userId: userId,
        workspaceId: workspaceId || null,
      },
    });
    // Add the heavy AI processing to the background queue!
    await this.documentQueue.add(
      'process-document',
      {
        documentId: document.id,
        text: extractedText,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    return document;
  }

  async getDocuments(userId: string, workspaceId?: string) {
    return this.prisma.document.findMany({
      where: {
        userId,
        ...(workspaceId ? { workspaceId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        size: true,
        type: true,
        uploadStatus: true,
        createdAt: true,
        workspaceId: true,
      },
    });
  }
}
