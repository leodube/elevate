import bcrypt from "bcrypt";
import { sign, unsign } from "cookie-signature";
import { singleton } from "tsyringe";
import { env } from "../config/env";

export const AUTH_COOKIE_NAME = "elevate_auth";
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@singleton()
export class AuthService {
  /**
   * Checks submitted credentials against the configured username/password
   * hash. There is no user table - this is a single-user app.
   */
  public async verifyCredentials(username: string, password: string): Promise<boolean> {
    if (username !== env.auth.username) {
      return false;
    }
    return bcrypt.compare(password, env.auth.passwordHash);
  }

  /**
   * Produces a signed cookie value. The payload itself doesn't need to be
   * secret (it's just a marker + timestamp) - the signature is what
   * prevents forgery, since it can only be produced with SESSION_SECRET.
   */
  public createSignedCookieValue(): string {
    const payload = JSON.stringify({ iat: Date.now() });
    return sign(payload, env.auth.sessionSecret);
  }

  /**
   * Verifies a cookie's signature and expiry. Returns true if valid.
   */
  public verifySignedCookieValue(value: string | undefined): boolean {
    if (!value) {
      return false;
    }
    const unsigned = unsign(value, env.auth.sessionSecret);
    if (unsigned === false) {
      return false;
    }
    try {
      const payload = JSON.parse(unsigned) as { iat: number };
      return Date.now() - payload.iat < COOKIE_MAX_AGE_MS;
    } catch {
      return false;
    }
  }

  public get cookieMaxAgeMs(): number {
    return COOKIE_MAX_AGE_MS;
  }
}
