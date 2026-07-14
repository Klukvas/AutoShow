import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Submit a lead (rate-limited, honeypot-protected)' })
  async create(@Body() dto: CreateLeadDto, @Req() req: Request) {
    const ip = req.ip;
    const lead = await this.leads.create(dto, ip);
    return { id: lead.id, status: lead.status };
  }
}
