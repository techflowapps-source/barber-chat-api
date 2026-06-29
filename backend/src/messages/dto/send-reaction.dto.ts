import { IsObject, IsString, MinLength } from 'class-validator';

export class SendReactionDto {
  @IsString() @MinLength(8) phone!: string;
  @IsString() @MinLength(1) emoji!: string;
  @IsObject() key!: Record<string, unknown>;
}
