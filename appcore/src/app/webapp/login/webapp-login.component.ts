import { Component, Inject } from "@angular/core";
import { Router } from "@angular/router";
import { WebappAuthService } from "../auth/webapp-auth.service";

@Component({
  selector: "app-webapp-login",
  template: `
    <div class="login-container" fxLayout="column" fxLayoutAlign="center center">
      <mat-card class="login-card">
        <mat-card-title>Elevate</mat-card-title>
        <mat-card-content>
          <form (ngSubmit)="onSubmit()">
            <mat-form-field appearance="fill" style="width: 100%">
              <mat-label>Username</mat-label>
              <input matInput name="username" [(ngModel)]="username" required autocomplete="username" />
            </mat-form-field>
            <mat-form-field appearance="fill" style="width: 100%">
              <mat-label>Password</mat-label>
              <input
                matInput
                type="password"
                name="password"
                [(ngModel)]="password"
                required
                autocomplete="current-password"
              />
            </mat-form-field>
            <div *ngIf="errorMessage" class="error-message mat-body-1">{{ errorMessage }}</div>
            <button mat-raised-button color="primary" type="submit" [disabled]="isSubmitting" style="width: 100%">
              Log in
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .login-container {
        height: 100vh;
      }
      .login-card {
        width: 320px;
        padding: 8px;
      }
      .error-message {
        color: #f44336;
        margin-bottom: 12px;
      }
    `
  ]
})
export class WebappLoginComponent {
  public username = "";
  public password = "";
  public isSubmitting = false;
  public errorMessage: string | null = null;

  constructor(
    @Inject(WebappAuthService) private readonly authService: WebappAuthService,
    @Inject(Router) private readonly router: Router
  ) {}

  public onSubmit(): void {
    this.errorMessage = null;
    this.isSubmitting = true;

    this.authService
      .login(this.username, this.password)
      .then(() => {
        this.router.navigate(["/activities"]);
      })
      .catch(() => {
        this.errorMessage = "Invalid username or password";
      })
      .finally(() => {
        this.isSubmitting = false;
      });
  }
}
