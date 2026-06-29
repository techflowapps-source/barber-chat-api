import { PipeTransform, Injectable } from '@nestjs/common';
import { sanitizePayload } from '../utils/sanitize.util';

@Injectable()
export class SanitizePipe implements PipeTransform {
  transform<T>(value: T): T {
    if (value && typeof value === 'object') return sanitizePayload(value);
    return value;
  }
}
