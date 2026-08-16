import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class AssignLeadDto {
  /** Team member id, or null to unassign. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;
}

export class FollowUpLeadDto {
  /**
   * ISO-8601 timestamp WITH a timezone offset (Z or ±hh:mm), or null to clear.
   * Requiring the offset avoids storing an ambiguous local time — a bare
   * `2024-01-15T10:00` would be parsed differently depending on the server TZ.
   */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'followUpAt must include a timezone offset (Z or ±hh:mm)',
  })
  followUpAt?: string | null;
}

export class CreateLeadNoteDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @Length(1, 2000)
  text!: string;
}
