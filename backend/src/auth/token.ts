import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_LIFETIME_MS = 12 * 60 * 60 * 1000;

function sign(payload: string): string {
  const secret = process.env.AUTH_SECRET ?? 'dev-only-secret-change-me';
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, exp: Date.now() + TOKEN_LIFETIME_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string): string | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    return null;
  }
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { u: string; exp: number };
    return exp > Date.now() ? u : null;
  } catch {
    return null;
  }
}
