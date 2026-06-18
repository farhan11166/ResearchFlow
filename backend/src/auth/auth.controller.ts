import { Controller,Post,Body,HttpCode,HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto } from './auth.dto';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService){}

  @Post('signup')
  async sigup(@Body() signupDto: SignupDto){
    return this.authService.signup(signupDto);
  }


  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto){
    return this.authService.login(loginDto);
  }







}
