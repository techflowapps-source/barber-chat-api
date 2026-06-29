import { IsString, MinLength } from 'class-validator';

export class CreatePromotionDto {
  @IsString() @MinLength(2) title!: string;
  @IsString() @MinLength(5) message!: string;
}
