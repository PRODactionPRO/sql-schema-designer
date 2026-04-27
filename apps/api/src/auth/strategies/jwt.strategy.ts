import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';

interface JwtPayload {
  sub: string;
  email: string;
  role?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'auth.jwtSecret',
        configService.get<string>('JWT_SECRET', 'dev_jwt_secret_change_me'),
      ),
    });
  }

  async validate(payload: JwtPayload) {
    await this.authService.validateUserById(payload.sub);

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role ?? 'user',
    };
  }
}
