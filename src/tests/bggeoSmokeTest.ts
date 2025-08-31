// @ts-nocheck
/* eslint-disable */
import BackgroundGeolocation from "react-native-background-geolocation";

export type SmokeResult = {
  ok: boolean;
  bundleId: string;
  enabled: boolean;
  gotLocation: boolean;
  httpOk: boolean | null;
  errors: string[];
  state?: any;
  locationSample?: any;
};

export async function runBgGeoSmokeTest(opts: {
  licenseKey: string;
  webhookUrl?: string;
  timeoutSec?: number;
}): Promise<SmokeResult> {
  const errors: string[] = [];
  const timeoutSec = opts.timeoutSec ?? 30;
  // Avoid requiring an extra native dependency just for bundle id.
  // Keep in sync with Android applicationId defined in android/app/build.gradle.
  const bundleId = "com.workforcetracker";
  let gotLocation = false;
  let httpOk: boolean | null = opts.webhookUrl ? false : null;

  try {
    await BackgroundGeolocation.stop();

    const onceLocation = new Promise<any>((resolve) => {
      const unsub = BackgroundGeolocation.onLocation((loc) => {
        gotLocation = true;
        try { unsub?.remove?.(); } catch {}
        resolve(loc);
      }, (e) => errors.push(`onLocation error: ${String(e)}`));
    });

    const onceHttp = opts.webhookUrl
      ? new Promise<boolean>((resolve) => {
          const unsub = BackgroundGeolocation.onHttp((res) => {
            if (typeof res?.status === "number") {
              httpOk = res.status >= 200 && res.status < 300;
            }
            try { unsub?.remove?.(); } catch {}
            resolve(!!httpOk);
          });
        })
      : Promise.resolve(true);

    const state = await BackgroundGeolocation.ready({
      licenseKey: opts.licenseKey,
      debug: true,
      logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 0,
      stopOnTerminate: false,
      startOnBoot: true,
      foregroundService: true,
      autoSync: !!opts.webhookUrl,
      url: opts.webhookUrl,
    } as any);

    if (!state.enabled) await BackgroundGeolocation.start();

    const locationSample = await BackgroundGeolocation.getCurrentPosition({
      timeout: timeoutSec * 1000,
      samples: 1,
      persist: true,
      desiredAccuracy: 10,
    }).catch((e) => {
      errors.push(`getCurrentPosition error: ${e?.message || e}`);
      return null;
    });

    const withTimeout = <T,>(p: Promise<T>, sec: number) =>
      Promise.race<T | "timeout">([
        p,
        new Promise<"timeout">((r) => setTimeout(() => r("timeout"), sec * 1000)),
      ]);

   await withTimeout(onceLocation, Math.min(8, timeoutSec));
   if (opts.webhookUrl) await withTimeout(onceHttp, Math.min(8, timeoutSec));

    try {
      const buffered = await BackgroundGeolocation.getLocations();
      if (!gotLocation && buffered && buffered.length > 0) gotLocation = true;
    } catch {}

    try {
      const log = await BackgroundGeolocation.getLog();
      if (/invalid|trial|license|denied|mismatch/i.test(log)) {
        errors.push("Логи содержат признаки проблем с лицензией/разрешениями.");
      }
    } catch {}

    const ok = gotLocation && (httpOk !== false);
    return { ok, bundleId, enabled: true, gotLocation, httpOk, errors, state, locationSample };
  } catch (e: any) {
    errors.push(e?.message || String(e));
    return { ok: false, bundleId, enabled: false, gotLocation: false, httpOk, errors };
  }
}


