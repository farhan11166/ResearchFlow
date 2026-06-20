import { Injectable } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import {GoogleGenerativeAI} from '@google/generative-ai';

@Injectable()
export class AiService {
    private genAI: GoogleGenerativeAI;
    constructor(){
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing');
        }
        // .trim() is incredibly important here! If there is a trailing space in your .env file, 
        // it breaks the Google URL and returns a 404 Not Found error!
        this.genAI = new GoogleGenerativeAI(apiKey.trim());
        
    }
 async chunkText(text: string): Promise<string[]>{
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
    });
    const chunks = await splitter.createDocuments([text]);
    return chunks.map((chunk)=> chunk.pageContent);}

 async embedChunks(chunks: string[]): Promise<number[][]>{

    // Using the exact model name available to your API key
    const model = this.genAI.getGenerativeModel({model: 'gemini-embedding-2'});

    const embeddings= await Promise.all(
        chunks.map(async(chunk)=>{
            const result = await model.embedContent(chunk);
            return result.embedding.values;
        })
    );
    return embeddings;

   }




 }

   
 

