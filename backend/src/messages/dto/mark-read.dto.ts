import { IsObject } from 'class-validator';

export class MarkReadDto {
  @IsObject() key!: Record<string, unknown>;
}
