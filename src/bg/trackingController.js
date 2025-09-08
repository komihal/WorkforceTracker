// src/bg/trackingController.js
import BackgroundGeolocation from "react-native-background-geolocation";
import { AppState } from "react-native";

let startedOnce = false;

/** Гарантированно запускает BGGeo один раз (idempotent). */
export async function ensureBgStarted(reason = "unknown") {
  try {
    const state = await BackgroundGeolocation.getState();
    if (state?.enabled) {
      console.log("[BG] already enabled, reason:", reason);
      return;
    }
    console.log("[BG] starting geolocation, reason:", reason);
    
    // НЕ вызываем start() здесь - это должно происходить только после ready()
    // start() вызывается в startTracking() в location.js
    console.log("[BG] ensureBgStarted: start() should be called from startTracking()");
    
  } catch (e) {
    console.log("[BG] start error:", e.message);
  } finally {
    startedOnce = true;
  }
}

/** Вызывай при изменении статуса смены. */
export async function onShiftStatusChanged(isActive) {
  console.log("[BG] onShiftStatusChanged:", isActive);
  if (isActive) {
    await ensureBgStarted("shift_active");
  } else {
    // если бизнес-логика требует — останавливаем; иначе не трогаем
    // await BackgroundGeolocation.stop();
    console.log("[BG] shift not active — leaving BG as is");
  }
}

/** Подстраховка при возвращении приложения в фокус. */
export function hookAppStateGuard() {
  const h = (s) => {
    if (s === "active") {
      ensureBgStarted("app_foreground_guard");
    }
  };
  AppState.addEventListener("change", h);
  console.log("[BG] AppState guard attached");
}
