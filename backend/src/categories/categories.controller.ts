import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';
import { Public } from '../common/decorators/public.decorator.js';

@Public()
@Controller('categories')
export class CategoriesController {
  constructor(private categories: CategoriesService) {}

  @Get()
  findAll() {
    return this.categories.findAll();
  }
}
