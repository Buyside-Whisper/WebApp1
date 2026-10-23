import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import { KA } from './ka.js';
import { RU } from './ru.js';

export type Language = 'en' | 'ka' | 'ru';

export const LANGUAGES: Language[] = ['en', 'ka', 'ru'];

const DICTIONARIES: Record<Exclude<Language, 'en'>, Record<string, string>> = { ka: KA, ru: RU };
export type Translate = (text: string) => string;

export const languageOf = (header: string | string[] | undefined): Language => {
  const code = (Array.isArray(header) ? header[0] : header)?.trim().toLowerCase().slice(0, 2);
  return code === 'ka' || code === 'ru' ? code : 'en';
};

export const Lang = createParamDecorator(
  (_: unknown, context: ExecutionContext): Language =>
    languageOf(context.switchToHttp().getRequest<Request>().headers['accept-language']),
);

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compile = (dictionary: Record<string, string>) =>
  Object.entries(dictionary)
    .filter(([english]) => /\{\w+\}/.test(english))
    .map(([english, translated]) => ({
      regex: new RegExp(
        '^' +
          english
            .split(/(\{\w+\})/)
            .map((part) => (/^\{\w+\}$/.test(part) ? `(?<${part.slice(1, -1)}>[\\s\\S]+?)` : escape(part)))
            .join('') +
          '$',
      ),
      translated,
      fixed: english.replace(/\{\w+\}/g, '').length,
    }))
    .sort((a, b) => b.fixed - a.fixed);

const PATTERNS = { ka: compile(KA), ru: compile(RU) };

export function translate(text: string, language: Language): string {
  if (language === 'en' || !text) {
    return text;
  }
  const exact = DICTIONARIES[language][text];
  if (exact !== undefined) {
    return exact;
  }
  for (const { regex, translated } of PATTERNS[language]) {
    const match = regex.exec(text);
    if (match) {
      return translated.replace(/\{(\w+)\}/g, (_, name: string) => translate(match.groups![name], language));
    }
  }
  return text;
}

export const translator =
  (language: Language): Translate =>
  (text) =>
    translate(text, language);
