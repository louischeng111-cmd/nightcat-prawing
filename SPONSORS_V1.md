# 贊助牆檔期格式 v1

給銷售／營運填檔用。程式讀 `data/sponsors.js`（`window.PrawnSponsors`）。

## Slot ids（對應場景牆）

| slot | 位置 |
|------|------|
| `green` | 遠牆左綠板 |
| `logo` | 遠牆中 Logo 位 |
| `black` | 遠牆右黑圓標位 |
| `teal` | 遠牆最右青板 |
| `side` | 左右側牆預設（`side_l`／`side_r` 可覆寫） |

## Campaign 欄位

```js
{
  id: "demo_autumn_tackle_2026",
  brandId: "demo_tackle_hk",
  nameZh: "秋夜釣具週 · 示範檔",
  startDate: "2026-10-01",   // 含當日
  endDate: "2026-11-15",     // 含當日
  ctaBlurb: "示範贊助 · 非真實品牌授權",
  priority: 10,              // 同 slot 撞檔時大者勝
  placements: {
    green: { bg, accent, title, lines?, subtitle?, footer? },
    // …只填要佔嘅 slot
  }
}
```

顏色用 hex；暫無貼圖 URL 時用 canvas 色塊＋粵語字。之後可加 `textureUrl`（同 domain 或 CORS）。

## 生效規則

1. `today`（本地 `YYYY-MM-DD`）喺 `[startDate, endDate]`。
2. 同一 slot 多檔 → `priority` 高者。
3. 無 active creative → 回落內建「廣告位」placeholder。

## 示範檔

- `demo_autumn_tackle_2026`：佔齊主要 slot（2026-10-01～11-15）
- `demo_beverage_night_2026`：只佔 logo＋teal（2026-10-20～10-31），priority 較高可蓋秋夜檔

試玩時（2026-10-24）兩邊都會部分生效；遠牆會睇到示範贊助字。

## 合規

真實品牌 Logo／文案要授權先上；示範檔標明 DEMO。場景牆贊助同月卡「關插屏」無關——牆永遠可賣。
