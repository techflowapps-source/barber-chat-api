import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

const mockQueue = {
  getRedis: () => ({
    get: jest.fn().mockResolvedValue(null),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  }),
} as never;

const mockLogs = { record: jest.fn().mockResolvedValue(undefined) } as never;

describe('AuthService', () => {
  it('rejeita credenciais inválidas', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } } as never;
    const svc = new AuthService(prisma, new JwtService({ secret: 'x' }), mockQueue, mockLogs);
    await expect(svc.login({ email: 'a@b.c', senha: '123456' })).rejects.toThrow();
  });

  it('emite tokens quando senha confere', async () => {
    const senhaHash = await bcrypt.hash('s3cret!!', 10);
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u', email: 'a@b.c', role: 'ADMIN', senhaHash, nome: 'Admin' }) },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    } as never;
    const svc = new AuthService(prisma, new JwtService({ secret: 'x' }), mockQueue, mockLogs);
    const out = await svc.login({ email: 'a@b.c', senha: 's3cret!!' });
    expect(out.accessToken).toBeDefined();
    expect(out.refreshToken).toBeDefined();
  });
});
