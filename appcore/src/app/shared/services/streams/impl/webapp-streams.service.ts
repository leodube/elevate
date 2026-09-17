import { HttpClient } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { Streams } from "@elevate/shared/models/activity-data/streams.model";
import { DeflatedActivityStreams } from "@elevate/shared/models/sync/deflated-activity.streams";
import {
  ProcessStreamMode,
  StreamProcessor,
  StreamProcessorParams
} from "@elevate/shared/sync/compute/stream-processor";
import { StreamsDao } from "../../../dao/streams/streams.dao";
import { StreamsService } from "../streams.service";
import { environment } from "../../../../../environments/environment";

/**
 * StreamsService is a concrete class (not behind a target-swappable
 * abstract pattern like ActivityService), but Angular DI lets any
 * injectable be overridden via a provider regardless - same technique,
 * just no abstract class needed. Only getById()/getInflatedById()/
 * getProcessedById() are overridden, matching what the reused Time in
 * Zones tab and activity view actually call.
 *
 * put()/removeById()/removeByManyIds()/clear() are NOT overridden - not
 * exercised by activity viewing (only by editing/deleting flows, out of
 * phase 1 scope), so they fall through to the empty local WebappDataStore
 * via the inherited streamsDao.
 */
@Injectable()
export class WebappStreamsService extends StreamsService {
  constructor(
    streamsDao: StreamsDao,
    @Inject(HttpClient) private readonly httpClient: HttpClient
  ) {
    super(streamsDao);
  }

  public getById(id: number | string): Promise<DeflatedActivityStreams> {
    const url = `${environment.backendBaseUrl}/api/activities/${id}/streams`;
    return firstValueFrom(this.httpClient.get<{ deflated: string }>(url, { withCredentials: true })).then(
      response => new DeflatedActivityStreams(String(id), response.deflated)
    );
  }

  public getInflatedById(id: number | string): Promise<Streams> {
    return this.getById(id).then(deflated => (deflated ? Streams.inflate(deflated.deflatedStreams) : null));
  }

  public getProcessedById(
    processMode: ProcessStreamMode,
    id: number | string,
    params: StreamProcessorParams
  ): Promise<Streams> {
    return this.getInflatedById(id).then(streams =>
      streams ? StreamProcessor.handle(processMode, params, streams) : null
    );
  }
}
