import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@Public()
@Controller('leads')
export class LeadsPublicController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Submit a lead (idempotent, rate-limited, honeypot-protected)' })
  async create(
    @Body() dto: CreateLeadDto,
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const ip = req.ip;
    const lead = await this.leads.create(dto, ip, idempotencyKey);
    return { id: lead.id, status: lead.status };
  }
}
