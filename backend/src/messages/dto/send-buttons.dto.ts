import { IsArray, IsString, MinLength } from 'class-validator';

export class SendButtonsDto {
  @IsString() @MinLength(8) phone!: string;
  @IsString() @MinLength(1) text!: string;
  @IsArray() buttons!: unknown[];
}
