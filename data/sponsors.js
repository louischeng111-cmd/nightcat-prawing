/**
 * 夜貓釣蝦場 — 贊助牆檔期資料
 * Slot ids: green | logo | black | teal | side (左右牆共用 side 樣式，可分 side_l / side_r)
 * Exposes window.PrawnSponsors
 */
(function (global) {
  "use strict";

  const SLOTS = ["green", "logo", "black", "teal", "side", "side_l", "side_r"];

  /**
   * campaigns: active when startDate <= today <= endDate (inclusive, local YYYY-MM-DD)
   * placements[slotId] = creative
   */
  const CAMPAIGNS = [
    {
      id: "house_ads_2026",
      brandId: "nightcat_house",
      nameZh: "五幅廣告版內容 · Louis 2026-10-25 批准",
      startDate: "2026-10-25",
      endDate: "2027-10-25",
      ctaBlurb: "三個虛構佔位品牌＋兩個自家廣告；將來有真贊助商可直接換名換色",
      priority: 30,
      placements: {
        green: {
          bg: "#101828",
          accent: "#e8c15a",
          title: "今晚開池",
          subtitle: "夜貓釣蝦場",
          lines: ["深夜都有蝦釣 · 新手友善"],
          footer: "自家廣告",
        },
        black: {
          bg: "#2f4e6e",
          accent: "#ffffff",
          title: "一竿在手",
          subtitle: "極光釣具",
          lines: ["手竿 · 天平釣組專門店", "蝦到擒來"],
          footer: "佔位品牌",
        },
        teal: {
          bg: "#b23a12",
          accent: "#ffffff",
          title: "赤尾青",
          subtitle: "赤尾青工房",
          lines: ["蝦最愛 · 即開即用"],
          footer: "佔位品牌",
        },
        side_l: {
          bg: "#7a1f1f",
          accent: "#f5e6c8",
          title: "即釣即煮",
          subtitle: "夜貓食堂",
          lines: ["釣完蝦，過嚟食宵夜"],
          footer: "自家廣告",
        },
        side_r: {
          bg: "#8b0000",
          accent: "#ffc107",
          title: "釣蝦王爭霸",
          subtitle: "夜貓盃",
          lines: ["每月一戰 · 贏夜幣"],
          footer: "佔位活動",
        },
      },
    },
    {
      id: "demo_autumn_tackle_2026",
      brandId: "demo_tackle_hk",
      nameZh: "秋夜釣具週 · 示範檔",
      startDate: "2026-10-01",
      endDate: "2026-11-15",
      ctaBlurb: "示範贊助 · 非真實品牌授權",
      priority: 10,
      placements: {
        green: {
          bg: "#1a4d2e",
          accent: "#c8f0d4",
          title: "秋夜釣具週",
          lines: ["· 阿波／子線陳列", "· 入場送示範貼紙", "· 檔期至 11/15"],
          footer: "SPONSOR · DEMO",
        },
        logo: {
          bg: "#f7f4ee",
          accent: "#b71c1c",
          title: "夜貓 × 示範店",
          subtitle: "聯乘牆",
          footer: "廣告位 · 示範",
        },
        black: {
          bg: "#0e0e12",
          accent: "#ffc107",
          title: "PE 線週",
          footer: "SPONSOR PANEL",
        },
        teal: {
          bg: "#0a5555",
          accent: "#ffab40",
          title: "活蝦保鮮",
          subtitle: "品牌牆示範",
          footer: "可換海報",
        },
        side: {
          bg: "#1c2430",
          accent: "#6ec6ff",
          title: "側牆檔期",
          subtitle: "demo_tackle_hk",
          footer: "AD",
        },
      },
    },
    {
      id: "demo_beverage_night_2026",
      brandId: "demo_drink_co",
      nameZh: "夜場茶飲檔 · 示範",
      startDate: "2026-10-20",
      endDate: "2026-10-31",
      ctaBlurb: "只佔 logo＋teal；其餘回落預設或他檔",
      priority: 20,
      placements: {
        logo: {
          bg: "#fff8e7",
          accent: "#e65100",
          title: "熱飲加一",
          subtitle: "夜貓休息區",
          footer: "DEMO DRINK",
        },
        teal: {
          bg: "#004d40",
          accent: "#ffe082",
          title: "茶檔贊助",
          subtitle: "限時示範",
          footer: "10/20–10/31",
        },
      },
    },
  ];

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

  function inRange(day, start, end) {
    return day >= start && day <= end;
  }

  /** Active campaigns sorted by priority desc */
  function activeCampaigns(day) {
    const d = day || todayKey();
    return CAMPAIGNS.filter((c) => inRange(d, c.startDate, c.endDate)).sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );
  }

  /**
   * Resolve creative for a wall slot. Higher priority campaign wins per slot.
   * Maps side_l / side_r → placement.side if specific missing.
   */
  function creativeForSlot(slotId, day) {
    const list = activeCampaigns(day);
    const keys = [slotId];
    if (slotId === "side_l" || slotId === "side_r") keys.push("side");
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      for (let k = 0; k < keys.length; k++) {
        const cre = c.placements && c.placements[keys[k]];
        if (cre) {
          return {
            campaignId: c.id,
            brandId: c.brandId,
            nameZh: c.nameZh,
            ctaBlurb: c.ctaBlurb,
            slotId: keys[k],
            creative: cre,
          };
        }
      }
    }
    return null;
  }

  function slotMap(day) {
    const map = {};
    ["green", "logo", "black", "teal", "side", "side_l", "side_r"].forEach((s) => {
      map[s] = creativeForSlot(s, day);
    });
    return map;
  }

  global.PrawnSponsors = {
    SLOTS,
    CAMPAIGNS,
    todayKey,
    activeCampaigns,
    creativeForSlot,
    slotMap,
  };
})(typeof window !== "undefined" ? window : globalThis);
