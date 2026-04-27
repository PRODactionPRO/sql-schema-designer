import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { MigrationsController } from './migrations.controller';
import { MigrationsService } from './migrations.service';

@Module({
  imports: [ProjectsModule],
  providers: [MigrationsService],
  controllers: [MigrationsController],
})
export class MigrationsModule {}
