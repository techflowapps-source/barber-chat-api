import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { LogsService } from '../logs/logs.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';

const BRUTE_KEY = (email: string) => `auth:brute:${email}`;
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60 * 15;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private queue: QueueService,
    private logs: LogsService,
  ) {}

  private signAccess(payload: { sub: string; role: string }) {
    return this.jwt.sign(payload);
  }

  private signRefresh(payload: { sub: string }) {
    return this.jwt.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    });
  }

  private async assertNotLocked(email: string) {
    const redis = this.queue.getRedis();
    const locked = await redis.get(`${BRUTE_KEY(email)}:lock`);
    if (locked) throw new ForbiddenException('Conta temporariamente bloqueada. Tente novamente mais tarde.');
  }

  private async registerFailedAttempt(email: string) {
    const redis = this.queue.getRedis();
    const key = BRUTE_KEY(email);
    const attempts = await redis.incr(key);
    if (attempts === 1) await redis.expire(key, LOCKOUT_SECONDS);
    if (attempts >= MAX_ATTEMPTS) {
      await redis.set(`${key}:lock`, '1', 'EX', LOCKOUT_SECONDS);
      await redis.del(key);
      await this.logs.record('auth.brute_lock', { email });
    }
  }

  private async clearAttempts(email: string) {
    const redis = this.queue.getRedis();
    const key = BRUTE_KEY(email);
    await redis.del(key, `${key}:lock`);
  }

  async login(dto: LoginDto) {
    await this.assertNotLocked(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      await this.registerFailedAttempt(dto.email);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const ok = await bcrypt.compare(dto.senha, user.senhaHash);
    if (!ok) {
      await this.registerFailedAttempt(dto.email);
      await this.logs.record('auth.login_failed', { email: dto.email });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.clearAttempts(dto.email);
    const accessToken = this.signAccess({ sub: user.id, role: user.role });
    const refreshToken = this.signRefresh({ sub: user.id });

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: await bcrypt.hash(refreshToken, 10),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    await this.logs.record('auth.login', { userId: user.id, email: user.email });
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, nome: user.nome, email: user.email, role: user.role },
    };
  }

  async refresh(dto: RefreshDto) {
    try {
      const payload = this.jwt.verify(dto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      }) as { sub: string };
      const tokens = await this.prisma.refreshToken.findMany({
        where: { userId: payload.sub, expiresAt: { gt: new Date() } },
      });
      const valid = await Promise.any(
        tokens.map(async (t) =>
          (await bcrypt.compare(dto.refreshToken, t.tokenHash)) ? t : Promise.reject(),
        ),
      ).catch(() => null);
      if (!valid) throw new ForbiddenException();
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
      return { accessToken: this.signAccess({ sub: user.id, role: user.role }) };
    } catch {
      throw new ForbiddenException('Refresh token inválido');
    }
  }

  async logout(dto: LogoutDto) {
    try {
      const payload = this.jwt.verify(dto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      }) as { sub: string };
      await this.prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
      await this.logs.record('auth.logout', { userId: payload.sub });
    } catch {
      // idempotente
    }
    return { ok: true };
  }
}
