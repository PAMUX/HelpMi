import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../decorators/current-user.decorator.js';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const adminPhones = (this.config.get<string>('ADMIN_PHONES') ?? '')
      .split(',')
      .map((p) => p.trim());

    if (!adminPhones.includes(request.user.phone)) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
