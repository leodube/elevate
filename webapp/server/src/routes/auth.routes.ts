import { Router } from "express";
import { container } from "tsyringe";
import { AUTH_COOKIE_NAME, AuthService } from "../services/auth.service";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Missing username or password" });
    return;
  }

  const authService = container.resolve(AuthService);
  const valid = await authService.verifyCredentials(username, password);

  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  res.cookie(AUTH_COOKIE_NAME, authService.createSignedCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: authService.cookieMaxAgeMs
  });
  res.status(200).json({ ok: true });
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME);
  res.status(200).json({ ok: true });
});

authRouter.get("/session", (req, res) => {
  const authService = container.resolve(AuthService);
  const cookieValue = req.cookies?.[AUTH_COOKIE_NAME];
  const authenticated = authService.verifySignedCookieValue(cookieValue);
  res.status(200).json({ authenticated });
});
