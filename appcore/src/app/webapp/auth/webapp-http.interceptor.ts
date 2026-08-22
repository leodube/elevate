import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { Observable, throwError } from "rxjs";
import { catchError } from "rxjs/operators";
import { environment } from "../../../environments/environment";
import { WebappAuthService } from "./webapp-auth.service";

/**
 * Two jobs:
 * 1. Only touch requests going to webapp/server (not e.g. GitHub releases
 *    checks or other third-party calls appcore makes) - adds
 *    withCredentials so the browser sends the httpOnly auth cookie set by
 *    POST /api/auth/login. The cookie itself is never readable/settable
 *    from JS, which is the point.
 * 2. On a 401 from the backend, flip the shared auth-state signal to
 *    false (e.g. a session expiring mid-use) and redirect to /login,
 *    rather than letting every consumer of HttpClient handle this
 *    individually. Note: the session-check flow itself
 *    (WebappAuthService.checkSession()) doesn't rely on this - it calls
 *    GET /api/auth/session, which always returns 200. This 401 handling
 *    is for protected endpoints failing unexpectedly after you were
 *    already logged in.
 */
@Injectable()
export class WebappHttpInterceptor implements HttpInterceptor {
  constructor(
    @Inject(Router) private readonly router: Router,
    @Inject(WebappAuthService) private readonly authService: WebappAuthService
  ) {}

  public intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!request.url.startsWith(environment.backendBaseUrl)) {
      return next.handle(request);
    }

    const authenticatedRequest = request.clone({ withCredentials: true });

    return next.handle(authenticatedRequest).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.authService.isAuthenticated$.next(false);
          if (!this.router.url.startsWith("/login")) {
            this.router.navigate(["/login"]);
          }
        }
        return throwError(error);
      })
    );
  }
}
