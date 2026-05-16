import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { SemanticModelController } from './semantic-model.controller';
import { SemanticModelService } from './semantic-model.service';

@Module({
  imports: [ProjectsModule],
  controllers: [SemanticModelController],
  providers: [SemanticModelService],
})
export class SemanticModelModule {}
