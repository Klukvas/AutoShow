import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUser } from '../admin-users/entities/admin-user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { JwtAuthGuard } from './jwt.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [JwtModule.register({}), TypeOrmModule.forFeature([AdminUser])],
  controllers: [AuthController],
  providers: [AuthService, AuthTokenService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, AuthTokenService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
