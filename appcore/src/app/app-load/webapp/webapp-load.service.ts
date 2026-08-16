import { Inject, Injectable } from "@angular/core";
import { AppLoadService } from "../app-load.service";
import { DataStore } from "../../shared/data-store/data-store";
import { sleep } from "@elevate/shared/tools/sleep";

@Injectable()
export class WebappLoadService extends AppLoadService {
  protected readonly SPLASH_SCREEN_MIN_TIME_DISPLAYED: number = 750;

  constructor(@Inject(DataStore) protected readonly dataStore: DataStore<object>) {
    super(dataStore);
  }

  public loadApp(): Promise<void> {
    // Same pattern as ExtensionLoadService: doesn't wait on
    // dataStore.dbEvent$ (LOADED) the way DesktopLoadService does. Not
    // needed here - the local WebappDataStore is a no-op in-memory store,
    // and the real data (activities) is fetched over HTTP by
    // WebappActivityService once the app is up, not loaded from a local DB.
    return sleep(this.SPLASH_SCREEN_MIN_TIME_DISPLAYED);
  }
}
