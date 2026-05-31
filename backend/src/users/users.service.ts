import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { doerProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
      include: { doerProfile: true },
    });
  }

  async getPublicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        isDoer: true,
        isPoster: true,
        createdAt: true,
        doerProfile: {
          select: {
            tier: true,
            kycStatus: true,
            totalJobsCompleted: true,
            avgRating: true,
            onTimeRate: true,
          },
        },
        ratingsReceived: {
          select: { score: true, comment: true, isOnTime: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
