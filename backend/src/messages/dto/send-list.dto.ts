import { IsArray, IsString, MinLength } from 'class-validator';

export class SendListDto {
  @IsString() @MinLength(8) phone!: string;
  @IsString() @MinLength(1) text!: string;
  @IsString() @MinLength(1) buttonText!: string;
  @IsArray() sections!: unknown[];
}
