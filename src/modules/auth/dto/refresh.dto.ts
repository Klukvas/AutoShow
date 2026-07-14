import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  @Matches(/^[a-f0-9]{32}\.[A-Za-z0-9_-]{64}$/, {
    message: 'refreshToken has invalid format',
  })
  refreshToken!: string;
}
