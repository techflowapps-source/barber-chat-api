import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAppointmentDto {
  @IsString() @MinLength(8) phone!: string;
  @IsOptional() @IsString() nome?: string;
  @IsString() @MinLength(2) service!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsString() barberId?: string;
  @IsOptional() @IsString() notes?: string;
}
