import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { languageOf, translate } from './translate.js';

@Catch(HttpException)
export class TranslateExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const language = languageOf(http.getRequest<Request>().headers['accept-language']);
    const status = exception.getStatus();
    const response = exception.getResponse();
    const body: Record<string, unknown> =
      typeof response === 'string' ? { statusCode: status, message: response } : { ...(response as object) };
    if (typeof body.message === 'string') {
      body.message = translate(body.message, language);
    } else if (Array.isArray(body.message)) {
      body.message = body.message.map((message: unknown) =>
        typeof message === 'string' ? translate(message, language) : message,
      );
    }
    http.getResponse<Response>().status(status).json(body);
  }
}
