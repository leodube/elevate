import { Inject, Injectable } from "@angular/core";
import { DataStore } from "../data-store";
import { LoggerService } from "../../services/logging/logger.service";
import { AppUsageDetails } from "../../models/app-usage-details.model";
import { AppUsage } from "../../models/app-usage.model";

/**
 * No-op persistence adapter: "loads" an empty database instantly and never
 * actually saves anything. This is deliberate - the webapp target's real
 * data lives in webapp/server's Postgres, accessed over HTTP by
 * WebappActivityService/WebappSyncService, which override their base
 * classes' DAO-backed methods directly rather than going through LokiJS.
 *
 * This DataStore only exists so that any BaseDao-derived class the webapp
 * target does NOT override (and therefore still gets constructed via
 * Angular DI) has something to inject without crashing. Anything that
 * falls through to this local, always-empty store will silently behave as
 * if there's no data - see WebappActivityService's class comment for
 * exactly which methods that applies to.
 */
class WebappNoopPersistenceAdapter implements LokiPersistenceAdapter {
  public loadDatabase(dbname: string, callback: (data: any) => void): void {
    callback(null); // null => Loki initializes a fresh empty database
  }

  public saveDatabase(dbname: string, dbString: string | Uint8Array, callback: (err?: Error | null) => void): void {
    callback();
  }

  public deleteDatabase(dbname: string, callback: (err?: Error | null) => void): void {
    callback();
  }
}

@Injectable()
export class WebappDataStore<T extends {}> extends DataStore<T> {
  constructor(@Inject(LoggerService) protected readonly logger: LoggerService) {
    super(logger);
  }

  public getPersistenceAdapter(): LokiPersistenceAdapter {
    return new WebappNoopPersistenceAdapter();
  }

  public getAppUsageDetails(): Promise<AppUsageDetails> {
    // Not meaningful for the webapp target - storage usage is a Postgres
    // concern on the server side, not a browser storage quota concern.
    const appUsage = new AppUsage(0, 0);
    return Promise.resolve(new AppUsageDetails(appUsage, 0, 0, 0));
  }
}
