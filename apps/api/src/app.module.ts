import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { appConfig } from './config/app.config';
import { authConfig } from './config/auth.config';
import { corsConfig } from './config/cors.config';
import { databaseConfig } from './config/database.config';
import { MigrationsModule } from './migrations/migrations.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { RevisionsModule } from './revisions/revisions.module';
import { UsersModule } from './users/users.module';
import { ViewsModule } from './views/views.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, corsConfig, databaseConfig],
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    RevisionsModule,
    ViewsModule,
    MigrationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
