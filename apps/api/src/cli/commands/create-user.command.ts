import { Command, CommandRunner, Option } from 'nest-commander';
import { UsersService } from '../../users/users.service';
import * as bcrypt from 'bcrypt';

interface CreateUserOptions {
  email?: string;
  password?: string;
  name?: string;
  role?: string;
}

@Command({
  name: 'create-user',
  description: 'Create user with email/password and optional role',
})
export class CreateUserCommand extends CommandRunner {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  async run(_params: string[], options: CreateUserOptions): Promise<void> {
    const email = options.email?.trim().toLowerCase();
    const password = options.password;

    if (!email) {
      throw new Error('Please provide --email');
    }

    if (!password) {
      throw new Error('Please provide --password');
    }

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new Error(`User with email=${email} already exists`);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({
      email,
      passwordHash,
      name: options.name,
      role: options.role ?? 'user',
    });

    console.log(`User created: ${user.id} (${user.email}) role=${user.role}`);
  }

  @Option({ flags: '--email <email>', description: 'User email' })
  parseEmail(value: string) {
    return value;
  }

  @Option({ flags: '--password <password>', description: 'User password' })
  parsePassword(value: string) {
    return value;
  }

  @Option({ flags: '--name <name>', description: 'User display name' })
  parseName(value: string) {
    return value;
  }

  @Option({ flags: '--role <role>', description: 'Role (user/admin)' })
  parseRole(value: string) {
    return value;
  }
}
