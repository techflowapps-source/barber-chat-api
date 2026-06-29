import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsString() nome!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(6) senha!: string;
  @IsOptional() @IsEnum(Role) role?: Role;
}
