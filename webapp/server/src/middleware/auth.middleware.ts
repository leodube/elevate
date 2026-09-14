import { NextFunction, Request, Response } from "express";
import { container } from "tsyringe";
import { AUTH_COOKIE_NAME, AuthService } from "../services/auth.service";

/**
 * Guards a route behind the signed auth cookie. Mounted on everything
 * under /api except /api/auth/login.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authService = container.resolve(AuthService);
  const cookieValue = req.cookies?.[AUTH_COOKIE_NAME];

  if (!authService.verifySignedCookieValue(cookieValue)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
