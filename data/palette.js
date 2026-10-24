/**
 * 夜貓釣蝦場 — AU splash palette (cover-au-daiwa-brush.jpg, 2026-10-24).
 * Single token source for CSS variables and Three.js materials.
 * Sampled from the locked cover: off-white wall, sea-blue water,
 * black title with orange brush edge, Daiwa red/black rod, orange claws.
 * Exposes window.NightcatPalette. Edit colors here; styles.css fallbacks mirror them.
 */
(function (global) {
  "use strict";

  function hex(n) {
    return "#" + n.toString(16).padStart(6, "0");
  }

  const T = {
    wall: 0xe8e2dc,
    wallDeep: 0xd9d3cc,
    ink: 0x161311,
    brush: 0xe06a22,
    brushDeep: 0xc44712,
    sea: 0x1f6aa8,
    seaBright: 0x2f86c0,
    seaDeep: 0x143656,
    seaSurface: 0x3a8ec4,
    seaHighlight: 0x4a9ad4,
    seaButton: 0x8eafd0,
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
    "--bg": hex(T.wall),
    "--bg-warm": hex(T.wallDeep),
    "--wall": hex(T.wall),
    "--wall-deep": hex(T.wallDeep),
    "--panel": hex(T.paper),
    "--panel-dark": hex(T.paper),
    "--paper": hex(T.paper),
    "--paper-shade": hex(T.paperShade),
    "--ink": hex(T.ink),
    "--text": hex(T.ink),
    "--text-on-dark": hex(T.ink),
    "--accent": hex(T.brush),
    "--accent-deep": hex(T.brushDeep),
    "--brush": hex(T.brush),
    "--brush-deep": hex(T.brushDeep),
    "--accent-blue": hex(T.sea),
    "--sea": hex(T.sea),
    "--sea-bright": hex(T.seaBright),
    "--sea-deep": hex(T.seaDeep),
    "--sea-surface": hex(T.seaSurface),
    "--sea-highlight": hex(T.seaHighlight),
    "--sea-button": hex(T.seaButton),
    "--rod-red": hex(T.rodRed),
    "--rod-black": hex(T.rodBlack),
    "--amber": hex(T.brush),
    "--amber-soft": hex(T.brush),
    "--muted": hex(T.muted),
    "--muted-on-dark": hex(T.muted),
    "--danger": hex(T.danger),
    "--ok": hex(T.ok),
    "--warn": hex(T.warn),
    "--border": "rgba(22, 19, 17, 0.12)",
    "--shadow": "0 10px 28px rgba(22, 19, 17, 0.1)",
  };

  const root = global.document && global.document.documentElement;
  if (root) {
    Object.keys(css).forEach((name) => root.style.setProperty(name, css[name]));
    const meta = global.document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", css["--wall"]);
  }

  T.hex = hex;
  T.css = css;
  global.NightcatPalette = T;
})(window);
