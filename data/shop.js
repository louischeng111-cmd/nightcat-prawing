/**
 * 夜貓釣蝦場 — 月卡權益表 + 假幣商店（沙盒，無真實 IAP）
 * 原則：便利／身份／裝飾，唔賣咬鉤機率。
 * Exposes window.PrawnShop
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "nightcat_prawn_shop_v1";

  /** 月卡權益（對齊路線圖）— 免費 vs 夜貓月卡 */
  const PASS_ENTITLEMENTS = [
    {
      id: "sessions",
      nameZh: "每日場次",
      free: "基礎 8 場",
      pass: "＋4 場（合共 12）",
      effect: { dailySessionBonus: 4 },
    },
    {
      id: "priority_seat",
      nameZh: "留座／熱門時段",
      free: "普通排隊",
      pass: "優先留枱 15 分鐘（文案）",
      effect: { prioritySeatFluff: true },
    },
    {
      id: "contract_xp",
      nameZh: "合約進度",
      free: "正常",
      pass: "合約進度 ×1.5（假幣／完成獎）",
      effect: { contractRewardMul: 1.5 },
    },
    {
      id: "monthly_cosmetic",
      nameZh: "每月裝飾",
      free: "基礎外觀",
      pass: "本月邊框「夜貓銀線」",
      effect: { cosmeticId: "frame_silver" },
    },
    {
      id: "skip_interstitial",
      nameZh: "結算插屏",
      free: "可能有（之後）",
      pass: "可跳過結算插屏（場景牆贊助仍在）",
      effect: { skipInterstitial: true },
    },
  ];

  const PASS_PRODUCT = {
    id: "pass_nightcat_month",
    nameZh: "夜貓月卡",
    priceLabel: "沙盒 · 免費解鎖試用",
    durationDays: 30,
    blurb: "買便利同身份，唔買咬口。場景牆贊助會繼續顯示。",
  };

  /** Soft currency catalog — cosmetics / convenience, capped */
  const CATALOG = [
    {
      id: "coin_pack_demo",
      kind: "grant",
      nameZh: "新手夜幣包（示範）",
      desc: "一次過領 80 夜幣（每人一次）",
      cost: 0,
      once: true,
      grantCoins: 80,
    },
    {
      id: "frame_bamboo",
      kind: "cosmetic",
      nameZh: "蝦簍竹編邊框",
      desc: "結果卡邊框 · 純外觀",
      cost: 40,
      cosmeticId: "frame_bamboo",
    },
    {
      id: "scale_teal",
      kind: "cosmetic",
      nameZh: "電子秤殼 · 海藍色",
      desc: "HUD 蝦簍 pill 微調色 · 純外觀",
      cost: 55,
      cosmeticId: "scale_teal",
    },
    {
      id: "recast_token",
      kind: "consumable",
      nameZh: "重拋代幣 ×1",
      desc: "失敗後可即時回待命（每日最多買 3）",
      cost: 25,
      dailyBuyCap: 3,
      grantItem: "recast",
      amount: 1,
    },
    {
      id: "depth_note",
      kind: "consumable",
      nameZh: "水深筆記 ×1",
      desc: "入場 toast 提點對口水深（便利，唔加咬率）",
      cost: 15,
      dailyBuyCap: 5,
      grantItem: "depth_note",
      amount: 1,
    },
  ];

  const EARN = {
    catchBase: 3,
    catchRareBonus: 4,
    catchLegendBonus: 8,
    contractComplete: 12,
    dailyCap: 120,
  };

  function todayKey(d) {
    const x = d || new Date();
    return (
      x.getFullYear() +
      "-" +
      String(x.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(x.getDate()).padStart(2, "0")
    );
  }

  function defaultState() {
    return {
      coins: 20,
      earnedToday: 0,
      earnDay: todayKey(),
      owned: {}, // catalog id or cosmeticId -> true
      items: { recast: 0, depth_note: 0 },
      dailyBuys: {},
      buyDay: todayKey(),
      pass: { active: false, until: 0, activatedAt: 0 },
      equipped: { frame: null, scale: null },
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
      const s = Object.assign(defaultState(), JSON.parse(raw));
      const day = todayKey();
      if (s.earnDay !== day) {
        s.earnDay = day;
        s.earnedToday = 0;
      }
      if (s.buyDay !== day) {
        s.buyDay = day;
        s.dailyBuys = {};
      }
      if (!s.items) s.items = { recast: 0, depth_note: 0 };
      if (!s.equipped) s.equipped = { frame: null, scale: null };
      if (!s.pass) s.pass = { active: false, until: 0, activatedAt: 0 };
      // expire pass
      if (s.pass.active && s.pass.until && Date.now() > s.pass.until) {
        s.pass.active = false;
      }
      return s;
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function isPassActive(state) {
    if (!state || !state.pass) return false;
    if (!state.pass.active) return false;
    if (state.pass.until && Date.now() > state.pass.until) {
      state.pass.active = false;
      save(state);
      return false;
    }
    return true;
  }

  function passEffects(state) {
    const out = {
      dailySessionBonus: 0,
      prioritySeatFluff: false,
      contractRewardMul: 1,
      cosmeticId: null,
      skipInterstitial: false,
    };
    if (!isPassActive(state)) return out;
    PASS_ENTITLEMENTS.forEach((row) => {
      Object.assign(out, row.effect || {});
    });
    return out;
  }

  function activatePass(state) {
    const days = PASS_PRODUCT.durationDays || 30;
    state.pass = {
      active: true,
      activatedAt: Date.now(),
      until: Date.now() + days * 24 * 60 * 60 * 1000,
    };
    // grant monthly cosmetic
    state.owned.frame_silver = true;
    if (!state.equipped.frame) state.equipped.frame = "frame_silver";
    save(state);
    return state.pass;
  }

  function earnCoins(state, amount, reason) {
    if (!amount || amount <= 0) return { gained: 0, reason: reason || "" };
    const day = todayKey();
    if (state.earnDay !== day) {
      state.earnDay = day;
      state.earnedToday = 0;
    }
    const room = Math.max(0, EARN.dailyCap - (state.earnedToday || 0));
    const gained = Math.min(room, Math.floor(amount));
    if (gained <= 0) return { gained: 0, capped: true, reason: reason || "" };
    state.coins = (state.coins || 0) + gained;
    state.earnedToday = (state.earnedToday || 0) + gained;
    save(state);
    return { gained, reason: reason || "", capped: false };
  }

  function earnForCatch(state, catchInfo) {
    let n = EARN.catchBase;
    if (catchInfo && catchInfo.rarity === "rare") n += EARN.catchRareBonus;
    if (catchInfo && catchInfo.rarity === "legend") n += EARN.catchLegendBonus;
    const fx = passEffects(state);
    // pass does NOT multiply catch coins into P2W — only contract rewards
    return earnCoins(state, n, "入簍");
  }

  function earnForContract(state, countDone) {
    if (!countDone) return { gained: 0 };
    const fx = passEffects(state);
    const n = Math.round(EARN.contractComplete * (fx.contractRewardMul || 1) * countDone);
    return earnCoins(state, n, "合約");
  }

  function buyCountToday(state, itemId) {
    const day = todayKey();
    if (state.buyDay !== day) {
      state.buyDay = day;
      state.dailyBuys = {};
    }
    return (state.dailyBuys && state.dailyBuys[itemId]) || 0;
  }

  function purchase(state, itemId) {
    const item = CATALOG.find((x) => x.id === itemId);
    if (!item) return { ok: false, msg: "搵唔到商品" };
    if (item.once && state.owned[item.id]) return { ok: false, msg: "已經領過" };
    if (item.kind === "cosmetic" && state.owned[item.cosmeticId || item.id]) {
      return { ok: false, msg: "已經擁有" };
    }
    if (item.dailyBuyCap) {
      const n = buyCountToday(state, item.id);
      if (n >= item.dailyBuyCap) return { ok: false, msg: "今日買滿上限" };
    }
    const cost = item.cost || 0;
    if ((state.coins || 0) < cost) return { ok: false, msg: "夜幣唔夠" };

    state.coins -= cost;
    if (item.grantCoins) {
      state.coins += item.grantCoins;
      state.owned[item.id] = true;
    }
    if (item.kind === "cosmetic") {
      const cid = item.cosmeticId || item.id;
      state.owned[cid] = true;
      state.owned[item.id] = true;
      if (cid.indexOf("frame") === 0) state.equipped.frame = cid;
      if (cid.indexOf("scale") === 0) state.equipped.scale = cid;
    }
    if (item.grantItem) {
      state.items[item.grantItem] = (state.items[item.grantItem] || 0) + (item.amount || 1);
      state.dailyBuys[item.id] = buyCountToday(state, item.id) + 1;
    }
    if (item.once) state.owned[item.id] = true;
    save(state);
    return { ok: true, msg: "買咗：「" + item.nameZh + "」", item };
  }

  global.PrawnShop = {
    STORAGE_KEY,
    PASS_ENTITLEMENTS,
    PASS_PRODUCT,
    CATALOG,
    EARN,
    load,
    save,
    isPassActive,
    passEffects,
    activatePass,
    earnCoins,
    earnForCatch,
    earnForContract,
    purchase,
    todayKey,
  };
})(typeof window !== "undefined" ? window : globalThis);
