import { ExceptionFilter,Catch,ArgumentsHost,HttpException,HttpStatus } from "@nestjs/common";
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter{
catch(exception: unknown, host: ArgumentsHost){
    const ctx = host.switchToHttp();
}
}