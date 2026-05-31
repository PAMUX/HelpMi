import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.users.findById(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateUserDto) {
    return this.users.update(user.id, dto);
  }

  @Public()
  @Get(':id/profile')
  getProfile(@Param('id') id: string) {
    return this.users.getPublicProfile(id);
  }
}
