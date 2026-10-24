/**
 * 夜貓釣蝦場 — 「哇」時刻調參（咬鉤／完美揚竿）
 * 強制演出 < 3s。Exposes window.PrawnWow
 */
(function (global) {
  "use strict";

  const CONFIG = {
    enabled: true,
    bite: {
      enabled: true,
      cameraPush: 0.28, // world units toward look target
      cameraMs: 420,
      shakeAmp: 3.5, // CSS px on #canvas-wrap
      shakeMs: 380,
      floatJolt: 0.07,
      hapticMs: 28,
      linePulse: true,
    },
    land: {
      enabled: true,
      slowMoMs: 520,
      slowMoScale: 0.35, // dt multiplier during slow-mo
      splashCount: 18,
      splashLife: 0.7,
      stampMs: 1400,
      hapticMs: 40,
    },
  };

  global.PrawnWow = { CONFIG };
})(typeof window !== "undefined" ? window : globalThis);
