import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { BullRootModule } from './bull/bull.module';
import { CommonModule } from './common/common.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/jwt.guard';
import { RolesGuard } from './modules/auth/roles.guard';
import { BrandingModule } from './modules/branding/branding.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { FxModule } from './modules/fx/fx.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { LeadsModule } from './modules/leads/leads.module';
import { ListingsModule } from './modules/listings/listings.module';
import { MediaModule } from './modules/media/media.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SitemapModule } from './modules/sitemap/sitemap.module';
import { SlugModule } from './modules/slug/slug.module';
import { StorageModule } from './modules/storage/storage.module';
import { ViewsModule } from './modules/views/views.module';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    BullRootModule,
    DatabaseModule,
    ThrottlerModule.forRoot([{ name: 'global', ttl: 60_000, limit: 120 }]),
    StorageModule,
    SlugModule,
    FxModule,
    ViewsModule,
    NotificationModule,
    AuditModule,
    CatalogModule,
    AdminUsersModule,
    AuthModule,
    BrandingModule,
    ListingsModule,
    MediaModule,
    LeadsModule,
    AnalyticsModule,
    ReviewsModule,
    SitemapModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: false,
          transform: true,
          transformOptions: { enableImplicitConversion: false },
        }),
    },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
