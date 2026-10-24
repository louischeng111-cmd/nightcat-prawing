/**
 * 夜貓釣蝦場 — 每日合約 + 圖鑑 skeleton
 * Persists with localStorage. No pay hooks.
 * Exposes window.PrawnProgress
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "nightcat_prawn_progress_v1";

  /** Contract templates — goals reference species / technique. */
  const CONTRACT_POOL = [
    {
      id: "catch_3",
      title: "今日釣足 3 尾",
      desc: "唔限品種，入簍就算",
      goal: { type: "catch_count", n: 3 },
      rewardHint: "圖鑑進度 + 手感熱身",
    },
    {
      id: "catch_5",
      title: "今日釣足 5 尾",
      desc: "練節奏，連續入簍",
      goal: { type: "catch_count", n: 5 },
      rewardHint: "穩定輸出",
    },
    {
      id: "weight_4",
      title: "總重滿 4 兩",
      desc: "尾數唔緊要，要重量",
      goal: { type: "total_liang", n: 4 },
      rewardHint: "追大蝦",
    },
    {
      id: "weight_7",
      title: "總重滿 7 兩",
      desc: "老闆都要讚你",
      goal: { type: "total_liang", n: 7 },
      rewardHint: "重量挑戰",
    },
    {
      id: "fine_zhao",
      title: "細阿波釣中沼蝦",
      desc: "用長標（細阿波帶）釣中任何沼蝦",
      goal: { type: "species_apo", speciesPrefix: "zhao_", apoBand: "fine", n: 1 },
      rewardHint: "技法對路",
    },
    {
      id: "deep_flower",
      title: "深水搵花鉗",
      desc: "水深揀深水，釣中花鉗沼蝦",
      goal: { type: "species_depth", speciesId: "zhao_flower", depthId: "deep", n: 1 },
      rewardHint: "匿埋位專攻",
    },
    {
      id: "pork_redclaw",
      title: "醃肉餌收紅鉗",
      desc: "用醃肉餌釣中紅鉗沼蝦",
      goal: { type: "species_bait", speciesId: "zhao_redclaw", baitId: "pork", n: 1 },
      rewardHint: "對口餌",
    },
    {
      id: "mid_green",
      title: "中水青殼",
      desc: "中水深釣中青殼沼蝦",
      goal: { type: "species_depth", speciesId: "zhao_green", depthId: "mid", n: 1 },
      rewardHint: "穩陣打法",
    },
    {
      id: "tease_catch",
      title: "逗蝦有功",
      desc: "今鋪有用過「逗蝦」再入簍",
      goal: { type: "tease_catch", n: 1 },
      rewardHint: "催促就餌",
    },
    {
      id: "rare_any",
      title: "稀有入場",
      desc: "釣中稀有或以上級（澳龍／金背）",
      goal: { type: "rarity_min", rarities: ["rare", "legend"], n: 1 },
      rewardHint: "開圖鑑 ethereal",
    },
  ];

  function todayKey(d) {
    const x = d || new Date();
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, "0");
    const day = String(x.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pickDailyContracts(dateStr) {
    const h = hashStr(dateStr || todayKey());
    const pool = CONTRACT_POOL.slice();
    // deterministic shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = (h + i * 2654435761) % (i + 1);
      const t = pool[i];
      pool[i] = pool[j];
      pool[j] = t;
    }
    // always include one easy catch_count if missing
    const picked = pool.slice(0, 3);
    if (!picked.some((c) => c.goal.type === "catch_count")) {
      picked[2] = CONTRACT_POOL[0];
    }
    return picked.map((c) => ({
      id: c.id,
      title: c.title,
      desc: c.desc,
      goal: Object.assign({}, c.goal),
      rewardHint: c.rewardHint,
      progress: 0,
      done: false,
    }));
  }

  function defaultState() {
    const day = todayKey();
    return {
      day,
      dex: {}, // speciesId -> { unlockedAt, catchCount, bestLiang }
      contracts: pickDailyContracts(day),
      sessionFlags: {},
    };
  }

  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return defaultState();
    }
    if (!raw) return defaultState();
    try {
      const data = JSON.parse(raw);
      const day = todayKey();
      if (!data || data.day !== day) {
        // new day — keep dex, refresh contracts
        const next = defaultState();
        next.dex = (data && data.dex) || {};
        save(next);
        return next;
      }
      if (!Array.isArray(data.contracts) || !data.contracts.length) {
        data.contracts = pickDailyContracts(day);
      }
      data.sessionFlags = data.sessionFlags || {};
      return data;
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* quota / private mode */
    }
  }

  function dexStats(state, speciesList) {
    const total = (speciesList && speciesList.length) || 0;
    let unlocked = 0;
    if (state && state.dex) {
      unlocked = Object.keys(state.dex).filter((k) => state.dex[k] && state.dex[k].unlockedAt).length;
    }
    return { unlocked, total };
  }

  /**
   * Record a successful catch.
   * catchInfo: {
   *   speciesId, nameZh, rarity, liang,
   *   apoBand, depthId, baitId,
   *   usedTease: boolean
   * }
   * Returns { newlyUnlocked, contractUpdates: [{id,title,done,progress,target}], feedback: string[] }
   */
  function recordCatch(state, catchInfo) {
    const feedback = [];
    const contractUpdates = [];
    let newlyUnlocked = false;

    if (!state.dex) state.dex = {};
    const sid = catchInfo.speciesId;
    if (sid) {
      const prev = state.dex[sid];
      if (!prev || !prev.unlockedAt) {
        newlyUnlocked = true;
        state.dex[sid] = {
          unlockedAt: Date.now(),
          catchCount: 1,
          bestLiang: catchInfo.liang || 0,
        };
        feedback.push("圖鑑解鎖：「" + (catchInfo.nameZh || sid) + "」");
      } else {
        prev.catchCount = (prev.catchCount || 0) + 1;
        if ((catchInfo.liang || 0) > (prev.bestLiang || 0)) prev.bestLiang = catchInfo.liang;
      }
    }

    const contracts = state.contracts || [];
    for (let i = 0; i < contracts.length; i++) {
      const c = contracts[i];
      if (c.done) continue;
      const before = c.progress || 0;
      const target = goalTarget(c.goal);
      let add = 0;
      if (goalMatches(c.goal, catchInfo)) {
        if (c.goal.type === "total_liang") {
          add = catchInfo.liang || 0;
        } else {
          add = 1;
        }
      }
      if (add > 0) {
        c.progress = before + add;
        if (c.progress >= target) {
          c.progress = target;
          c.done = true;
          feedback.push("合約完成：「" + c.title + "」");
        }
        contractUpdates.push({
          id: c.id,
          title: c.title,
          done: c.done,
          progress: c.progress,
          target,
        });
      }
    }

    save(state);
    return { newlyUnlocked, contractUpdates, feedback };
  }

  function goalTarget(goal) {
    if (!goal) return 1;
    if (goal.type === "total_liang") return goal.n || 1;
    return goal.n || 1;
  }

  function goalMatches(goal, info) {
    if (!goal || !info) return false;
    switch (goal.type) {
      case "catch_count":
        return true;
      case "total_liang":
        return true;
      case "species_apo": {
        const okSpecies = goal.speciesPrefix
          ? String(info.speciesId || "").indexOf(goal.speciesPrefix) === 0
          : info.speciesId === goal.speciesId;
        return okSpecies && info.apoBand === goal.apoBand;
      }
      case "species_depth":
        return info.speciesId === goal.speciesId && info.depthId === goal.depthId;
      case "species_bait":
        return info.speciesId === goal.speciesId && info.baitId === goal.baitId;
      case "tease_catch":
        return !!info.usedTease;
      case "rarity_min":
        return (goal.rarities || []).indexOf(info.rarity) >= 0;
      default:
        return false;
    }
  }

  function formatContractLine(c) {
    const target = goalTarget(c.goal);
    const prog = Math.min(target, c.progress || 0);
    const mark = c.done ? "✓" : "·";
    let progLabel;
    if (c.goal.type === "total_liang") {
      progLabel = prog.toFixed(1) + "/" + target + " 兩";
    } else {
      progLabel = Math.floor(prog) + "/" + target;
    }
    return mark + " " + c.title + "（" + progLabel + "）";
  }

  global.PrawnProgress = {
    STORAGE_KEY,
    CONTRACT_POOL,
    todayKey,
    load,
    save,
    dexStats,
    recordCatch,
    goalTarget,
    formatContractLine,
    pickDailyContracts,
  };
})(typeof window !== "undefined" ? window : globalThis);
