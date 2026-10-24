/**
 * 夜貓釣蝦場 — 物種表 v1
 * Tunable numbers; weights in 兩 (HK ≈ 37.5 g).
 * Exposes window.PrawnSpecies
 */
(function (global) {
  "use strict";

  /** @typedef {"common"|"uncommon"|"rare"|"legend"} Rarity */

  /**
   * personality:
   *   aggression 0–1  — bite / fight pull
   *   hide 0–1        — prefers corners / deep
   *   nightBias 0–1   — indoor night venue affinity
   * baitPrefs keys match BAITS ids in app.js (aka / pork / powder)
   * depthPref keys match DEPTHS ids (shallow / mid / deep)
   * apoPref keys: fine / mid / bold (阿波體型帶)
   */
  const SPECIES = [
    {
      id: "zhao_common",
      nameZh: "普通沼蝦",
      rarity: "common",
      weightLiang: [0.4, 1.1],
      spawnWeight: 1.0,
      personality: { aggression: 0.45, hide: 0.35, nightBias: 0.55 },
      baitPrefs: { aka: 1.2, pork: 0.95, powder: 1.05 },
      depthPref: { shallow: 1.05, mid: 1.15, deep: 0.85 },
      apoPref: { fine: 1.1, mid: 1.05, bold: 0.9 },
      escapeChance: 0.12,
      fightStrength: 0.85,
      blurb: "場內最常見嘅沼蝦。胃口唔錯，適合練逗蝦同睇滅頂。",
    },
    {
      id: "zhao_green",
      nameZh: "青殼沼蝦",
      rarity: "common",
      weightLiang: [0.5, 1.3],
      spawnWeight: 0.85,
      personality: { aggression: 0.4, hide: 0.5, nightBias: 0.6 },
      baitPrefs: { aka: 1.15, pork: 0.9, powder: 1.2 },
      depthPref: { shallow: 0.9, mid: 1.2, deep: 1.0 },
      apoPref: { fine: 1.15, mid: 1.0, bold: 0.85 },
      escapeChance: 0.14,
      fightStrength: 0.9,
      blurb: "殼色偏青，愛中水層。蝦粉軟餌耐泡，等得耐啲反而易中。",
    },
    {
      id: "zhao_redclaw",
      nameZh: "紅鉗沼蝦",
      rarity: "uncommon",
      weightLiang: [0.7, 1.6],
      spawnWeight: 0.55,
      personality: { aggression: 0.7, hide: 0.3, nightBias: 0.5 },
      baitPrefs: { aka: 1.05, pork: 1.25, powder: 0.85 },
      depthPref: { shallow: 1.15, mid: 1.0, deep: 0.75 },
      apoPref: { fine: 0.9, mid: 1.1, bold: 1.05 },
      escapeChance: 0.18,
      fightStrength: 1.15,
      blurb: "鉗頭帶紅，咬口兇。醃肉餌同淺水較易遇上；搏蝦時張力會突然扯。",
    },
    {
      id: "zhao_flower",
      nameZh: "花鉗沼蝦",
      rarity: "uncommon",
      weightLiang: [0.6, 1.5],
      spawnWeight: 0.45,
      personality: { aggression: 0.35, hide: 0.75, nightBias: 0.7 },
      baitPrefs: { aka: 1.0, pork: 1.05, powder: 1.15 },
      depthPref: { shallow: 0.7, mid: 1.05, deep: 1.25 },
      apoPref: { fine: 1.2, mid: 1.0, bold: 0.8 },
      escapeChance: 0.22,
      fightStrength: 1.05,
      blurb: "池角深水愛匿埋。細阿波睇訊號清楚啲，假訊多要忍手。",
    },
    {
      id: "cray_au",
      nameZh: "澳龍",
      rarity: "rare",
      weightLiang: [1.2, 2.8],
      spawnWeight: 0.18,
      personality: { aggression: 0.55, hide: 0.65, nightBias: 0.45 },
      baitPrefs: { aka: 0.85, pork: 1.35, powder: 0.9 },
      depthPref: { shallow: 0.6, mid: 1.0, deep: 1.3 },
      apoPref: { fine: 0.75, mid: 1.05, bold: 1.2 },
      escapeChance: 0.2,
      fightStrength: 1.45,
      blurb: "淡水龍蝦體型，重手。粗啲阿波同醃肉；搏嘅時候唔好硬拉。",
    },
    {
      id: "zhao_goldback",
      nameZh: "金背沼蝦",
      rarity: "legend",
      weightLiang: [0.9, 2.2],
      spawnWeight: 0.08,
      personality: { aggression: 0.6, hide: 0.8, nightBias: 0.9 },
      baitPrefs: { aka: 1.1, pork: 1.1, powder: 1.25 },
      depthPref: { shallow: 0.75, mid: 1.1, deep: 1.2 },
      apoPref: { fine: 1.25, mid: 1.0, bold: 0.7 },
      escapeChance: 0.28,
      fightStrength: 1.35,
      blurb: "夜場傳說種。細阿波＋蝦粉、深水位，機率仍然好低——中到就開圖鑑。",
    },
  ];

  const RARITY_ZH = {
    common: "常見",
    uncommon: "少見",
    rare: "稀有",
    legend: "傳說",
  };

  function getById(id) {
    return SPECIES.find((s) => s.id === id) || null;
  }

  function liangToGrams(liang) {
    return liang * 37.5;
  }

  /**
   * Weighted pick. weights[i] aligns with items[i].
   */
  function pickWeighted(items, weights) {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += Math.max(0, weights[i] || 0);
    if (sum <= 0) return items[0];
    let r = Math.random() * sum;
    for (let i = 0; i < items.length; i++) {
      r -= Math.max(0, weights[i] || 0);
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  global.PrawnSpecies = {
    SPECIES,
    RARITY_ZH,
    getById,
    liangToGrams,
    pickWeighted,
  };
})(typeof window !== "undefined" ? window : globalThis);
