import { readFile } from 'node:fs/promises';
import { Command, CommandRunner, Option } from 'nest-commander';
import { Prisma } from '@prisma/client';
import { ProjectsService } from '../../projects/projects.service';
import { UsersService } from '../../users/users.service';

interface ImportProjectOptions {
  ownerEmail?: string;
  file?: string;
  name?: string;
  description?: string;
}

@Command({
  name: 'import-project',
  description: 'Import project schema JSON from file and create project record',
})
export class ImportProjectCommand extends CommandRunner {
  constructor(
    private readonly usersService: UsersService,
    private readonly projectsService: ProjectsService,
  ) {
    super();
  }

  async run(_params: string[], options: ImportProjectOptions): Promise<void> {
    const ownerEmail = options.ownerEmail?.trim().toLowerCase();
    const filePath = options.file?.trim();

    if (!ownerEmail) {
      throw new Error('Please provide --owner-email');
    }

    if (!filePath) {
      throw new Error('Please provide --file');
    }

    const owner = await this.usersService.findByEmail(ownerEmail);
    if (!owner) {
      throw new Error(`Owner user with email=${ownerEmail} not found`);
    }

    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Prisma.JsonObject;

    const project = await this.projectsService.create(owner.id, {
      name: options.name?.trim() || 'Imported Project',
      description: options.description,
      schemaJson: parsed,
    });

    console.log(`Project imported: ${project.id} (${project.name})`);
  }

  @Option({ flags: '--owner-email <email>', description: 'Owner user email' })
  parseOwnerEmail(value: string) {
    return value;
  }

  @Option({ flags: '--file <path>', description: 'Path to JSON file' })
  parseFile(value: string) {
    return value;
  }

  @Option({ flags: '--name <name>', description: 'Project name override' })
  parseName(value: string) {
    return value;
  }

  @Option({
    flags: '--description <description>',
    description: 'Project description',
  })
  parseDescription(value: string) {
    return value;
  }
}
