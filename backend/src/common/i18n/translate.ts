import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import { KA } from './ka.js';

export type Language = 'en' | 'ka';
export type Translate = (text: string) => string;

export const languageOf = (header: string | string[] | undefined): Language =>
  (Array.isArray(header) ? header[0] : header)?.trim().toLowerCase().startsWith('ka') ? 'ka' : 'en';

export const Lang = createParamDecorator(
  (_: unknown, context: ExecutionContext): Language =>
    languageOf(context.switchToHttp().getRequest<Request>().headers['accept-language']),
);

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PATTERNS = Object.entries(KA)
  .filter(([english]) => /\{\w+\}/.test(english))
  .map(([english, georgian]) => ({
    regex: new RegExp(
      '^' +
        english
          .split(/(\{\w+\})/)
          .map((part) => (/^\{\w+\}$/.test(part) ? `(?<${part.slice(1, -1)}>[\\s\\S]+?)` : escape(part)))
          .join('') +
        '$',
    ),
    georgian,
    fixed: english.replace(/\{\w+\}/g, '').length,
  }))
  .sort((a, b) => b.fixed - a.fixed);

export function translate(text: string, language: Language): string {
  if (language !== 'ka' || !text) {
    return text;
  }
  const exact = KA[text];
  if (exact !== undefined) {
    return exact;
  }
  for (const { regex, georgian } of PATTERNS) {
    const match = regex.exec(text);
    if (match) {
      return georgian.replace(/\{(\w+)\}/g, (_, name: string) => translate(match.groups![name], language));
    }
  }
  return text;
}

export const translator =
  (language: Language): Translate =>
  (text) =>
    translate(text, language);
