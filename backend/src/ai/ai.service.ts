import { Injectable, OnModuleInit } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { QdrantClient } from '@qdrant/js-client-rest';
import * as crypto from 'crypto';

@Injectable()
export class AiService implements OnModuleInit {
    private genAI: GoogleGenerativeAI;
    private qdrant: QdrantClient;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is missing');
        }
        this.genAI = new GoogleGenerativeAI(apiKey.trim());
        this.qdrant = new QdrantClient({ url: 'http://localhost:6333' });
    }

    // Runs once when the application starts
    async onModuleInit() {
        // Create the collection if it doesn't exist
        const collectionName = 'documents';
        try {
            const collections = await this.qdrant.getCollections();
            const exists = collections.collections.some(c => c.name === collectionName);
            
            if (!exists) {
                console.log(`Creating Qdrant collection: ${collectionName}...`);
                await this.qdrant.createCollection(collectionName, {
                    vectors: {
                        size: 3072, // Gemini's embedding size is 3072
                        distance: 'Cosine',
                    },
                });
                console.log('Qdrant collection created successfully!');
            }
        } catch (error) {
            console.error('Failed to initialize Qdrant collection:', error);
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
        const model = this.genAI.getGenerativeModel({ model: 'gemini-embedding-2' });

        const embeddings = await Promise.all(
            chunks.map(async (chunk) => {
                const result = await model.embedContent(chunk);
                return result.embedding.values;
            })
        );
        return embeddings;
    }

    // New method to combine the flow and store in Qdrant
    async processAndStoreDocument(documentId: string, text: string) {
        console.log(`Processing document ${documentId}...`);
        
        // 1. Chunk
        const chunks = await this.chunkText(text);
        
        // 2. Embed
        const vectors = await this.embedChunks(chunks);

        // 3. Prepare data for Qdrant
        const points = chunks.map((chunk, index) => ({
            id: crypto.randomUUID(),     // Unique ID for this specific chunk
            vector: vectors[index],      // The embedding math array
            payload: {                   // Metadata we can filter by later
                documentId: documentId,
                text: chunk,             // We store the actual text so we can read it after searching!
                chunkIndex: index
            }
        }));

        // 4. Save to Qdrant
        await this.qdrant.upsert('documents', {
            wait: true, // Wait until the vectors are actually saved
            points: points
        });

        console.log(`✅ Successfully stored ${points.length} chunks in Qdrant Vector DB!`);
    }
    async searchSimilarChunks(query: string,limit: number = 4, documentIds?: string[]){
        const model = this.genAI.getGenerativeModel({model: 'gemini-embedding-2'});
        const result = await model.embedContent(query);
        const queryVector = result.embedding.values;


        let filter: any = undefined;

        if(documentIds && documentIds.length > 0){
            filter={
                must: [
                    {
                        key: "documentId",
                        match: {
                            any: documentIds
                        }
                    },
                    
                ]
            };
        }

        const searchResults = await this.qdrant.search('documents',{
            vector: queryVector,
            limit: limit,
            filter: filter,
            with_payload: true,
        });
       return searchResults.map(match =>({
        score: match.score,
        text: match.payload?.text,
        documentId: match.payload?.documentId,   
       }));
    }
    async generateAnswer(query: string, contextChunks: string[], chatHistory: {role: string, content: string}[]): Promise<string> {

        const contextText = contextChunks.join('\n\n---\n\n')
        const historyText = chatHistory.map(msg=>
            `${msg.role=== 'USER' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n\n');
        const prompt = `
            You are a helpful AI research assistant. 
            Answer the user's question using ONLY the provided document context below. 
            If the answer is not contained in the context, say "I cannot find the answer in the provided documents."
            Do not use outside knowledge.
            PREVIOUS CONVERSATION HISTORY:
            ${historyText || 'No previous conversation.'}

            CONTEXT:
            ${contextText}
            USER QUESTION: 
            ${query}
        `;
        // 3. Ask the Gemini Text model to generate the answer
        const model = this.genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
        const result = await model.generateContent(prompt);
        
        return result.response.text();



    }

    async generateAnswerStream(query: string, contextChunks: string[], chatHistory:{role: string, content: string}[]){
        // NEW: Number each chunk so the AI knows its source ID
        const contextText = contextChunks.map((chunk, index) => `[Source ${index + 1}]\n${chunk}`).join('\n\n---\n\n');
        
        const historyText = chatHistory.map(msg =>
            `${msg.role === 'USER' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n\n');

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
        const model = this.genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

        const result = await model.generateContentStream(prompt);
        return result.stream;

    }

}


   
 

