import { Injectable,UnauthorizedException,ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { SignupDto, LoginDto } from './auth.dto';
import * as bcrypt from 'bcrypt';


@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ){}

    async signup(signupDto: SignupDto){
        const{email,password,name}=signupDto;

        const existingUser = await.this.prisma.user.findUnique({
            where: {email},
        });
        if(existingUser){
            throw new ConflictException('User already exists');
        }
        const hashedPassword = await bcrypt.hash(password,10);
        const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
      });
      const payload = { email: user.email, sub: user.id };
       return {
      access_token: this.jwtService.sign(payload),
      };        
    }
async login(loginDto: LoginDto){
    const {email, password}= loginDto;
    const user = await this.prisma.user.findUnique({
        where: {email},
    });
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
     const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // 3. Generate and return a JWT token
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
}
}

