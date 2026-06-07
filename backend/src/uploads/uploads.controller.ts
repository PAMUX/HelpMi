import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UploadsService } from './uploads.service.js';
import { PresignDto } from './dto/presign.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';

@ApiTags('uploads')
@ApiBearerAuth('access-token')
@Controller('uploads')
export class UploadsController {
  constructor(private uploads: UploadsService) {}

  @ApiOperation({ summary: 'Get a presigned upload URL (image; KYC=private)' })
  @Post('presign')
  presign(@CurrentUser() user: JwtPayload, @Body() dto: PresignDto) {
    return this.uploads.presign(user.id, dto);
  }
}
