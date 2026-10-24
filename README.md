# 夜貓釣蝦場（香港釣蝦模擬 · MVP）

瀏覽器入面嘅**香港室內釣蝦場**娛樂模擬器：揀竿／標／餌／池位 → 拋竿 → 睇浮標滅頂開槍 → 搏蝦 → 入蝦簍。

純前端靜態站，適合 GitHub Pages。**娛樂模擬，唔係真實投注**，同任何釣蝦場或彩票無關。

靈感類型參考公開嘅 3D 釣蝦模擬玩法，但程式碼為原創實作，並非複製其他專案原始碼。

## 視覺方向（v1 寫實）

環境參考香港室內釣蝦場（尤其蝦立方場地相），但**品牌名維持「夜貓釣蝦場」**：

- 大型長方室內池、闊雲石／木紋枱面、枱底淡藍 LED
- 深藍牆洗光、暗工業天花、熒光管＋射燈照水面
- 池水為 **海藍色**（非綠 teal）：半透明體積 + 表面漣漪 + 打氣泡


## 點樣本機行

需要一個簡單靜態伺服器（直接用 `file://` 開有時會被瀏覽器限制 CDN／模組）：

```bash
cd hk-prawing
# 任揀一種：
npx --yes serve -p 5173
# 或
python3 -m http.server 5173
```

之後用瀏覽器開：<http://localhost:5173>

建議用桌面 Chrome；手機闊度都讀到，但第一版以桌面為主。

## 點樣之後放上 GitHub Pages

1. 開新 repo（例如 `hk-prawing`），將本目錄檔案 push 上去。
2. Repo **Settings → Pages**：Source 選 `Deploy from a branch`，branch `main`，folder `/ (root)`。
3. 幾分鐘後會有 `https://<你嘅帳號>.github.io/hk-prawing/`。

（本 repo 唔會代你登入 GitHub 或 push。）

## 操作摘要

| 操作 | 說明 |
|------|------|
| 拋竿 | 餌落水，進入等待 |
| 逗蝦 | 輕提催促就餌 |
| 開槍 / 空白鍵 | 滅頂瞬間刺蝦；搏蝦時**按住**拉緊、**鬆開**放線 |
| 📢 | 「老闆冇蝦啊」——短暫提升活躍度 |
| 📖 / 🧺 | 說明／蝦簍 |

## 檔案

| 檔案 | 用途 |
|------|------|
| `index.html` | 頁面結構、UI |
| `styles.css` | 倉庫紙感 UI（色票見 `data/palette.js`） |
| `data/palette.js` | AU 封面共用色票（CSS + Three.js） |
| `app.js` | Three.js 場景 + 玩法狀態機 |
| `README.md` | 本說明 |
| `CONTENT_V1.md` | 物種／技法／合約調數說明 |
| `SPONSORS_V1.md` | 贊助牆檔期格式 |
| `PLAY.md` | 本機試玩 |
| `data/*.js` | 物種、技法、進度、商店、贊助、wow |

依賴：CDN 上嘅 [Three.js r160](https://threejs.org/)（有 SRI）。

## 第一版有咩／未做

**已有**

- 裝備／水深／池位選擇（影響就餌率、窗口、體型）
- 物種表＋技法對應、每日合約、圖鑑（localStorage）
- 咬鉤／揚竿「哇」時刻、月卡／夜幣商店（沙盒）、贊助牆檔期
- 3D 室內池（程序幾何、光猛倉庫、海藍色池水）
- 拋竿 → 浮標晃動 → 試探 → 滅頂 → 開槍
- 張力搏蝦（太緊斷線／太鬆走蝦）
- 蝦簍統計（尾數、兩）
- 老闆倒蝦 buff、操作說明、聲效掣（暫未有音檔）

**之後再加（未做）**

- 真正音效／震動
- 烤蝦小遊戲、彩蛋抓蝦
- 更精細浮標訊號、多池種
- 存檔、排行榜、PWA

## 已知限制

- 聲效掣只係 stub（未播聲音）。
- 3D 為簡化幾何，唔係寫實掃描模型。
- 需網絡載入 Google Fonts 同 Three.js CDN（可之後改自架）。

## Visual notes (2026-10-24)
- Splash + setup card stay on the AU cover (off-white, sea-blue pill, orange brush).
- In-pool HUD follows the Space 6 reference: dark charcoal chrome, stat cards with a thin green outline, a full-width orange「開槍」button, and an orange result line above it.
- The hall is mint/sage walls, teal pool water, grey tile rim, plus the sponsor ad row and a maroon/gold「夜貓釣蝦場」sign.
- Shared tokens live in `data/palette.js`.

Hard refresh after pull: Ctrl+Shift+R so `index.html` loads `app.js?v=camera-closer` and `styles.css?v=camera-closer`.

## 本機試玩

見 [`PLAY.md`](PLAY.md)。`python3 -m http.server 5173` 後開 <http://127.0.0.1:5173/>（硬刷新 `?v=camera-closer`）。
