import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const senhaHash = await bcrypt.hash(dto.senha, 10);
    return this.prisma.user.create({
      data: { nome: dto.nome, email: dto.email, senhaHash, role: dto.role ?? Role.BARBEIRO },
      select: { id: true, nome: true, email: true, role: true, createdAt: true },
    });
  }

  list() {
    return this.prisma.user.findMany({
      select: { id: true, nome: true, email: true, role: true, createdAt: true },
    });
  }

  async findOne(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, nome: true, email: true, role: true, createdAt: true },
    });
    if (!u) throw new NotFoundException();
    return u;
  }
}
