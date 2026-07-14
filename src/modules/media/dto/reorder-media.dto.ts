import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ReorderMediaDto {
  @ApiProperty({ isArray: true, type: String })
  @IsArray()
  @IsUUID('all', { each: true })
  ids!: string[];
}
