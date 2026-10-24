# 本機試玩 · 夜貓釣蝦場

## 最簡單（Windows）

1. 解壓到例如 `下載\hk-prawing-play\hk-prawing`（唔好留喺 Temp）
2. **雙擊 `index.html`**，用 Chrome／Edge 開
3. 要上網（載 Three.js／字體）；見到揀竿畫面同 3D 池就得

若仍係白字灰掣、冇 3D：改用下面 HTTP 方法，或裝 Android APK。

## HTTP（可選）

```bash
cd hk-prawing
py -m http.server 5173
# 或：python -m http.server 5173
# 或：npx --yes serve -p 5173
```

瀏覽器開：<http://127.0.0.1:5173/>

## 操作

1. 揀竿／阿波／餌／**水深**／池位 → **入場開釣**
2. **拋竿** → 盯浮標 → 滅頂即 **開槍**（空白鍵）→ 搏蝦按住／鬆開
3. HUD：**📋** 合約、**🦐** 圖鑑、**🛒** 商店／月卡

## 沙盒商店

- 入簍／完成合約賺 **夜幣**（每日上限）
- **購買月卡**＝本地解鎖 30 日權益（唔係真錢）
- 夜幣買邊框等外觀／便利；**唔影響咬鉤機率**

## Deep-link（HTTP 時）

- `?autostart=1` 直接入場
- `&panel=shop` / `contracts` / `dex`
- `&wow=bite` / `land` 強制播一次「哇」演出

清存檔：DevTools → Local Storage 刪 `nightcat_prawn_*`。

原生殼／APK：見 `../hk-prawing-app/CAPACITOR.md`（若你有成個 workspace）。
