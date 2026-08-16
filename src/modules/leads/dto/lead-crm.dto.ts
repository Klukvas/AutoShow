import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class AssignLeadDto {
  /** Team member id, or null to unassign. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;
}

export class FollowUpLeadDto {
  /** ISO-8601 timestamp, or null to clear the scheduled follow-up. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsISO8601()
  followUpAt?: string | null;
}

export class CreateLeadNoteDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @Length(1, 2000)
  text!: string;
}
