import { HttpClient } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class WebappAuthService {
  constructor(@Inject(HttpClient) private readonly httpClient: HttpClient) {}

  public login(username: string, password: string): Promise<void> {
    return this.httpClient
      .post(`${environment.backendBaseUrl}/api/auth/login`, { username, password }, { withCredentials: true })
      .toPromise()
      .then(() => undefined);
  }

  public logout(): Promise<void> {
    return this.httpClient
      .post(`${environment.backendBaseUrl}/api/auth/logout`, {}, { withCredentials: true })
      .toPromise()
      .then(() => undefined);
  }

  /**
   * There's no dedicated "am I logged in" endpoint - this hits a cheap
   * authenticated route (sync status) and treats a non-401 response as a
   * valid session. Good enough for a guard check; a 401 gets redirected
   * to /login by WebappHttpInterceptor regardless.
   */
  public checkSession(): Promise<boolean> {
    return this.httpClient
      .get(`${environment.backendBaseUrl}/api/sync/status`, { withCredentials: true })
      .toPromise()
      .then(() => true)
      .catch(() => false);
  }
}
