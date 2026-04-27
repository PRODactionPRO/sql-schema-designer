import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from '../config/app.config';
import { authConfig } from '../config/auth.config';
import { corsConfig } from '../config/cors.config';
import { databaseConfig } from '../config/database.config';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import { CreateUserCommand } from './commands/create-user.command';
import { ImportProjectCommand } from './commands/import-project.command';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, corsConfig, databaseConfig],
    }),
    PrismaModule,
    UsersModule,
    ProjectsModule,
  ],
  providers: [CreateUserCommand, ImportProjectCommand],
})
export class CliModule {}
