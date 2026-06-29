import { IsString, MinLength } from 'class-validator';

export class SendContactDto {
  @IsString() @MinLength(8) phone!: string;
  @IsString() @MinLength(1) displayName!: string;
  @IsString() @MinLength(10) vcard!: string;
}
