import {IsEmail,IsNotEmpty,IsString,MinLength} from 'class-validator';

export class SignupDto{
    @IsEmail({},{message:'Please provide a valid email'})
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6,{message: 'Password must be at least 6 characters long'})
    password: string;

    @IsString()
    @IsNotEmpty()
    name: string;
}


export class LoginDto{
    @IsEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}