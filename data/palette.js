/**
 * 夜貓釣蝦場 — shared tokens.
 * In-pool / HUD follows Louis's Space 6 reference (2026-10-24):
 * dark charcoal chrome, mint walls, teal pool, orange strike.
 * Setup card + splash letterbox stay on the AU cover tones.
 * Exposes window.NightcatPalette. styles.css :root mirrors the CSS names.
 */
(function (global) {
  "use strict";

  function hex(n) {
    return "#" + n.toString(16).padStart(6, "0");
  }

  const T = {
    // In-pool hall (Three.js). Not the cream AU setup backdrop.
    wall: 0x8fd4b4,
    wallDeep: 0x5eae90,
    sea: 0x0e8c90,
    seaBright: 0x14a3a0,
    seaDeep: 0x0a5960,
    seaSurface: 0x12b0aa,
    seaHighlight: 0x1ec4bc,
    rim: 0xc5c9cf,
    sign: 0x6e2430,
    signGold: 0xe4c36a,
    // HUD chrome
    chrome: 0x101614,
    card: 0x14211c,
    line: 0x2f9a78,
    orange: 0xf26512,
    orangeHot: 0xff8a2a,
    gold: 0xe6c15a,
    // AU setup / splash (do not drive the pool)
    setupWall: 0xe8e2dc,
    setupWallDeep: 0xd9d3cc,
    ink: 0x161311,
    brush: 0xe06a22,
    brushDeep: 0xc44712,
    seaButton: 0x8eafd0,
    splashDeep: 0x143656,
    rodRed: 0xc51628,
    rodBlack: 0x1a1c20,
    paper: 0xf7f4ef,
    paperShade: 0xefeae3,
    muted: 0x6e6860,
    ok: 0x1b7a45,
    danger: 0xb42318,
    warn: 0xa56b12,
    claw: 0xe25a1c,
    prawn: 0x8d5a34,
    prawnDark: 0x6a3e24,
    prawnShell: 0xc4895a,
  };

  const css = {
    "--bg": hex(T.chrome),
    "--bg-warm": hex(T.chrome),
    "--chrome": hex(T.chrome),
    "--card": hex(T.card),
    "--line": hex(T.line),
    "--orange": hex(T.orange),
    "--orange-hot": hex(T.orangeHot),
    "--gold": hex(T.gold),
    "--hud-text": "#f4faf6",
    "--sage": hex(T.wall),
    "--wall": hex(T.setupWall),
    "--wall-deep": hex(T.setupWallDeep),
    "--panel": hex(T.paper),
    "--panel-dark": hex(T.card),
    "--paper": hex(T.paper),
    "--paper-shade": hex(T.paperShade),
    "--ink": hex(T.ink),
    "--text": hex(T.ink),
    "--text-on-dark": "#f4faf6",
    "--accent": hex(T.orange),
    "--accent-deep": hex(T.orange),
    "--brush": hex(T.brush),
    "--brush-deep": hex(T.brushDeep),
    "--accent-blue": hex(T.sea),
    "--sea": hex(T.sea),
    "--sea-bright": hex(T.seaBright),
    "--sea-deep": hex(T.splashDeep),
    "--sea-surface": hex(T.seaSurface),
    "--sea-highlight": hex(T.seaHighlight),
    "--sea-button": hex(T.seaButton),
    "--rod-red": hex(T.rodRed),
    "--rod-black": hex(T.rodBlack),
    "--amber": hex(T.gold),
    "--amber-soft": hex(T.gold),
    "--muted": hex(T.muted),
    "--muted-on-dark": "#b7c4bc",
    "--danger": hex(T.danger),
    "--ok": hex(T.ok),
    "--warn": hex(T.warn),
    "--border": "rgba(47, 154, 120, 0.45)",
    "--shadow": "0 10px 28px rgba(0, 0, 0, 0.35)",
  };

  const root = global.document && global.document.documentElement;
  if (root) {
    Object.keys(css).forEach((name) => root.style.setProperty(name, css[name]));
    const meta = global.document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", css["--chrome"]);
  }

  T.hex = hex;
  T.css = css;
  global.NightcatPalette = T;
})(window);
