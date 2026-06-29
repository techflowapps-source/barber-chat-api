import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
export class SendMediaDto {
  @IsString() @MinLength(8) phone!: string;
  @IsUrl() url!: string;
  @IsOptional() @IsString() caption?: string;
  @IsOptional() @IsString() fileName?: string;
}
