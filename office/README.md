# 夜貓總部 · 虛擬辦公室

純靜態 **Three.js isometric agent office** 試玩頁：10 隻唔同品種嘅貓代表夜貓班 bot，喺木地板辦公室行工位／lounge／玻璃主管室；狀態循環（諗緊／開工／要你／完成／收工）同 HUD 一齊更新。

靈感：David’s Staff Virtual Office（等距工位、玻璃主管室、狀態板）＋海邊別墅粉彩狀態氛圍。  
**唔連接** 真·bot SSE；全部係前端模擬。

## 本機行

需要靜態伺服器（ES modules + CDN；唔好用 `file://`）：

```bash
cd nightcat-hq-office
python3 -m http.server 8765
# 或：npx --yes serve -p 8765
```

瀏覽器開：<http://127.0.0.1:8765>

> 本機驗證時若 `8765` 已被佔用，可改 `python3 -m http.server 8766`。


建議桌面 Chrome／Edge。拖曳旋轉、滾輪縮放。

## 檔案

```
nightcat-hq-office/
  index.html
  README.md
  css/styles.css
  js/
    main.js
    office.js      # 等距辦公室場景
    cats.js        # 低多邊形品種貓
    agents.js      # bot 名冊
    simulation.js  # 行路／狀態循環
    hud.js         # 繁中 HUD
```

## Bot ↔ 品種

| id | 名稱 | 品種 | 職責 |
|----|------|------|------|
| ha | 蝦主管 | 三花／玳瑁混 | 跨項目 |
| aim | AI manager | 英國短毛貓 | 總部統籌 |
| nemo | 投資主管 | 緬因貓 | NEMO 協調 |
| pre | Premarket Desk | 暹羅貓 | 盤前早報 |
| news | 即時資訊 | 阿比西尼亞 | 市況催化 |
| fund | 基本分析 | 俄羅斯藍貓 | 基本面 |
| ta | 技術分析 | 孟加拉貓 | 圖表 |
| entry | 入市建議 | 蘇格蘭摺耳 | 綜合建議 |
| prawn | 釣蝦高手 | 橘貓 | 產品線 |
| other | 異度空間 | 黑貓 | 預留 |

## GitHub Pages

將本目錄內容放上 repo root（或 `/docs`），Settings → Pages → Deploy from branch。CDN 用 jsDelivr 拉 Three.js，無需 build。

## 已知限制（v1）

- 狀態係**模擬循環**，唔係每個 bot 真即時對話。
- 貓係程序化低多邊形 chibi，唔係骨骼動畫套件。
- 行路係直線趨近目標，無完整 pathfinding／避障。
- 無音效；手機細屏會隱藏右側團隊板。
