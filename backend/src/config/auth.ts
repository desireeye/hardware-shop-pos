import crypto from 'crypto';
import type { CookieOptions } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from './env.js';

export const JWT_COOKIE_NAME = 'hardware_shop_session';

export type AuthTokenPayload = JwtPayload & {
  sub: string;
  email: string;
  role: string;
};

export const getCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  maxAge: 8 * 60 * 60 * 1000,
});

export const signToken = (user: { id: string; email: string; role: string }) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: '8h' },
  );

export const verifyToken = (token: string) =>
  jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;

export const setAuthCookie = (res: { cookie: (name: string, value: string, options: CookieOptions) => void }, token: string) => {
  res.cookie(JWT_COOKIE_NAME, token, getCookieOptions());
};

export const clearAuthCookie = (res: { clearCookie: (name: string) => void }) => {
  res.clearCookie(JWT_COOKIE_NAME);
};

export const generateTemporaryPassword = () => {
  const randomPart = crypto.randomBytes(12).toString('hex');
  return `Temp${randomPart.slice(0, 8)}!`;
};
