import { Controller, Get, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @ApiOperation({ summary: 'Get my profile' })
  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.users.findById(user.id);
  }

  @ApiOperation({ summary: 'Update my profile' })
  @Patch('me')
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateUserDto) {
    return this.users.update(user.id, dto);
  }

  @ApiOperation({ summary: 'PDPA: export all my data' })
  @Get('me/export')
  exportMe(@CurrentUser() user: JwtPayload) {
    return this.users.exportMe(user.id);
  }

  @ApiOperation({ summary: 'PDPA: delete (anonymize) my account' })
  @Delete('me')
  deleteMe(@CurrentUser() user: JwtPayload) {
    return this.users.deleteMe(user.id);
  }

  @ApiOperation({ summary: 'Get a public profile' })
  @Public()
  @Get(':id/profile')
  getProfile(@Param('id') id: string) {
    return this.users.getPublicProfile(id);
  }
}
