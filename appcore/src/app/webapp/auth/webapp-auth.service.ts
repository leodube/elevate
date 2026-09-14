import { HttpClient } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { environment } from "../../../environments/environment";

interface SessionResponse {
  authenticated: boolean;
}

@Injectable({ providedIn: "root" })
export class WebappAuthService {
  public readonly isAuthenticated$ = new BehaviorSubject<boolean>(false);

  constructor(@Inject(HttpClient) private readonly httpClient: HttpClient) {}

  public login(username: string, password: string): Promise<void> {
    return this.httpClient
      .post(`${environment.backendBaseUrl}/api/auth/login`, { username, password }, { withCredentials: true })
      .toPromise()
      .then(() => {
        this.isAuthenticated$.next(true);
      });
  }

  public logout(): Promise<void> {
    return this.httpClient
      .post(`${environment.backendBaseUrl}/api/auth/logout`, {}, { withCredentials: true })
      .toPromise()
      .then(() => {
        this.isAuthenticated$.next(false);
      });
  }

  public checkSession(): Promise<boolean> {
    return this.httpClient
      .get<SessionResponse>(`${environment.backendBaseUrl}/api/auth/session`, { withCredentials: true })
      .toPromise()
      .then(response => {
        const authenticated = response.authenticated;
        this.isAuthenticated$.next(authenticated);
        return authenticated;
      })
      .catch(() => {
        this.isAuthenticated$.next(false);
        return false;
      });
  }
}
