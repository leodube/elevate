import { Inject, Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from "@angular/router";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { from } from "rxjs";
import { WebappAuthService } from "./webapp-auth.service";

@Injectable({ providedIn: "root" })
export class WebappAuthGuard implements CanActivate {
  constructor(
    @Inject(WebappAuthService) private readonly authService: WebappAuthService,
    @Inject(Router) private readonly router: Router
  ) {}

  public canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    return from(this.authService.checkSession()).pipe(
      map(isAuthenticated => (isAuthenticated ? true : this.router.createUrlTree(["/login"])))
    );
  }
}
