import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, map } from 'rxjs';
import type { ImportIssue } from '../xlsx.js';
import { Language, languageOf, translate } from './translate.js';

const isImportReport = (body: unknown): body is { errors: ImportIssue[]; warnings: ImportIssue[] } =>
  !!body &&
  typeof body === 'object' &&
  Array.isArray((body as { errors?: unknown }).errors) &&
  Array.isArray((body as { warnings?: unknown }).warnings);

const translateIssue = (issue: ImportIssue, language: Language): ImportIssue => ({
  ...issue,
  column: issue.column === null ? null : translate(issue.column, language),
  message: translate(issue.message, language),
});

@Injectable()
export class TranslateReportInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const language = languageOf(context.switchToHttp().getRequest<Request>().headers['accept-language']);
    return next.handle().pipe(
      map((body: unknown) =>
        language !== 'en' && isImportReport(body)
          ? {
              ...body,
              errors: body.errors.map((issue) => translateIssue(issue, language)),
              warnings: body.warnings.map((issue) => translateIssue(issue, language)),
            }
          : body,
      ),
    );
  }
}
