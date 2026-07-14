import { Module } from '@nestjs/common';
import { BullRootModule } from './bull/bull.module';
import { CommonModule } from './common/common.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { FxModule } from './modules/fx/fx.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { StorageModule } from './modules/storage/storage.module';
import { ViewsModule } from './modules/views/views.module';
import { WorkersModule } from './workers/workers.module';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    BullRootModule,
    DatabaseModule,
    StorageModule,
    FxModule,
    ViewsModule,
    NotificationModule,
    WorkersModule,
  ],
})
export class WorkerAppModule {}
