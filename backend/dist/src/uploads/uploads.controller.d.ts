import { UploadsService } from './uploads.service.js';
import { PresignDto } from './dto/presign.dto.js';
import { type JwtPayload } from '../common/decorators/current-user.decorator.js';
export declare class UploadsController {
    private uploads;
    constructor(uploads: UploadsService);
    presign(user: JwtPayload, dto: PresignDto): Promise<import("./uploads.service.js").PresignResult>;
}
