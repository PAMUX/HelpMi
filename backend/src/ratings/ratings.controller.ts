import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RatingsService } from './ratings.service.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';

@ApiTags('ratings')
@ApiBearerAuth('access-token')
@Controller('ratings')
export class RatingsController {
  constructor(private ratings: RatingsService) {}

  @ApiOperation({ summary: 'Rate a completed task' })
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRatingDto) {
    return this.ratings.create(user.id, dto);
  }

  @ApiOperation({ summary: 'Ratings + summary for a user' })
  @Get('user/:userId')
  getForUser(@Param('userId') userId: string) {
    return this.ratings.getForUser(userId);
  }
}
