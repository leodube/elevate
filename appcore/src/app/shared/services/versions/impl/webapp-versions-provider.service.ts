import { Inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { MatDialog } from "@angular/material/dialog";
import { VersionsProvider } from "../versions-provider";
import { GhRelease } from "@elevate/shared/models/updates/gh-release.model";
import { Platform } from "@elevate/shared/enums/platform.enum";

/**
 * Auto-update checking doesn't apply to a self-hosted web app the way it
 * does for desktop (installer updates) or the extension (store releases) -
 * there's nothing for the client to check or prompt about; deploying a new
 * version is a server-side concern (redeploy the container). Github release
 * checks are a no-op here rather than wired to anything.
 */
@Injectable()
export class WebappVersionsProvider extends VersionsProvider {
  constructor(
    @Inject(HttpClient) public readonly httpClient: HttpClient,
    @Inject(MatDialog) protected readonly dialog: MatDialog
  ) {
    super(httpClient, dialog);
  }

  public getGithubReleases(): Promise<GhRelease[]> {
    return Promise.resolve([]);
  }

  public getBuildMetadata(): Promise<{ commit: string; date: string }> {
    return Promise.resolve({ commit: "unknown", date: new Date().toISOString() });
  }

  public getPlatform(): Platform {
    // No dedicated webapp value exists on Platform - reusing WEB_EXT as the
    // closest fit rather than adding a new enum value for a single call site.
    return Platform.WEB_EXT;
  }

  public getWrapperVersion(): string {
    return navigator.userAgent;
  }
}
