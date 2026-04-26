import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { RevisionsController } from './revisions.controller';
import { RevisionsService } from './revisions.service';

@Module({
  imports: [ProjectsModule],
  providers: [RevisionsService],
  controllers: [RevisionsController],
})
export class RevisionsModule {}
