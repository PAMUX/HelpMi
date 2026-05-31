import { IsUrl } from 'class-validator';

export class CompleteTaskDto {
  @IsUrl()
  completionPhotoUrl: string;
}
