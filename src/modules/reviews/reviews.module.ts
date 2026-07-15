import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { Review } from './entities/review.entity';
import { ReviewsAdminController } from './reviews-admin.controller';
import { ReviewsPublicController } from './reviews-public.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [TypeOrmModule.forFeature([Review]), AuthModule, AuditModule],
  controllers: [ReviewsPublicController, ReviewsAdminController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
