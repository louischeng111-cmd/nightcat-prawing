/**
 * 夜貓釣蝦場 — 技法／裝備對應表 v1
 * Depth bands, 阿波 size bands, tease rhythm, strike windows.
 * Multipliers are intentionally mild so tuning stays readable.
 * Exposes window.PrawnTechniques
 */
(function (global) {
  "use strict";

  // ——— Depth (水深) ———
  // Numbers: metres of water column above bait (tunable fiction).
  const DEPTHS = [
    {
      id: "shallow",
      name: "淺水 · 約 1 尺",
      desc: "近氣泡、活躍蝦多",
      metres: 0.35,
      biteMul: 1.08,
      falseBiteMul: 1.15,
    },
    {
      id: "mid",
      name: "中水 · 約 1.8 尺",
      desc: "萬用水深，訊號穩",
      metres: 0.55,
      biteMul: 1.0,
      falseBiteMul: 1.0,
    },
    {
      id: "deep",
      name: "深水 · 約 2.5 尺",
      desc: "大蝦／匿埋位",
      metres: 0.78,
      biteMul: 0.92,
      falseBiteMul: 0.85,
    },
  ];

  // Map existing float ids → 阿波體型帶（細／中／粗）
  const FLOAT_APO_BAND = {
    long: "fine", // 長標天線敏 → treat as 細
    apo: "mid",
    short: "bold", // 短標穩 → treat as 粗啲
  };

  // Tippet / 子線 feel (future gear slot). For now derived from float band.
  const TIPPET_BY_APO = {
    fine: { id: "soft", name: "軟子線感", escapeMul: 1.12, hookMul: 1.08 },
    mid: { id: "std", name: "標準子線感", escapeMul: 1.0, hookMul: 1.0 },
    bold: { id: "stiff", name: "硬子線感", escapeMul: 0.9, hookMul: 0.95 },
  };

  /**
   * Tease rhythm — how often / how hard 逗蝦 should help.
   * cadence: seconds between useful teases (soft gate in app).
   */
  const TEASE = {
    // base chance multiplier when player teases
    baseBoost: 0.35,
    // species aggression adds to boost: boost += aggression * aggressionScale
    aggressionScale: 0.25,
    // if last tease was too soon, dampen
    cooldownMs: 1800,
    cooldownPenalty: 0.55,
    // hide species need more teases
    hideScale: 0.15,
  };

  /**
   * Strike timing window (ms) multipliers — applied on top of rod.windowMul * float.signal.
   * Perfect zone = sink already started (floatBob.sink > sinkGood).
   */
  const STRIKE = {
    baseWindowMs: 900,
    // early strike on BITE_TEASE success chance base
    earlyBase: 0.22,
    // blind strike (no bite) base
    blindBase: 0.08,
    // sinkProgress threshold for "good" hook-set
    sinkGood: 0.04,
    // if good sink, always hook unless escape rolls later
    goodHookFloor: 0.55,
  };

  /**
   * Build match multipliers for a species + current pick.
   * pick: { bait, float, seat, depth, rod }
   * Returns { bite, hook, escape, fight, apoBand, tippet, score, notes }
   *
   * TUNING GUIDE (see CONTENT_V1.md):
   *   bite   → scheduleBite wait / tease success
   *   hook   → strike success on sink / early
   *   escape → fight soft-fail chance + tension chaos
   *   fight  → fightStrength scale (progress speed inverse-ish)
   */
  function match(species, pick) {
    if (!species || !pick) {
      return { bite: 1, hook: 1, escape: 1, fight: 1, apoBand: "mid", tippet: TIPPET_BY_APO.mid, score: 1, notes: [] };
    }
    const notes = [];
    const depthId = (pick.depth && pick.depth.id) || "mid";
    const baitId = (pick.bait && pick.bait.id) || "aka";
    const floatId = (pick.float && pick.float.id) || "apo";
    const apoBand = FLOAT_APO_BAND[floatId] || "mid";
    const tippet = TIPPET_BY_APO[apoBand];

    let bite = 1;
    let hook = 1;
    let escape = 1;
    let fight = 1;

    // Depth × species
    const dPref = (species.depthPref && species.depthPref[depthId]) || 1;
    bite *= dPref;
    if (dPref >= 1.15) notes.push("水深對路");
    if (dPref <= 0.8) notes.push("水深偏離");

    const depthRow = DEPTHS.find((d) => d.id === depthId);
    if (depthRow) {
      bite *= depthRow.biteMul;
    }

    // Bait × species
    const bPref = (species.baitPrefs && species.baitPrefs[baitId]) || 0.75;
    bite *= bPref;
    if (bPref >= 1.2) notes.push("餌對口");
    if (bPref <= 0.9) notes.push("餌一般");

    // 阿波 band × species
    const aPref = (species.apoPref && species.apoPref[apoBand]) || 1;
    bite *= Math.sqrt(aPref); // milder on bite rate
    hook *= aPref;
    if (aPref >= 1.15) notes.push("阿波合拍");
    if (aPref <= 0.85) notes.push("阿波偏粗／偏細");

    // Tippet feel
    hook *= tippet.hookMul;
    escape *= tippet.escapeMul;

    // Seat flavour (without rewriting seat table)
    const seatId = pick.seat && pick.seat.id;
    if (seatId === "A") {
      bite *= 0.95 + species.personality.aggression * 0.25;
    } else if (seatId === "B") {
      bite *= 0.85 + species.personality.hide * 0.35;
      escape *= 1.05;
    } else if (seatId === "C") {
      bite *= 1.0;
      hook *= 0.95; // noisier signals
    }

    // Night indoor venue — nightBias always applies mildly
    bite *= 0.9 + species.personality.nightBias * 0.2;

    // Species intrinsic
    escape *= 0.85 + species.escapeChance; // higher escapeChance → harder
    fight *= species.fightStrength || 1;

    // Clamp so one bad match doesn't zero the game
    bite = clamp(bite, 0.35, 2.2);
    hook = clamp(hook, 0.4, 1.8);
    escape = clamp(escape, 0.5, 1.8);
    fight = clamp(fight, 0.6, 2.0);

    const score = (bite + hook + 1 / escape + 1 / fight) / 4;

    return { bite, hook, escape, fight, apoBand, tippet, score, notes };
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  /**
   * Spawn weights for which species approaches, given pick.
   */
  function spawnWeights(speciesList, pick) {
    return speciesList.map((s) => {
      const m = match(s, pick);
      return Math.max(0.01, (s.spawnWeight || 0.1) * m.bite);
    });
  }

  global.PrawnTechniques = {
    DEPTHS,
    FLOAT_APO_BAND,
    TIPPET_BY_APO,
    TEASE,
    STRIKE,
    match,
    spawnWeights,
    clamp,
  };
})(typeof window !== "undefined" ? window : globalThis);
