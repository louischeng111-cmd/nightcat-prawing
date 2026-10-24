# 內容表 v1（物種 · 技法 · 合約 · 圖鑑）

娛樂深度用資料層，**無課金／無 pay-to-win**。調數優先改 `data/*.js`，唔使動 Three.js 場景。

## 檔案

| 檔案 | 用途 |
|------|------|
| `data/species.js` | 6 種蝦：體重（兩）、咬口性格、嗜餌／水深／阿波偏好、脫鈎、搏力、圖鑑文案 |
| `data/techniques.js` | 水深三檔、阿波體型帶、逗蝦／開槍窗口、同物種嘅 match 乘數 |
| `data/progress.js` | 每日 3 張合約（日期 hash 抽）、圖鑑解鎖、localStorage |
| `app.js` | 咬鉤／開槍／搏蝦／入簍讀上面表；HUD 合約條＋圖鑑 |

存檔 key：`nightcat_prawn_progress_v1`（圖鑑跨日保留，合約每日刷新）。

## 物種（`PrawnSpecies.SPECIES`）

| id | 顯示名 | 稀有度 | 大概體重（兩） |
|----|--------|--------|----------------|
| `zhao_common` | 普通沼蝦 | 常見 | 0.4–1.1 |
| `zhao_green` | 青殼沼蝦 | 常見 | 0.5–1.3 |
| `zhao_redclaw` | 紅鉗沼蝦 | 少見 | 0.7–1.6 |
| `zhao_flower` | 花鉗沼蝦 | 少見 | 0.6–1.5 |
| `cray_au` | 澳龍 | 稀有 | 1.2–2.8 |
| `zhao_goldback` | 金背沼蝦 | 傳說 | 0.9–2.2 |

性格欄：`aggression`／`hide`／`nightBias`（0–1）。  
`baitPrefs`／`depthPref`／`apoPref` 係乘數；`spawnWeight` 控制出場底權重。

## 技法對應（`PrawnTechniques.match`）

入場揀 **水深**（淺／中／深）＋原有阿波／餌／池位。

- 阿波 id → 體型帶：`long`→細、`apo`→中、`short`→粗（見 `FLOAT_APO_BAND`）
- `match()` 回傳：`bite`（等咬／逗蝦）、`hook`（開槍成功率）、`escape`（搏蝦脫鈎）、`fight`（拉力）、`notes`（結果卡短評）

**調數建議**

1. 某種蝦太常見 → 降 `spawnWeight` 或收緊 `depthPref`／`baitPrefs`。
2. 細阿波合約太難 → 提高該種 `apoPref.fine`，或放寬 `STRIKE.earlyBase`／`goodHookFloor`。
3. 搏蝦太易／太難 → 改物種 `fightStrength`／`escapeChance`，或 `TEASE`／`STRIKE` 常數。
4. 水深整體就餌 → `DEPTHS[].biteMul`／`falseBiteMul`。

所有乘數有 clamp（約 0.35–2.2），避免一錯配就零咬口。

## 每日合約

`CONTRACT_POOL` 用當日字串 hash 抽 3 張，目標類型包括：

- `catch_count`／`total_liang`
- `species_apo`（例：細阿波＋沼蝦）
- `species_depth`／`species_bait`
- `tease_catch`（今鋪用過逗蝦再入簍）
- `rarity_min`（稀有／傳說）

完成合約可經 `data/shop.js` 獎夜幣（唔改咬率）。商店／月卡見 roadmap-p3。

## 圖鑑

首次入簍解鎖；記 `catchCount`、`bestLiang`。HUD「圖鑑 x/6」，蝦掣開面板。

## 點樣試

1. `python3 -m http.server 5173`（喺 `hk-prawing/`）
2. 開頁 → 揀長標（細阿波）＋對應水深／餌 → 入場
3. 拋竿釣魚；入簍後睇 toast／結果卡「圖鑑解鎖」「合約完成」
4. 📋／🦐 掣開合約同圖鑑；F12 → Application → Local Storage 可清 `nightcat_prawn_progress_v1` 重測

Hard refresh：而家用 `?v=pool-crop-marble`。
