import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { Observable, throwError } from "rxjs";
import { catchError } from "rxjs/operators";
import { environment } from "../../../environments/environment";

/**
 * Two jobs:
 * 1. Only touch requests going to webapp/server (not e.g. GitHub releases
 *    checks or other third-party calls appcore makes) - adds
 *    withCredentials so the browser sends the httpOnly auth cookie set by
 *    POST /api/auth/login. The cookie itself is never readable/settable
 *    from JS, which is the point.
 * 2. On a 401 from the backend, redirect to /login rather than letting
 *    every consumer of HttpClient handle auth failures individually.
 */
@Injectable()
export class WebappHttpInterceptor implements HttpInterceptor {
  constructor(@Inject(Router) private readonly router: Router) {}

  public intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!request.url.startsWith(environment.backendBaseUrl)) {
      return next.handle(request);
    }

    const authenticatedRequest = request.clone({ withCredentials: true });

    return next.handle(authenticatedRequest).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.router.navigate(["/login"]);
        }
        return throwError(error);
      })
    );
  }
}
