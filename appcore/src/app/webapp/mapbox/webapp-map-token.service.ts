import { Injectable } from "@angular/core";
import _ from "lodash";

/**
 * Desktop's MapTokenService calls Elevate's own cloud service via a
 * device-authentication scheme (MachineAuthenticatedService/MachineService)
 * that has no browser equivalent - there's no single "device" to
 * authenticate for a web app. Rather than build that, this uses the same
 * public fallback Mapbox tokens desktop already embeds as its own
 * resilience measure for when its primary token fetch fails - so this is
 * reusing existing, already-public tokens, not introducing a new one.
 */
@Injectable()
export class WebappMapTokenService {
  private static readonly FALLBACK_TOKENS: string[] = [
    "cGsuZXlKMUlqb2laV3hsZG1GMFpTMXpjRzl5ZEhNdFlYQndMV1ppTFRBeElpd2lZU0k2SW1OcmVEUmxjRGhrWmpGMWJHTXllRzlpYURsaE5tWnRaVzRpZlEubU1udUstUXF5RGxGSkZvYUtvRTBiQQ==",
    "cGsuZXlKMUlqb2laV3hsZG1GMFpTMXpjRzl5ZEhNdFlYQndMV1ppTFRBeUlpd2lZU0k2SW1OcmVEUmxjalpyY0RBeE0zb3lkbkJrYm1jd05HWXlhellpZlEuT0pFMG1pbUQ1REl1M0RRRnBnbGJNUQ==",
    "cGsuZXlKMUlqb2laV3hsZG1GMFpTMXpjRzl5ZEhNdFlYQndMV1ppTFRBeklpd2lZU0k2SW1OcmVEUmxlVFIzZVRBMGNURXlkbTU2TjNwMk5tcG1ZV2NpZlEuN0tSQlVKX1l4aHliQ2xUX3V2em15UQ==",
    "cGsuZXlKMUlqb2laV3hsZG1GMFpTMXpjRzl5ZEhNdFlYQndMV1ppTFRBMElpd2lZU0k2SW1OcmVEUm1aSEI1TnpGMWN6VXllRzlpWTJwc2JqaDBPVE1pZlEuZGc2YkZNQ1ZjVXhranhFNDY2T0lodw=="
  ];

  public get(): Promise<string> {
    const index = _.random(0, WebappMapTokenService.FALLBACK_TOKENS.length - 1);
    return Promise.resolve(atob(WebappMapTokenService.FALLBACK_TOKENS[index]));
  }
}
