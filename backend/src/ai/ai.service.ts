import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { QdrantClient } from '@qdrant/js-client-rest';
import * as crypto from 'crypto';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI;
  private qdrant: QdrantClient;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing');
    this.genAI = new GoogleGenerativeAI(apiKey.trim());
    this.qdrant = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
    });
  }

  async onModuleInit() {
    const collectionName = 'documents';
    try {
      const collections = await this.qdrant.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === collectionName,
      );
      if (!exists) {
        this.logger.log(`Creating Qdrant collection: ${collectionName}...`);
        await this.qdrant.createCollection(collectionName, {
          vectors: { size: 3072, distance: 'Cosine' },
        });
        this.logger.log('Qdrant collection created successfully!');
      }
    } catch (error) {
      this.logger.error('Failed to initialize Qdrant collection', error);
    }
  }

  async chunkText(text: string): Promise<string[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const chunks = await splitter.createDocuments([text]);
    return chunks.map((chunk) => chunk.pageContent);
  }

  async embedChunks(chunks: string[]): Promise<number[][]> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-embedding-2',
    });
    return Promise.all(
      chunks.map(async (chunk) => {
        const result = await model.embedContent(chunk);
        return result.embedding.values;
      }),
    );
  }

  async processAndStoreDocument(documentId: string, text: string) {
    this.logger.log(`Processing document ${documentId}...`);
    const chunks = await this.chunkText(text);
    const vectors = await this.embedChunks(chunks);

    const points = chunks.map((chunk, index) => ({
      id: crypto.randomUUID(),
      vector: vectors[index],
      payload: { documentId, text: chunk, chunkIndex: index },
    }));

    await this.qdrant.upsert('documents', { wait: true, points });
    this.logger.log(
      `Stored ${points.length} chunks for document ${documentId}`,
    );
  }

  async searchSimilarChunks(
    query: string,
    limit: number = 4,
    documentIds?: string[],
  ) {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-embedding-2',
    });
    const result = await model.embedContent(query);
    const queryVector = result.embedding.values;

    let filter: any = undefined;
    if (documentIds && documentIds.length > 0) {
      filter = { must: [{ key: 'documentId', match: { any: documentIds } }] };
    }

    const searchResults = await this.qdrant.search('documents', {
      vector: queryVector,
      limit,
      filter,
      with_payload: true,
    });

    return searchResults.map((match) => ({
      score: match.score,
      text: match.payload?.text,
      documentId: match.payload?.documentId,
    }));
  }

  async generateAnswer(
    query: string,
    contextChunks: string[],
    chatHistory: { role: string; content: string }[],
  ): Promise<string> {
    const contextText = contextChunks
      .map((chunk, index) => `[Source ${index + 1}]\n${chunk}`)
      .join('\n\n---\n\n');

    const historyText = chatHistory
      .map(
        (msg) =>
          `${msg.role === 'USER' ? 'User' : 'Assistant'}: ${msg.content}`,
      )
      .join('\n\n');

    const prompt = `
You are a helpful AI research assistant.
Answer the user's question using ONLY the provided document context below.

CRITICAL INSTRUCTION: When using information from the context, cite your sources inline using [Source X] format.
Example: "The revenue grew by 20% [Source 1]."
If the answer is not in the context, say "I cannot find the answer in the provided documents."
Do not use outside knowledge.

PREVIOUS CONVERSATION HISTORY:
${historyText || 'No previous conversation.'}

CONTEXT:
${contextText}

USER QUESTION:
${query}
    `;

    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  async generateAnswerStream(
    query: string,
    contextChunks: string[],
    chatHistory: { role: string; content: string }[],
  ) {
    const contextText = contextChunks
      .map((chunk, index) => `[Source ${index + 1}]\n${chunk}`)
      .join('\n\n---\n\n');

    const historyText = chatHistory
      .map(
        (msg) =>
          `${msg.role === 'USER' ? 'User' : 'Assistant'}: ${msg.content}`,
      )
      .join('\n\n');

    const prompt = `
You are a helpful AI research assistant.
Answer the user's question using ONLY the provided document context below.

CRITICAL INSTRUCTION: When using information from the context, YOU MUST cite your sources using the [Source X] format inline.
Example: "The mitochondria is the powerhouse of the cell [Source 1]."

If the answer is not contained in the context, say "I cannot find the answer in the provided documents."
Do not use outside knowledge.

PREVIOUS CONVERSATION HISTORY:
${historyText || 'No previous conversation.'}

CONTEXT:
${contextText}

USER QUESTION:
${query}
    `;

    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContentStream(prompt);
    return result.stream;
  }
}
