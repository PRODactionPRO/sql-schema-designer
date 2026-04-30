import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(configService: ConfigService) {
    const databaseUrl =
      process.env.DATABASE_URL ??
      configService.get<string>('database.url') ??
      'postgresql://postgres:postgres@localhost:5434/sql_schema_designer?schema=public';
    super({
      datasourceUrl: databaseUrl,
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
