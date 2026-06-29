import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService, private wa: WhatsappService) {}

  list() { return this.prisma.contact.findMany({ orderBy: { createdAt: 'desc' } }); }

  async findOne(id: string) {
    const c = await this.prisma.contact.findUnique({ where: { id } });
    if (!c) throw new NotFoundException();
    return c;
  }

  groups() { return this.wa.listGroups(); }
  check(phone: string) { return this.wa.checkNumber(phone); }
  picture(phone: string) { return this.wa.profilePicture(phone); }
  name(phone: string) { return this.wa.contactName(phone); }
}
