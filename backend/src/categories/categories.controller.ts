import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CategoriesService } from './categories.service.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('categories')
@Public()
@Controller('categories')
export class CategoriesController {
  constructor(private categories: CategoriesService) {}

  @ApiOperation({ summary: 'List active task categories' })
  @Get()
  findAll() {
    return this.categories.findAll();
  }
}
