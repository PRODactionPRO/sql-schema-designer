import { Module } from '@nestjs/common';
import { ProjectDocumentsController } from './project-documents.controller';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  providers: [ProjectsService],
  controllers: [ProjectsController, ProjectDocumentsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
