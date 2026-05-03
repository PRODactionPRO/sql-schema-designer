import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email is already in use');
    }

    const rounds = Number(
      this.configService.get<string>(
        'auth.bcryptSaltRounds',
        this.configService.get<string>('BCRYPT_SALT_ROUNDS', '10'),
      ),
    );
    const passwordHash = await bcrypt.hash(dto.password, rounds);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user);
  }

  async loginDemo() {
    const enabled = this.configService.get<string>('DEMO_AUTH_ENABLED', 'false');
    if (!['1', 'true', 'yes', 'on'].includes(enabled.toLowerCase())) {
      throw new ForbiddenException('Demo login is disabled');
    }

    const email = this.configService.get<string>(
      'DEMO_USER_EMAIL',
      'demo@sql-schema-designer.local',
    );
    const name = this.configService.get<string>('DEMO_USER_NAME', 'Demo User');
    const password = this.configService.get<string>(
      'DEMO_USER_PASSWORD',
      'demo_password_change_me',
    );

    let user = await this.usersService.findByEmail(email);
    if (!user) {
      const rounds = Number(
        this.configService.get<string>(
          'auth.bcryptSaltRounds',
          this.configService.get<string>('BCRYPT_SALT_ROUNDS', '10'),
        ),
      );
      const passwordHash = await bcrypt.hash(password, rounds);
      user = await this.usersService.create({
        email,
        passwordHash,
        name,
        role: 'demo',
      });
    }

    await this.ensureDemoProject(user.id);
    return this.buildAuthResponse(user);
  }

  async validateUserById(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  private async buildAuthResponse(user: User) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  private async ensureDemoProject(ownerId: string) {
    const existing = await this.prisma.project.findFirst({
      where: {
        ownerId,
        name: 'Product Analytics Demo',
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) return;

    await this.prisma.project.create({
      data: {
        ownerId,
        name: 'Product Analytics Demo',
        description: 'Preloaded demo project for live presentation',
        schemaJson: {
          tables: [
            {
              id: 'users',
              name: 'users',
              x: 140,
              y: 100,
              columns: [
                { id: 'id', name: 'id', type: 'uuid', isPrimary: true, nullable: false },
                { id: 'email', name: 'email', type: 'text', nullable: false },
                { id: 'created_at', name: 'created_at', type: 'timestamptz', nullable: false },
              ],
            },
            {
              id: 'events',
              name: 'events',
              x: 480,
              y: 100,
              columns: [
                { id: 'id', name: 'id', type: 'uuid', isPrimary: true, nullable: false },
                { id: 'user_id', name: 'user_id', type: 'uuid', nullable: false },
                { id: 'event_name', name: 'event_name', type: 'text', nullable: false },
                { id: 'occurred_at', name: 'occurred_at', type: 'timestamptz', nullable: false },
              ],
            },
            {
              id: 'subscriptions',
              name: 'subscriptions',
              x: 820,
              y: 100,
              columns: [
                { id: 'id', name: 'id', type: 'uuid', isPrimary: true, nullable: false },
                { id: 'user_id', name: 'user_id', type: 'uuid', nullable: false },
                { id: 'plan', name: 'plan', type: 'text', nullable: false },
                { id: 'status', name: 'status', type: 'text', nullable: false },
              ],
            },
          ],
          relations: [
            { id: 'events_users', fromTableId: 'events', fromColumnId: 'user_id', toTableId: 'users', toColumnId: 'id' },
            { id: 'subscriptions_users', fromTableId: 'subscriptions', fromColumnId: 'user_id', toTableId: 'users', toColumnId: 'id' },
          ],
          domains: [],
          enums: [],
          settings: {},
        },
      },
    });
  }
}
