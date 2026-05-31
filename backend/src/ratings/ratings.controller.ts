import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { RatingsService } from './ratings.service.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';

@Controller('ratings')
export class RatingsController {
  constructor(private ratings: RatingsService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRatingDto) {
    return this.ratings.create(user.id, dto);
  }

  @Get('user/:userId')
  getForUser(@Param('userId') userId: string) {
    return this.ratings.getForUser(userId);
  }
}
