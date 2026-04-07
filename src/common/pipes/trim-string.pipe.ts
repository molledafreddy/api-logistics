import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class TrimStringPipe implements PipeTransform {
  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private trim(values: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'string') {
        result[key] = value.trim();
      } else if (this.isObject(value)) {
        result[key] = this.trim(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  transform(values: unknown, metadata: ArgumentMetadata): unknown {
    const { type } = metadata;

    if (this.isObject(values) && type === 'body') {
      return this.trim(values as Record<string, unknown>);
    }

    return values;
  }
}
