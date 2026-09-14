import { MediaObserver } from "@angular/flex-layout";
import { Inject, Injectable } from "@angular/core";
import { WindowService } from "../window/window.service";

@Injectable({ providedIn: "root" })
export class WebappWindowService extends WindowService {
  constructor(@Inject(MediaObserver) public mediaObserver: MediaObserver) {
    super(mediaObserver);
  }
}
