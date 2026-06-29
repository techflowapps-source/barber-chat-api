import { IsString, MinLength } from 'class-validator';
export class SendMessageDto {
  @IsString() @MinLength(8) phone!: string;
  @IsString() @MinLength(1) message!: string;
}
