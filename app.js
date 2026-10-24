/**
 * 夜貓釣蝦場 — Hong Kong indoor prawning simulator (MVP)
 * Original code. Entertainment only.
 */
(function () {
  "use strict";

  // AU cover palette (data/palette.js). Fallbacks match that file.
  const Pal = window.NightcatPalette || {
    wall: 0x8fd4b4,
    wallDeep: 0x5eae90,
    sea: 0x0e8c90,
    seaBright: 0x14a3a0,
    seaDeep: 0x0a5960,
    seaSurface: 0x12b0aa,
    seaHighlight: 0x1ec4bc,
    rim: 0xc5c9cf,
    sign: 0x6e2430,
    signGold: 0xe4c36a,
    rodRed: 0xc51628,
    rodBlack: 0x1a1c20,
    brush: 0xe06a22,
    claw: 0xe25a1c,
    prawn: 0x8d5a34,
    prawnDark: 0x6a3e24,
    prawnShell: 0xc4895a,
    hex: function (n) { return "#" + n.toString(16).padStart(6, "0"); },
  };

  // ——— Equipment data ———
  const RODS = [
    { id: "hard", name: "硬調蝦竿 · 6尺", desc: "尾一反應快，窗口窄少少", windowMul: 0.9, fightEase: 0.95 },
    { id: "mid", name: "均衡蝦竿 · 6.5尺", desc: "碳布手感，人氣之選", windowMul: 1.0, fightEase: 1.0 },
    { id: "soft", name: "軟調蝦竿 · 7尺", desc: "容錯高，搏蝦穩陣", windowMul: 1.15, fightEase: 1.12 },
  ];
  const FLOATS = [
    { id: "apo", name: "神綱型阿波", desc: "2.4分·氣泡區穩陣", signal: 0.95, style: "apo" },
    { id: "long", name: "長標", desc: "長天線·訊號敏銳易睇滅頂", signal: 1.15, style: "long" },
    { id: "short", name: "短標", desc: "短天線·穩定假訊少", signal: 1.0, style: "short" },
  ];
  const BAITS = [
    { id: "aka", name: "赤尾青", desc: "萬用活餌，就餌快", biteMul: 1.15 },
    { id: "pork", name: "醃肉餌", desc: "大隻蝦鐘意", biteMul: 1.0, sizeBonus: 0.12 },
    { id: "powder", name: "蝦粉軟餌", desc: "耐泡，適合長等", biteMul: 0.95 },
  ];
  const SEATS = [
    { id: "A", name: "A · 水泡區", desc: "氧氣足，蝦活躍", biteMul: 1.2, teaseBonus: 0.08 },
    { id: "B", name: "B · 池角", desc: "大蝦匿埋位", biteMul: 0.95, sizeBonus: 0.18 },
    { id: "C", name: "C · 邊壁", desc: "走位多，訊號亂啲", biteMul: 1.05, falseBite: 0.12 },
  ];

  const STATE = {
    IDLE: "idle",
    CASTING: "casting",
    WAITING: "waiting",
    TEASING: "teasing",
    BITE_TEASE: "bite_tease",
    BITE_SINK: "bite_sink",
    FIGHTING: "fighting",
    RESOLVE: "resolve",
  };

  // ——— Content modules (species / techniques / progress) ———
  const Spec = window.PrawnSpecies || { SPECIES: [], RARITY_ZH: {}, getById: () => null, pickWeighted: (a) => a[0], liangToGrams: (x) => x * 37.5 };
  const Tech = window.PrawnTechniques || {
    DEPTHS: [
      { id: "mid", name: "中水", desc: "預設", metres: 0.55, biteMul: 1, falseBiteMul: 1 },
    ],
    TEASE: { baseBoost: 0.35, aggressionScale: 0.25, cooldownMs: 1800, cooldownPenalty: 0.55, hideScale: 0.15 },
    STRIKE: { baseWindowMs: 900, earlyBase: 0.22, blindBase: 0.08, sinkGood: 0.04, goodHookFloor: 0.55 },
    match: () => ({ bite: 1, hook: 1, escape: 1, fight: 1, apoBand: "mid", notes: [] }),
    spawnWeights: (list) => list.map(() => 1),
  };
  const Prog = window.PrawnProgress || null;
  const Shop = window.PrawnShop || null;
  const Sponsors = window.PrawnSponsors || null;
  const Wow = (window.PrawnWow && window.PrawnWow.CONFIG) || { enabled: false };
  const DEPTHS = Tech.DEPTHS;

  // ——— Selection ———
  const pick = { rod: RODS[1], float: FLOATS[0], bait: BAITS[0], depth: DEPTHS[1] || DEPTHS[0], seat: SEATS[0] };

  function mountOptions(containerId, items, key) {
    const el = document.getElementById(containerId);
    el.innerHTML = "";
    items.forEach((item, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const defIdx = key === "rod" || key === "depth" ? 1 : 0;
      btn.className = "opt" + (i === defIdx ? " selected" : "");
      btn.setAttribute("role", "option");
      btn.dataset.id = item.id;
      btn.innerHTML = `<span class="name">${item.name}</span><span class="desc">${item.desc}</span>`;
      btn.addEventListener("click", () => {
        el.querySelectorAll(".opt").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        pick[key] = item;
      });
      el.appendChild(btn);
    });
  }

  mountOptions("opt-rod", RODS, "rod");
  mountOptions("opt-float", FLOATS, "float");
  mountOptions("opt-bait", BAITS, "bait");
  mountOptions("opt-depth", DEPTHS, "depth");
  mountOptions("opt-seat", SEATS, "seat");

  // ——— Game runtime ———
  const game = {
    state: STATE.IDLE,
    soundOn: false,
    basket: [],
    bossBoostUntil: 0,
    biteTimer: null,
    fight: { tension: 0.4, target: 0.55, holding: false, progress: 0, shrimp: null },
    sceneReady: false,
    clock: 0,
    waterY: 0.38,
    pendingSpecies: null,
    pendingMatch: null,
    castUsedTease: false,
    lastTeaseAt: 0,
    progress: Prog ? Prog.load() : null,
    shop: Shop ? Shop.load() : null,
    lastCatchFeedback: [],
    lastStrikePerfect: false,
    wow: {
      biteUntil: 0,
      camPush: 0,
      landUntil: 0,
      slowUntil: 0,
      stampUntil: 0,
    },
    splash: [],
    adPanels: [],
  };

  // DOM
  const $ = (id) => document.getElementById(id);
  const setupEl = $("setup");
  const splashEl = $("splash");
  const hudEl = $("hud");
  const toastEl = $("toast");
  const biteFlash = $("bite-flash");
  const tensionWrap = $("tension-wrap");
  const tensionFill = $("tension-fill");
  const tensionState = $("tension-state");
  const tensionHint = $("tension-hint");
  const pillStatus = $("pill-status");
  const basketCount = $("basket-count");
  const basketWeight = $("basket-weight");
  const btnCast = $("btn-cast");
  const btnTease = $("btn-tease");
  const btnStrike = $("btn-strike");
  const btnSound = $("btn-sound");
  const bossBanner = $("boss-banner");

  let toastTimer = null;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = "toast show" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 4200);
  }

  function setStatus(text) {
    pillStatus.textContent = text;
  }

  function updateBasketUI() {
    const n = game.basket.length;
    const w = game.basket.reduce((s, x) => s + x.liang, 0);
    basketCount.textContent = String(n);
    basketWeight.textContent = w.toFixed(1);
  }

  function clearBiteTimer() {
    if (game.biteTimer) {
      clearTimeout(game.biteTimer);
      game.biteTimer = null;
    }
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function chance(p) {
    return Math.random() < p;
  }

  function biteRate() {
    let r = 1;
    r *= pick.bait.biteMul || 1;
    r *= pick.seat.biteMul || 1;
    r *= (pick.depth && pick.depth.biteMul) || 1;
    if (game.pendingMatch) r *= game.pendingMatch.bite;
    if (Date.now() < game.bossBoostUntil) r *= 1.55;
    return r;
  }

  function chooseApproachingSpecies() {
    const list = Spec.SPECIES || [];
    if (!list.length) return null;
    const weights = Tech.spawnWeights(list, pick);
    const sp = Spec.pickWeighted(list, weights);
    const m = Tech.match(sp, pick);
    game.pendingSpecies = sp;
    game.pendingMatch = m;
    return sp;
  }

  function updateProgressUI() {
    const strip = $("contract-strip");
    const dexEl = $("dex-count");
    if (!game.progress || !Prog) {
      if (strip) strip.innerHTML = "";
      if (dexEl) dexEl.textContent = "0/0";
      return;
    }
    const stats = Prog.dexStats(game.progress, Spec.SPECIES);
    if (dexEl) dexEl.textContent = stats.unlocked + "/" + stats.total;
    if (strip) {
      strip.innerHTML = "";
      (game.progress.contracts || []).slice(0, 3).forEach((c) => {
        const chip = document.createElement("span");
        chip.className = "contract-chip" + (c.done ? " done" : "");
        const target = Prog.goalTarget(c.goal);
        let prog;
        if (c.goal.type === "total_liang") {
          prog = Math.min(target, c.progress || 0).toFixed(1) + "/" + target;
        } else {
          prog = Math.floor(Math.min(target, c.progress || 0)) + "/" + target;
        }
        chip.innerHTML = (c.done ? "✓ " : "") + c.title + '<span class="prog">' + prog + "</span>";
        chip.title = c.desc || "";
        strip.appendChild(chip);
      });
    }
  }

  function openContracts() {
    const list = $("contracts-list");
    if (!list || !game.progress || !Prog) return;
    list.innerHTML = "";
    (game.progress.contracts || []).forEach((c) => {
      const li = document.createElement("li");
      li.className = c.done ? "done" : "";
      const target = Prog.goalTarget(c.goal);
      let prog;
      if (c.goal.type === "total_liang") {
        prog = Math.min(target, c.progress || 0).toFixed(1) + " / " + target + " 兩";
      } else {
        prog = Math.floor(Math.min(target, c.progress || 0)) + " / " + target;
      }
      li.innerHTML =
        '<div class="ctitle">' +
        (c.done ? "✓ " : "") +
        c.title +
        '</div><div class="cdesc">' +
        (c.desc || "") +
        '</div><div class="cprog">進度 ' +
        prog +
        (c.rewardHint ? " · " + c.rewardHint : "") +
        "</div>";
      list.appendChild(li);
    });
    $("modal-contracts").classList.remove("hidden");
  }

  function closeContracts() {
    $("modal-contracts").classList.add("hidden");
  }

  function openDex() {
    const grid = $("dex-grid");
    if (!grid) return;
    grid.innerHTML = "";
    const dex = (game.progress && game.progress.dex) || {};
    (Spec.SPECIES || []).forEach((s) => {
      const entry = dex[s.id];
      const unlocked = entry && entry.unlockedAt;
      const card = document.createElement("div");
      card.className =
        "dex-card rarity-" +
        s.rarity +
        (unlocked ? "" : " locked");
      if (!unlocked) {
        card.innerHTML =
          '<div class="dname">？？？</div><div class="drarity">' +
          (Spec.RARITY_ZH[s.rarity] || s.rarity) +
          '</div><div class="dblurb">未解鎖 · 釣中先睇到</div>';
      } else {
        card.innerHTML =
          '<div class="dname">' +
          s.nameZh +
          '</div><div class="drarity">' +
          (Spec.RARITY_ZH[s.rarity] || s.rarity) +
          '</div><div class="dblurb">' +
          (s.blurb || "") +
          '</div><div class="dmeta">釣過 ' +
          (entry.catchCount || 1) +
          " 尾 · 最重 " +
          (entry.bestLiang || 0).toFixed(2) +
          " 兩</div>";
      }
      grid.appendChild(card);
    });
    $("modal-dex").classList.remove("hidden");
  }

  function closeDex() {
    $("modal-dex").classList.add("hidden");
  }

  function updateShopUI() {
    const coinEl = $("coin-count");
    if (coinEl && game.shop) coinEl.textContent = String(game.shop.coins || 0);
    // cosmetic scale tint on basket pill
    const basketPill = $("pill-basket");
    if (basketPill && game.shop && game.shop.equipped && game.shop.equipped.scale === "scale_teal") {
      basketPill.style.borderColor = "rgba(58, 159, 208, 0.55)";
    } else if (basketPill) {
      basketPill.style.borderColor = "";
    }
  }

  function openShop() {
    if (!Shop || !game.shop) {
      toast("商店模組未載入", "alert");
      return;
    }
    const passBox = $("shop-pass");
    const grid = $("shop-grid");
    const bal = $("shop-balance");
    const active = Shop.isPassActive(game.shop);
    const until = game.shop.pass && game.shop.pass.until
      ? new Date(game.shop.pass.until).toLocaleDateString("zh-HK")
      : "";
    let rows = (Shop.PASS_ENTITLEMENTS || [])
      .map(
        (r) =>
          "<tr><th>" +
          r.nameZh +
          "</th><td>" +
          r.free +
          "</td><td>" +
          r.pass +
          "</td></tr>"
      )
      .join("");
    passBox.innerHTML =
      "<h4>" +
      Shop.PASS_PRODUCT.nameZh +
      (active ? ' <span class="pass-active-chip">生效中</span>' : "") +
      "</h4>" +
      '<div class="pass-status">' +
      (active ? "有效至 " + until + " · 沙盒" : Shop.PASS_PRODUCT.blurb) +
      "</div>" +
      "<table><thead><tr><th>權益</th><th>免費</th><th>月卡</th></tr></thead><tbody>" +
      rows +
      "</tbody></table>" +
      (active
        ? ""
        : '<button type="button" class="btn btn-primary" id="btn-buy-pass" style="width:auto">購買月卡（沙盒）</button>');
    grid.innerHTML = "";
    (Shop.CATALOG || []).forEach((item) => {
      const owned =
        (item.once && game.shop.owned[item.id]) ||
        (item.cosmeticId && game.shop.owned[item.cosmeticId]);
      const card = document.createElement("div");
      card.className = "shop-item";
      const price =
        item.cost === 0 ? "免費" : item.cost + " 夜幣";
      card.innerHTML =
        '<div class="iname">' +
        item.nameZh +
        '</div><div class="idesc">' +
        item.desc +
        '</div><div class="irow"><span class="iprice">' +
        price +
        '</span><button type="button" data-buy="' +
        item.id +
        '"' +
        (owned ? " disabled" : "") +
        ">" +
        (owned ? "已有" : "購買") +
        "</button></div>";
      grid.appendChild(card);
    });
    bal.textContent =
      "夜幣：" +
      (game.shop.coins || 0) +
      " · 今日已賺 " +
      (game.shop.earnedToday || 0) +
      "/" +
      (Shop.EARN.dailyCap || 120);
    const buyPass = $("btn-buy-pass");
    if (buyPass) {
      buyPass.addEventListener("click", () => {
        Shop.activatePass(game.shop);
        toast("月卡已開通（沙盒 30 日）", "ok");
        if (Shop.passEffects(game.shop).prioritySeatFluff) {
          toast("優先留枱 15 分鐘（文案）已標註", "ok");
        }
        openShop();
        updateShopUI();
      });
    }
    grid.querySelectorAll("[data-buy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const res = Shop.purchase(game.shop, btn.getAttribute("data-buy"));
        toast(res.msg, res.ok ? "ok" : "alert");
        openShop();
        updateShopUI();
      });
    });
    $("modal-shop").classList.remove("hidden");
    updateShopUI();
  }

  function closeShop() {
    $("modal-shop").classList.add("hidden");
  }

  function haptic(ms) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms || 20);
    } catch (e) {}
  }

  function triggerBiteWow() {
    if (!Wow.enabled || !Wow.bite || !Wow.bite.enabled) return;
    const b = Wow.bite;
    const now = performance.now();
    game.wow.biteUntil = now + (b.cameraMs || 400);
    game.wow.camPush = b.cameraPush || 0.25;
    floatBob.amp = Math.max(floatBob.amp, b.floatJolt || 0.06);
    const wrap = $("canvas-wrap");
    if (wrap) {
      wrap.classList.remove("shake");
      void wrap.offsetWidth;
      wrap.classList.add("shake");
      setTimeout(() => wrap.classList.remove("shake"), b.shakeMs || 380);
    }
    if (b.hapticMs) haptic(b.hapticMs);
  }

  function spawnSplash(origin, count) {
    if (!scene || !THREE) return;
    const n = count || 16;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.012 + Math.random() * 0.018, 6, 6),
        new THREE.MeshStandardMaterial({
          color: 0xa8d8f0,
          transparent: true,
          opacity: 0.85,
          roughness: 0.35,
        })
      );
      const o = origin || (floatMesh ? floatMesh.position : { x: 0, y: 0.4, z: 0 });
      m.position.set(o.x + rand(-0.08, 0.08), o.y + 0.02, o.z + rand(-0.08, 0.08));
      const vel = {
        x: rand(-0.35, 0.35),
        y: rand(0.55, 1.35),
        z: rand(-0.35, 0.35),
      };
      scene.add(m);
      game.splash.push({ mesh: m, vel, life: (Wow.land && Wow.land.splashLife) || 0.7 });
    }
  }

  function showWowStamp(text) {
    const el = $("wow-stamp");
    if (!el) return;
    el.textContent = text;
    el.classList.add("show");
    const ms = (Wow.land && Wow.land.stampMs) || 1400;
    game.wow.stampUntil = performance.now() + ms;
    clearTimeout(showWowStamp._t);
    showWowStamp._t = setTimeout(() => el.classList.remove("show"), ms);
  }

  function triggerLandWow(kind) {
    if (!Wow.enabled || !Wow.land || !Wow.land.enabled) return;
    const L = Wow.land;
    const now = performance.now();
    game.wow.slowUntil = now + (L.slowMoMs || 500);
    game.wow.landUntil = game.wow.slowUntil;
    spawnSplash(floatMesh && floatMesh.position, L.splashCount || 16);
    if (L.hapticMs) haptic(L.hapticMs);
    if (kind === "perfect") showWowStamp("完美揚竿");
    else if (kind === "first") showWowStamp("第一尾入簍");
    else showWowStamp("入籮！");
  }

  function applySponsorTexture(style, creative) {
    return makeAdPanelTexture(512, 320, style, creative || null);
  }

  function refreshAdPanelsFromSponsors() {
    if (!game.adPanels || !game.adPanels.length) return;
    game.adPanels.forEach((entry) => {
      const slot = entry.slotId;
      const hit = Sponsors ? Sponsors.creativeForSlot(slot) : null;
      const cre = hit && hit.creative ? hit.creative : null;
      const style = entry.style;
      const tex = applySponsorTexture(style, cre);
      const mat = entry.panel.material;
      if (mat.map) mat.map.dispose();
      mat.map = tex;
      mat.needsUpdate = true;
      entry.campaignId = hit ? hit.campaignId : null;
    });
  }

  // ——— Three.js scene ———
  let renderer, scene, camera, waterMesh, floatMesh, rodTip, poolGroup;
  let shrimpMeshes = [];
  const floatBaseY = 0.02;
  let floatBob = { phase: 0, amp: 0.015, sink: 0 };
  // game.waterY set in initScene

  // Near counter: a tackle box (blank logo plate) and one 蝦竿. Nothing else.
  function addSeatTackle(tableY) {
    const tackle = new THREE.Group();
    tackle.name = "seatTackle";
    const plastic = (color, rough, metal) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: rough == null ? 0.5 : rough,
        metalness: metal == null ? 0.06 : metal,
      });

    const boxG = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.16, 0.46), plastic(0x5e6a49, 0.48, 0.08));
    base.position.y = 0.08;
    base.castShadow = true;
    boxG.add(base);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.48), plastic(0x3d4434, 0.42, 0.12));
    lip.position.y = 0.16;
    boxG.add(lip);
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.17, -0.22);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.03, 0.46), plastic(0x7d8a62, 0.42, 0.06));
    lid.position.z = 0.23;
    lid.castShadow = true;
    lidPivot.add(lid);
    // Empty light panel — room for a future sponsor logo, no marks.
    const logoPlate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.008, 0.26), plastic(0xf6f3ec, 0.55, 0.02));
    logoPlate.position.set(0, 0.022, 0.22);
    logoPlate.name = "tackleLogoPlate";
    lidPivot.add(logoPlate);
    lidPivot.rotation.x = -0.42;
    boxG.add(lidPivot);
    boxG.position.set(-1.15, tableY, 2.28);
    boxG.rotation.y = 0.22;
    boxG.scale.setScalar(1.7);
    tackle.add(boxG);

    // Telescopic shrimp rod lying on the counter (not the angler's held rod).
    const spare = new THREE.Group();
    const segments = [
      [0.006, 0.008, 0.34, Pal.rodBlack],
      [0.008, 0.01, 0.32, Pal.rodBlack],
      [0.01, 0.012, 0.3, Pal.rodRed],
      [0.012, 0.015, 0.32, Pal.rodBlack],
      [0.015, 0.018, 0.36, Pal.rodBlack],
    ];
    let xCursor = 0.82;
    segments.forEach(([rA, rB, len, color]) => {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(rA, rB, len, 10),
        plastic(color, color === Pal.rodRed ? 0.38 : 0.34, color === Pal.rodRed ? 0.22 : 0.48)
      );
      seg.rotation.z = Math.PI / 2;
      seg.position.x = xCursor - len / 2;
      seg.castShadow = true;
      spare.add(seg);
      xCursor -= len;
    });
    const butt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.018, 0.05, 10),
      plastic(0xb0b6be, 0.28, 0.7)
    );
    butt.rotation.z = Math.PI / 2;
    butt.position.x = xCursor - 0.02;
    spare.add(butt);
    spare.position.set(1.85, tableY + 0.02, 2.2);
    spare.rotation.y = -0.06;
    tackle.add(spare);

    scene.add(tackle);
  }

  // Home framing. Portrait stays high enough that a narrow phone still
  // holds every pool rim corner and the full far ad row, but tighter than
  // the fov-90 overview. Landscape can sit lower and closer.
  function applyHomeCamera() {
    if (!camera || !game.camLook) return;
    const aspect = camera.aspect > 0 ? camera.aspect : 1;
    if (aspect < 0.9) {
      // Phone inset: high view of the light hall, all four rims and the ad row.
      camera.fov = 58;
      camera.position.set(0.08, 6.55, 7.85);
      game.camLook.set(0, 0.55, -0.55);
    } else {
      camera.fov = 46;
      camera.position.set(0.12, 5.85, 8.35);
      game.camLook.set(0, 0.42, -0.45);
    }
    game.camHome.copy(camera.position);
    camera.lookAt(game.camLook);
    camera.updateProjectionMatrix();
  }

  function initScene() {
    if (typeof THREE === "undefined") {
      console.error("Three.js failed to load");
      toast("3D 引擎載入失敗，請檢查網絡", "alert");
      return false;
    }
    const wrap = $("canvas-wrap");
    scene = new THREE.Scene();
    // Bright warehouse (Louis ref): cream walls, not the mint hall.
    const hallWall = 0xe7e2da;
    scene.background = new THREE.Color(hallWall);
    scene.fog = new THREE.Fog(hallWall, 42, 92);

    // Home pose is aspect-aware (tall phone vs landscape). See applyHomeCamera.
    const viewW = Math.max(1, wrap.clientWidth);
    const viewH = Math.max(1, wrap.clientHeight);
    camera = new THREE.PerspectiveCamera(40, viewW / viewH, 0.1, 160);
    game.camLook = new THREE.Vector3();
    game.camHome = new THREE.Vector3();
    applyHomeCamera();
    const hallTop = 12.25;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (renderer.outputColorSpace !== undefined && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    wrap.appendChild(renderer.domElement);

    // Bright even hall, with one key soft enough to leave a light pool shadow.
    const hemi = new THREE.HemisphereLight(0xfffaf6, 0xd4cfc6, 0.74);
    scene.add(hemi);
    const amb = new THREE.AmbientLight(0xfff8f2, 0.44);
    scene.add(amb);
    const key = new THREE.DirectionalLight(0xfffaf6, 0.72);
    key.position.set(3.2, 9.2, 4.2);
    key.target.position.set(0, 0.35, 0.15);
    scene.add(key.target);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 22;
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.03;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xf6f1ea, 0.34);
    fill.position.set(-3, 5, -2);
    scene.add(fill);

    // Recessed square LED panels on ceiling (many bright whites)
    const ledPanelMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfffff0,
      emissiveIntensity: 1.15,
      roughness: 0.35,
    });
    const ledFrameMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.7 });
    const ledPositions = [];
    for (let xi = -2; xi <= 2; xi++) {
      for (let zi = -2; zi <= 1; zi++) {
        ledPositions.push([xi * 2.2, hallTop - 0.18, zi * 2.0 + 0.4]);
      }
    }
    ledPositions.forEach(([x, y, z]) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.04, 0.95), ledFrameMat);
      frame.position.set(x, y, z);
      scene.add(frame);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.03, 0.78), ledPanelMat);
      panel.position.set(x, y - 0.02, z);
      scene.add(panel);
      const pl = new THREE.PointLight(0xfffaf4, 0.2, 10, 2);
      pl.position.set(x, y - 0.35, z);
      scene.add(pl);
    });

    const waterFill = new THREE.PointLight(0x8ec4e8, 0.12, 9, 2);
    waterFill.position.set(0, 2.0, 0.2);
    scene.add(waterFill);

    poolGroup = new THREE.Group();
    scene.add(poolGroup);

    // Procedural textures
    const floorTileTex = makeFloorTileTexture(256);
    floorTileTex.wrapS = floorTileTex.wrapT = THREE.RepeatWrapping;
    floorTileTex.repeat.set(6, 6);
    const wallMetalTex = makeCorrugatedTexture(256);
    wallMetalTex.wrapS = wallMetalTex.wrapT = THREE.RepeatWrapping;
    wallMetalTex.repeat.set(8, 14);

    // Floor — light grey squares, same hall as the reference photo.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({
        map: floorTileTex,
        color: 0xffffff,
        roughness: 0.88,
        metalness: 0.02,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.52;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grey industrial walls (corrugated metal look)
    const backWallMat = new THREE.MeshStandardMaterial({
      map: wallMetalTex,
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.0,
      emissive: hallWall,
      emissiveIntensity: 0.12,
    });
    const sideWallMat = new THREE.MeshStandardMaterial({
      color: hallWall,
      roughness: 0.92,
      metalness: 0.0,
      emissive: hallWall,
      emissiveIntensity: 0.1,
    });
    function wall(mat, w, h, d, x, y, z) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.receiveShadow = true;
      m.castShadow = true;
      scene.add(m);
      return m;
    }
    // Tall hall so the pulled-back phone camera stays inside the warehouse.
    const hallH = hallTop + 0.45;
    const hallCY = (hallTop - 0.45) / 2;
    wall(backWallMat, 16, hallH, 0.18, 0, hallCY, -5.0);
    wall(sideWallMat, 0.18, hallH, 22, -6.2, hallCY, 3.0);
    wall(sideWallMat, 0.18, hallH, 22, 6.2, hallCY, 3.0);

    // (removed horizontal wall rails/beams per Louis feedback)

    // Bright white ceiling panels
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 26),
      new THREE.MeshStandardMaterial({ color: 0xf4f1eb, roughness: 0.92, side: THREE.FrontSide })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, hallTop, 2.2);
    scene.add(ceiling);

    // ——— Ad panel placeholders (far + side walls — future paid ads) ———
    function addAdPanel(w, h, x, y, z, rotY, style, slotId) {
      const slot = slotId || style;
      const hit = Sponsors ? Sponsors.creativeForSlot(slot) : null;
      const cre = hit && hit.creative ? hit.creative : null;
      const g = new THREE.Group();
      const tex = makeAdPanelTexture(512, 320, style, cre);
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.55,
        metalness: 0.05,
        emissive: 0x000000,
        emissiveIntensity: 0,
      });
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.03),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.6 })
      );
      frame.position.z = -0.01;
      g.add(frame);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), mat);
      panel.castShadow = true;
      panel.receiveShadow = true;
      panel.userData.adSlot = true;
      panel.userData.adStyle = style;
      panel.userData.slotId = slot;
      g.add(panel);
      g.position.set(x, y, z);
      g.rotation.y = rotY || 0;
      g.userData.adSlot = true;
      scene.add(g);
      game.adPanels.push({
        group: g,
        panel,
        style,
        slotId: slot,
        campaignId: hit ? hit.campaignId : null,
      });
      return g;
    }
    // Far wall row of ad spaces (lowered into camera-visible band above pool)
    addAdPanel(2.5, 1.35, -4.0, 1.45, -4.86, 0, "green", "green");
    addAdPanel(2.0, 1.45, -1.5, 1.5, -4.86, 0, "logo", "logo");
    addAdPanel(2.7, 1.4, 1.2, 1.5, -4.86, 0, "black", "black");
    addAdPanel(2.3, 1.35, 4.0, 1.45, -4.86, 0, "teal", "teal");
    // Side wall ad strips
    addAdPanel(2.1, 1.3, -6.05, 1.5, -1.8, Math.PI / 2, "side", "side_l");
    addAdPanel(2.1, 1.3, 6.05, 1.5, -1.8, -Math.PI / 2, "side", "side_r");

    // Small digital scoreboard above center ads
    const scoreBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.28, 0.05),
      new THREE.MeshStandardMaterial({
        color: Pal.ink,
        emissive: 0x1c5f96,
        emissiveIntensity: 0.12,
        roughness: 0.5,
      })
    );

    scoreBoard.position.set(4.7, 2.55, -4.84);
    scene.add(scoreBoard);

    // Maroon / gold hall name, above the sponsor row. Not a paid slot.
    function addHallSign() {
      const c = document.createElement("canvas");
      c.width = 768;
      c.height = 200;
      const ctx = c.getContext("2d");
      ctx.fillStyle = Pal.hex(Pal.sign);
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.strokeStyle = Pal.hex(Pal.signGold);
      ctx.lineWidth = 12;
      ctx.strokeRect(14, 14, c.width - 28, c.height - 28);
      ctx.fillStyle = Pal.hex(Pal.signGold);
      ctx.textAlign = "center";
      ctx.font = "bold 72px sans-serif";
      ctx.fillText("夜貓釣蝦場", c.width / 2, 112);
      ctx.font = "26px sans-serif";
      ctx.fillStyle = "#f6e7c0";
      ctx.fillText("香港室內釣蝦 · 娛樂模擬", c.width / 2, 156);
      const tex = new THREE.CanvasTexture(c);
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      const g = new THREE.Group();
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(2.35, 1.05, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x4a1822, roughness: 0.55 })
      );
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.92, 0.05),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.05 })
      );
      panel.position.z = 0.02;
      g.add(frame);
      g.add(panel);
      // Above the sponsor row so the four ad panels stay readable.
      g.position.set(0, 2.68, -4.82);
      scene.add(g);
    }
    addHallSign();

    // Blue wall fans (ref photo)
    function wallFan(x, y, z, rotY) {
      const g = new THREE.Group();
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: 0x2a6ab8, metalness: 0.4, roughness: 0.4 })
      );
      hub.rotation.x = Math.PI / 2;
      g.add(hub);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.025, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0x3a7ad0, metalness: 0.35, roughness: 0.45 })
      );
      g.add(ring);
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xd0d8e0, roughness: 0.5, metalness: 0.2 });
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.08), bladeMat);
        blade.position.x = 0.12;
        const pivot = new THREE.Group();
        pivot.rotation.z = (i / 3) * Math.PI * 2;
        pivot.add(blade);
        g.add(pivot);
      }
      g.position.set(x, y, z);
      g.rotation.y = rotY || 0;
      scene.add(g);
    }
    wallFan(-5.0, 2.85, -4.7, 0);
    wallFan(5.0, 2.85, -4.7, 0);
    wallFan(-6.0, 2.7, 0.5, Math.PI / 2);
    wallFan(6.0, 2.7, 0.5, -Math.PI / 2);

    // ——— Main prawning tank ———
    // Water surface stays at WATER_Y (float / bite anchor). The coping sits
    // well above it so freeboard, inner wall, and rim thickness read as a tank.
    // Never put a solid lid over the water.
    const WATER_Y = 0.42;
    const innerW = 5.8;
    const innerD = 3.9;
    const wallThick = 0.56;
    const capT = 0.12;
    const freeboard = 0.46;
    const deckTop = WATER_Y + freeboard + capT;
    const capBottom = deckTop - capT;
    const outerBottom = -0.52;
    const outerTop = capBottom + 0.012;
    const outerH = outerTop - outerBottom;
    const outerCY = (outerBottom + outerTop) / 2;
    const bottomY = -0.4;
    const overhang = 0.18;
    const halfW = innerW / 2;
    const halfD = innerD / 2;
    const outerHalfW = halfW + wallThick;
    const outerHalfD = halfD + wallThick;
    game.waterY = WATER_Y;

    // Space 6 pool: cool grey stone cap, tiled outer wall, teal water.
    const seaTeal = 0x0e948e;
    const seaDeepTeal = 0x0a5e5c;
    const seaSurfaceTeal = 0x1cbfb6;
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xe4e8ed,
      roughness: 0.58,
      metalness: 0.04,
    });
    const sideMat = new THREE.MeshStandardMaterial({
      color: 0xb7bec6,
      roughness: 0.86,
      metalness: 0.04,
    });
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0xc5ccd3,
      roughness: 0.74,
      metalness: 0.03,
    });
    const linerMat = new THREE.MeshStandardMaterial({
      color: seaDeepTeal,
      roughness: 0.45,
      metalness: 0.05,
    });
    const lipShadowMat = new THREE.MeshStandardMaterial({
      color: 0x8d8174,
      roughness: 0.9,
      metalness: 0.02,
    });

    function box(mat, w, h, d, x, y, z, cast) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.receiveShadow = true;
      if (cast) m.castShadow = true;
      poolGroup.add(m);
      return m;
    }

    const shellW = innerW + wallThick * 2;
    const tile = 0.4;
    const faceLong = makePoolTileMaterial(shellW / tile, outerH / tile);
    const faceSide = makePoolTileMaterial(innerD / tile, outerH / tile);
    // Far / near walls span the full width (they own the corners).
    box(faceLong, shellW, outerH, wallThick, 0, outerCY, -(halfD + wallThick / 2), true);
    box(faceLong, shellW, outerH, wallThick, 0, outerCY, halfD + wallThick / 2, true);
    // Side walls stop at the inner span so they don't z-fight the corners.
    box(faceSide, wallThick, outerH, innerD, -(halfW + wallThick / 2), outerCY, 0, true);
    box(faceSide, wallThick, outerH, innerD, halfW + wallThick / 2, outerCY, 0, true);
    box(sideMat, innerW, 0.12, innerD, 0, bottomY - 0.06, 0, false);

    // Underwater liner stops at the waterline. Above that, a mid-grey freeboard.
    const linTop = WATER_Y - 0.012;
    const linH = linTop - (bottomY + 0.02);
    const linCY = (linTop + bottomY + 0.02) / 2;
    const linT = 0.055;
    box(linerMat, innerW - 0.06, linH, linT, 0, linCY, -(halfD - 0.04), false);
    box(linerMat, innerW - 0.06, linH, linT, 0, linCY, halfD - 0.04, false);
    box(linerMat, linT, linH, innerD - 0.18, -(halfW - 0.04), linCY, 0, false);
    box(linerMat, linT, linH, innerD - 0.18, halfW - 0.04, linCY, 0, false);

    const fbH = capBottom - WATER_Y - 0.015;
    const fbCY = WATER_Y + fbH / 2;
    const fbT = 0.05;
    box(innerMat, innerW - 0.1, fbH, fbT, 0, fbCY, -(halfD - 0.035), true);
    box(innerMat, innerW - 0.1, fbH, fbT, 0, fbCY, halfD - 0.035, true);
    box(innerMat, fbT, fbH, innerD - 0.16, -(halfW - 0.035), fbCY, 0, true);
    box(innerMat, fbT, fbH, innerD - 0.16, halfW - 0.035, fbCY, 0, true);

    const floorTile = makeTileTexture(128, "#1cbfb6", "#0e948e", 8);
    floorTile.wrapS = floorTile.wrapT = THREE.RepeatWrapping;
    floorTile.repeat.set(5, 3);
    const tankFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(innerW - 0.12, innerD - 0.12),
      new THREE.MeshStandardMaterial({
        map: floorTile,
        color: seaTeal,
        roughness: 0.8,
        metalness: 0.02,
      })
    );
    tankFloor.rotation.x = -Math.PI / 2;
    tankFloor.position.y = bottomY + 0.03;
    tankFloor.receiveShadow = true;
    poolGroup.add(tankFloor);

    // WATER VOLUME — sea blue, surface locked to WATER_Y.
    const waterDepth = Math.max(0.35, WATER_Y - (bottomY + 0.05));
    const waterVolMat = new THREE.MeshStandardMaterial({
      color: seaTeal,
      roughness: 0.28,
      metalness: 0.02,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: seaDeepTeal,
      emissiveIntensity: 0.05,
    });
    const waterVolume = new THREE.Mesh(
      new THREE.BoxGeometry(innerW - 0.16, waterDepth, innerD - 0.16),
      waterVolMat
    );
    waterVolume.position.y = bottomY + 0.05 + waterDepth / 2;
    waterVolume.renderOrder = 1;
    poolGroup.add(waterVolume);

    const waterGeo = new THREE.PlaneGeometry(innerW - 0.2, innerD - 0.2, 48, 32);
    const surfaceMat = new THREE.MeshStandardMaterial({
      color: seaSurfaceTeal,
      roughness: 0.16,
      metalness: 0.1,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: seaTeal,
      emissiveIntensity: 0.04,
    });
    waterMesh = new THREE.Mesh(waterGeo, surfaceMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = WATER_Y;
    waterMesh.renderOrder = 2;
    poolGroup.add(waterMesh);

    // Dark contact where the water meets the wall — not a bright surface rail.
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0x085e5c,
      roughness: 0.5,
      metalness: 0.02,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    function waterEdge(w, d, x, z) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), edgeMat);
      e.position.set(x, WATER_Y - 0.004, z);
      e.renderOrder = 3;
      poolGroup.add(e);
    }
    waterEdge(innerW - 0.22, 0.04, 0, -(halfD - 0.12));
    waterEdge(innerW - 0.22, 0.04, 0, halfD - 0.12);
    waterEdge(0.04, innerD - 0.28, -(halfW - 0.12), 0);
    waterEdge(0.04, innerD - 0.28, halfW - 0.12, 0);

    // One stone width on every side: outer lip → inner edge above the water.
    // Far and near slabs own the corners; side slabs stop between those inner edges.
    const lipOut = 0.05;
    const rimW = wallThick + overhang + lipOut;
    const capY = (capBottom + deckTop) / 2;
    const innerX = halfW - overhang;
    const innerZ = halfD - overhang;
    const outerX = halfW + wallThick + lipOut;
    const outerZ = halfD + wallThick + lipOut;
    const capSpanX = outerX * 2;
    const sideSpanZ = innerZ * 2;
    box(capMat, capSpanX, capT, rimW, 0, capY, -(innerZ + outerZ) / 2, true);
    box(capMat, capSpanX, capT, rimW, 0, capY, (innerZ + outerZ) / 2, true);
    box(capMat, rimW, capT, sideSpanZ, -((innerX + outerX) / 2), capY, 0, true);
    box(capMat, rimW, capT, sideSpanZ, (innerX + outerX) / 2, capY, 0, true);

    // Shadow lip under the inward overhang (top vs underside).
    const lipY = capBottom - 0.018;
    const lipT = 0.028;
    box(lipShadowMat, innerW - 0.55, lipT, 0.07, 0, lipY, -(innerZ + 0.02), false);
    box(lipShadowMat, innerW - 0.55, lipT, 0.07, 0, lipY, innerZ + 0.02, false);
    box(lipShadowMat, 0.07, lipT, sideSpanZ - 0.2, -(innerX + 0.02), lipY, 0, false);
    box(lipShadowMat, 0.07, lipT, sideSpanZ - 0.2, innerX + 0.02, lipY, 0, false);

    // Underwater air stones only (surface T-pipe removed — looked like stray bar on water)
    const bubbler = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x666870, roughness: 0.85 })
    );
    bubbler.position.set(0.15, bottomY + 0.12, -1.0);
    poolGroup.add(bubbler);
    const bubbler2 = bubbler.clone();
    bubbler2.position.set(-1.2, bottomY + 0.12, 0.6);
    poolGroup.add(bubbler2);

    function makeBubbleCluster(cx, cz, count) {
      const bubbleGeo = new THREE.BufferGeometry();
      const bPos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = Math.random();
        const rad = 0.12 + r * 0.28;
        const ang = Math.random() * Math.PI * 2;
        bPos[i * 3] = cx + Math.cos(ang) * rad;
        // Bias bubbles toward mid-upper column so surface break reads clearly
        bPos[i * 3 + 1] = bottomY + 0.12 + Math.pow(Math.random(), 0.55) * (WATER_Y - bottomY - 0.05);
        bPos[i * 3 + 2] = cz + Math.sin(ang) * rad;
      }
      bubbleGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
      const bubbles = new THREE.Points(
        bubbleGeo,
        new THREE.PointsMaterial({
          color: 0xf2faff,
          size: 0.085,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
          sizeAttenuation: true,
        })
      );
      bubbles.userData.waterY = WATER_Y;
      bubbles.userData.bottomY = bottomY + 0.12;
      bubbles.name = "bubbles";
      poolGroup.add(bubbles);
      return bubbles;
    }
    // 氣泡區 — distinct aeration columns (釣蝦場 style)
    makeBubbleCluster(0.2, -1.1, 55);
    makeBubbleCluster(-1.6, 0.7, 48);
    makeBubbleCluster(1.7, 0.5, 48);
    makeBubbleCluster(-0.6, -0.2, 40);
    makeBubbleCluster(1.0, -0.7, 36);

    // ——— Taiwan 阿波 / 長標 / 短標 (神綱-style silhouette; no brand logos) ———
    function buildFloatMesh(style) {
      const g = new THREE.Group();
      const tipHex = style === "long" ? 0xff4fa3 : style === "short" ? 0xff7a1a : 0xfff200;
      const bodyHex = style === "long" ? 0x1a3a28 : style === "short" ? 0x2a2e36 : 0x3a1e14;
      const tipMat = new THREE.MeshStandardMaterial({ color: tipHex, roughness: 0.14, metalness: 0.12, emissive: tipHex, emissiveIntensity: 0.08 });
      const bodyMat = new THREE.MeshStandardMaterial({ color: bodyHex, roughness: 0.16, metalness: 0.2 });
      const ringMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.35, metalness: 0.4 });
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.35 });
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.45, metalness: 0.35 });

      // Scale: apo teardrop compact; long = taller antenna; short = stubbier
      const bodyH = style === "long" ? 0.095 : style === "short" ? 0.055 : 0.078;
      const bodyR = style === "long" ? 0.016 : style === "short" ? 0.018 : 0.017;
      const tipH = style === "long" ? 0.055 : style === "short" ? 0.038 : 0.042;
      const stemH = style === "long" ? 0.22 : style === "short" ? 0.12 : 0.18;

      // Teardrop body (lathe-like via stacked tapers)
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), bodyMat);
      body.scale.set(bodyR * 1.05, bodyH * 0.72, bodyR * 1.05);
      body.position.y = 0.0;
      body.castShadow = true;
      g.add(body);
      const taper = new THREE.Mesh(new THREE.ConeGeometry(bodyR * 0.95, bodyH * 0.85, 14), bodyMat);
      taper.position.y = -bodyH * 0.55;
      g.add(taper);

      // Fluorescent tip dome + thin black rings + white separator
      const tipDome = new THREE.Mesh(new THREE.SphereGeometry(bodyR * 0.95, 12, 10), tipMat);
      tipDome.scale.set(1, 0.85, 1);
      tipDome.position.y = bodyH * 0.55;
      g.add(tipDome);
      const tipCap = new THREE.Mesh(new THREE.CylinderGeometry(bodyR * 0.55, bodyR * 0.9, tipH, 12), tipMat);
      tipCap.position.y = bodyH * 0.55 + tipH * 0.35;
      g.add(tipCap);
      const whiteBand = new THREE.Mesh(new THREE.CylinderGeometry(bodyR * 1.02, bodyR * 1.02, 0.006, 16), whiteMat);
      whiteBand.position.y = bodyH * 0.28;
      g.add(whiteBand);
      if (style === "apo") {
        const silver = new THREE.Mesh(
          new THREE.CylinderGeometry(bodyR * 1.01, bodyR * 1.01, 0.005, 16),
          new THREE.MeshStandardMaterial({ color: 0xc0c6ce, metalness: 0.85, roughness: 0.25 })
        );
        silver.position.y = bodyH * 0.12;
        g.add(silver);
      }
      for (const dy of [0.012, -0.01]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(bodyR * 0.92, 0.0018, 6, 20), ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = bodyH * 0.42 + dy;
        g.add(ring);
      }

      // Long tapered dark stem into water
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0045, stemH, 8), stemMat);
      stem.position.y = -bodyH * 0.85 - stemH * 0.45;
      g.add(stem);
      const stemTip = new THREE.Mesh(new THREE.ConeGeometry(0.0035, 0.018, 8), stemMat);
      stemTip.position.y = -bodyH * 0.85 - stemH * 0.9;
      g.add(stemTip);

      // Optional 目印 bead on long antenna
      if (style === "long") {
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8), tipMat);
        bead.position.y = bodyH * 0.55 + tipH * 0.85;
        g.add(bead);
      }
      g.userData.floatStyle = style;
      return g;
    }

    floatMesh = buildFloatMesh((pick.float && pick.float.style) || "apo");
    floatMesh.position.set(0.15, (game.waterY || 0.38) + 0.018, 0.1);
    floatMesh.visible = false;
    floatMesh.castShadow = true;
    scene.add(floatMesh);
    game.rebuildFloat = (style) => {
      const pos = floatMesh.position.clone();
      const vis = floatMesh.visible;
      scene.remove(floatMesh);
      floatMesh = buildFloatMesh(style || "apo");
      floatMesh.position.copy(pos);
      floatMesh.visible = vis;
      floatMesh.castShadow = true;
      scene.add(floatMesh);
    };

    // ——— 7-piece telescopic HAND shrimp rod ~210cm (no reel; Daiwa-like red/black) ———
    rodTip = new THREE.Group();
    const carbon = new THREE.MeshStandardMaterial({ color: Pal.rodBlack, roughness: 0.28, metalness: 0.55 });
    const carbonTip = new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.3, metalness: 0.5 });
    const rodRedBand = new THREE.MeshStandardMaterial({ color: Pal.rodRed, roughness: 0.38, metalness: 0.22 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x2a241c, roughness: 0.82 });
    const ringChrome = new THREE.MeshStandardMaterial({ color: 0xd0d4da, metalness: 0.88, roughness: 0.22 });
    const buttCapMat = new THREE.MeshStandardMaterial({ color: 0xa8adb6, metalness: 0.9, roughness: 0.2 });

    function rodSeg(rTop, rBot, len, mat, yAlong) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, 12), mat);
      m.position.set(0, yAlong, 0);
      m.castShadow = true;
      return m;
    }
    const rodParts = new THREE.Group();
    // 7 telescopic pieces: tip OD ~0.9mm visual → ~0.0022 radius; grip ~18mm → 0.018
    // lengths sum ~2.1 units along local Y
    const segs = [
      [0.0022, 0.0035, 0.32, carbonTip],  // 1 tip (尾一 soft)
      [0.0035, 0.005, 0.30, carbon],      // 2
      [0.005, 0.0065, 0.30, carbon],      // 3
      [0.0065, 0.0085, 0.30, rodRedBand], // 4 red band
      [0.0085, 0.011, 0.28, rodRedBand],  // 5
      [0.011, 0.014, 0.28, carbon],       // 6
      [0.014, 0.018, 0.32, gripMat],      // 7 butt/grip
    ];
    let cursor = 1.05; // tip end toward +Y
    const jointYs = [];
    segs.forEach(([rT, rB, len, mat], i) => {
      const y = cursor - len / 2;
      rodParts.add(rodSeg(rT, rB, len, mat, y));
      cursor -= len;
      if (i < segs.length - 1) jointYs.push(cursor);
    });
    jointYs.forEach((y) => {
      const jr = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.0016, 6, 14), ringChrome);
      jr.rotation.x = Math.PI / 2;
      jr.position.y = y;
      rodParts.add(jr);
    });
    // Tip guide ring
    const tipRing = new THREE.Mesh(new THREE.TorusGeometry(0.007, 0.0015, 6, 14), ringChrome);
    tipRing.position.set(0, 1.22, 0);
    tipRing.rotation.x = Math.PI / 2;
    tipRing.name = "tipRing";
    rodParts.add(tipRing);
    const tipBall = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8), ringChrome);
    tipBall.position.set(0, 1.235, 0);
    tipBall.name = "tipBall";
    rodParts.add(tipBall);
    // Weighted metal 尾塞 / butt cap
    const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.017, 0.045, 14), buttCapMat);
    butt.position.y = cursor - 0.02;
    rodParts.add(butt);
    const buttKnob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), buttCapMat);
    buttKnob.scale.set(1, 0.7, 1);
    buttKnob.position.y = cursor - 0.05;
    rodParts.add(buttKnob);

    rodParts.rotation.z = Math.PI / 2.15;
    rodParts.rotation.y = -0.32;
    rodParts.position.set(0.95, deckTop + 0.34, 2.35);
    rodTip.add(rodParts);
    scene.add(rodTip);

    // Fine PE-like line (slight yellow-green)
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const line = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0xc8d878, transparent: true, opacity: 0.28 })
    );
    line.name = "fishLine";
    scene.add(line);

    // ——— Rim 置竿架 — low black U-cradle (generic; no brand marks) ———
    const rest = new THREE.Group();
    const restBlk = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.4, metalness: 0.25 });
    const restSil = new THREE.MeshStandardMaterial({ color: 0xb8bec6, roughness: 0.35, metalness: 0.55 });
    const restBase = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.028, 0.14), restBlk);
    rest.add(restBase);
    // Side plates
    [-0.15, 0.15].forEach((x) => {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.13), restSil);
      plate.position.set(x, 0.03, 0);
      rest.add(plate);
    });
    // U-cradle walls + foam pad
    const uL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.1), restBlk);
    uL.position.set(-0.05, 0.05, 0);
    rest.add(uL);
    const uR = uL.clone();
    uR.position.x = 0.05;
    rest.add(uR);
    const uPad = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.012, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.7 })
    );
    uPad.position.set(0, 0.03, 0);
    rest.add(uPad);
    const restDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.008, 8, 8),
      new THREE.MeshStandardMaterial({ color: Pal.rodRed, roughness: 0.4, metalness: 0.15 })
    );
    restDot.position.set(0.12, 0.05, 0.04);
    rest.add(restDot);
    rest.position.set(0.35, deckTop + 0.02, 2.18);
    rest.scale.setScalar(1.45);
    rest.rotation.y = 0.08;
    scene.add(rest);

    addSeatTackle(deckTop);

    // No decorative shrimp in pool (Louis: 池入面嘅蝦可以唔要)

        game.sceneReady = true;
    window.addEventListener("resize", onResize);
    animate();
    return true;
  }

  function makeTileTexture(size, c1, c2, div) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const cell = size / div;
    for (let y = 0; y < div; y++) {
      for (let x = 0; x < div; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? c1 : c2;
        ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
        ctx.strokeStyle = "rgba(0,0,0,0.08)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x * cell, y * cell, cell, cell);
      }
    }
    // slight dirt
    ctx.fillStyle = "rgba(80,70,50,0.04)";
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size, Math.random() * 8, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeNoiseTexture(size, c1, c2) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 800; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? c2 : "rgba(255,255,255,0.04)";
      ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    return tex;
  }

  function makeMarbleTexture(size) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#e6ddd2";
    ctx.fillRect(0, 0, size, size);
    // Warm stone veins, matching the light coping in the reference.
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = `rgba(${110 + Math.random() * 30},${102 + Math.random() * 24},${92 + Math.random() * 20},${0.16 + Math.random() * 0.16})`;
      ctx.lineWidth = 2 + Math.random() * 4;
      ctx.beginPath();
      let x = Math.random() * size;
      let y = 0;
      ctx.moveTo(x, y);
      while (y < size) {
        x += (Math.random() - 0.5) * 30;
        y += 8 + Math.random() * 12;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(Math.random() * size, Math.random() * size, 3, 3);
    }
    const tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeWoodTexture(size) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#b89870";
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 3) {
      ctx.fillStyle = `rgba(80,50,25,${0.04 + Math.random() * 0.08})`;
      ctx.fillRect(0, y, size, 2);
    }
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = "rgba(60,40,20,0.15)";
      ctx.beginPath();
      ctx.moveTo(0, Math.random() * size);
      ctx.bezierCurveTo(size * 0.3, Math.random() * size, size * 0.7, Math.random() * size, size, Math.random() * size);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makePoolTileMaterial(tilesX, tilesY) {
    const size = 128;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const grout = Math.round(size * 0.07);
    ctx.fillStyle = "#8e959c";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#d4d9de";
    ctx.fillRect(grout, grout, size - grout * 2, size - grout * 2);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(grout, grout, size - grout * 2, Math.max(2, grout));
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, tilesX), Math.max(1, tilesY));
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex,
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0.02,
    });
  }

  function makeFloorTileTexture(size) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const div = 4;
    const cell = size / div;
    const grout = Math.max(4, Math.round(size * 0.018));
    ctx.fillStyle = "#b7bcc2";
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < div; y++) {
      for (let x = 0; x < div; x++) {
        const dark = (x + y) % 2 === 0;
        const base = dark ? 176 : 206;
        const shade = base + Math.floor(Math.random() * 10) - 4;
        ctx.fillStyle = `rgb(${shade},${shade + 1},${shade + 4})`;
        const px = x * cell + grout;
        const py = y * cell + grout;
        const tw = cell - grout * 2;
        const th = cell - grout * 2;
        ctx.fillRect(px, py, tw, th);
        ctx.fillStyle = dark ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.14)";
        ctx.fillRect(px, py, tw, Math.max(2, grout));
      }
    }
    const tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeCorrugatedTexture(size) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#e7e2da";
    ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 6) {
      ctx.fillStyle = x % 12 === 0 ? "rgba(255,255,255,0.22)" : "rgba(22,19,17,0.04)";
      ctx.fillRect(x, 0, 3, size);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = "rgba(60,60,70,0.04)";
      ctx.fillRect(Math.random() * size, Math.random() * size, 8, 8);
    }
    const tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Placeholder ad art — or sponsor creative from PrawnSponsors */
  function makeAdPanelTexture(w, h, style, creative) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    const styles = {
      green: { bg: "#1f6b3a", accent: "#d7efe0", title: "夜貓資訊" },
      logo: { bg: Pal.hex(Pal.sign), accent: Pal.hex(Pal.signGold), title: "夜貓釣蝦場" },
      black: { bg: "#f7f4ef", accent: "#c51628", title: "廣告招租" },
      teal: { bg: Pal.hex(Pal.sea), accent: Pal.hex(Pal.brush), title: "新鮮活蝦" },
      side: { bg: "#24303c", accent: Pal.hex(Pal.seaButton), title: "廣告位" },
    };
    if (creative) {
      ctx.fillStyle = creative.bg || "#222";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = creative.accent || "#fff";
      ctx.font = "bold 36px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(creative.title || "SPONSOR", 36, 64);
      if (creative.subtitle) {
        ctx.font = "22px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        if ((creative.bg || "").toLowerCase().indexOf("f") === 1 || (creative.bg || "").length > 5 && parseInt((creative.bg || "#000").slice(1, 3), 16) > 180) {
          ctx.fillStyle = "rgba(0,0,0,0.55)";
        }
        ctx.fillText(creative.subtitle, 36, 100);
      }
      if (creative.lines && creative.lines.length) {
        ctx.font = "22px sans-serif";
        ctx.fillStyle = creative.accent || "#eee";
        creative.lines.forEach((line, i) => ctx.fillText(line, 40, 130 + i * 40));
      }
      ctx.font = "bold 22px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillText(creative.footer || "SPONSOR", 36, h - 36);
      const texS = new THREE.CanvasTexture(c);
      if (THREE.SRGBColorSpace) texS.colorSpace = THREE.SRGBColorSpace;
      return texS;
    }
    const s = styles[style] || styles.side;
    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, w, h);

    // border
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    if (style === "green") {
      ctx.fillStyle = "#e8fff0";
      ctx.font = "bold 36px sans-serif";
      ctx.fillText(s.title, 36, 64);
      ctx.font = "22px sans-serif";
      ["· 入場請戴手套", "· 池邊小心濕滑", "· 廣告合作洽詢"].forEach((line, i) => {
        ctx.fillText(line, 40, 120 + i * 42);
      });
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText("廣告位 · AD", w - 200, h - 36);
    } else if (style === "logo") {
      ctx.fillStyle = s.accent;
      ctx.beginPath();
      ctx.arc(w * 0.35, h * 0.45, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.ellipse(w * 0.35, h * 0.45, 48, 22, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#222";
      ctx.font = "bold 32px sans-serif";
      ctx.fillText(s.title, w * 0.55, h * 0.42);
      ctx.font = "20px sans-serif";
      ctx.fillStyle = "#666";
      ctx.fillText("AD SLOT", w * 0.55, h * 0.55);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("廣告位", 36, h - 36);
    } else if (style === "black") {
      ctx.strokeStyle = s.accent;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.42, 78, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.42, 52, 24, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.accent;
      ctx.font = "bold 40px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(s.title, w * 0.5, h * 0.78);
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText("廣告位 · AD PANEL", w * 0.5, h - 28);
      ctx.textAlign = "left";
    } else if (style === "teal") {
      ctx.fillStyle = s.accent;
      ctx.beginPath();
      ctx.ellipse(w * 0.28, h * 0.5, 70, 32, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 44px sans-serif";
      ctx.fillText(s.title, w * 0.48, h * 0.42);
      ctx.font = "24px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText("品牌牆 · 可換海報", w * 0.48, h * 0.58);
      ctx.font = "bold 26px sans-serif";
      ctx.fillText("廣告位", 36, h - 36);
    } else {
      // side
      const grd = ctx.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, "#1a1f28");
      grd.addColorStop(1, "#243044");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = s.accent;
      ctx.lineWidth = 4;
      ctx.setLineDash([16, 12]);
      ctx.strokeRect(24, 24, w - 48, h - 48);
      ctx.setLineDash([]);
      ctx.fillStyle = s.accent;
      ctx.font = "bold 48px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("廣告位", w / 2, h / 2 - 10);
      ctx.font = "22px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText("AD SPACE · 可租用", w / 2, h / 2 + 36);
      ctx.textAlign = "left";
    }

    const tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  function makeShrimpMesh(scale) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: Pal.prawn,
      roughness: 0.42,
      metalness: 0.02,
      transparent: true,
      opacity: 0.86,
    });
    const matDark = new THREE.MeshStandardMaterial({
      color: Pal.prawnDark,
      roughness: 0.5,
      transparent: true,
      opacity: 0.9,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat);
    body.scale.set(scale * 1.7, scale * 0.85, scale * 0.95);
    body.castShadow = true;
    g.add(body);
    // segments
    for (let i = 1; i <= 3; i++) {
      const seg = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), matDark);
      seg.scale.set(scale * (1.1 - i * 0.15), scale * 0.7, scale * 0.75);
      seg.position.x = -scale * (0.9 + i * 0.55);
      g.add(seg);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(scale * 0.65, scale * 1.2, 5), matDark);
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -scale * 2.5;
    g.add(tail);
    const clawMat = new THREE.MeshStandardMaterial({ color: Pal.claw, roughness: 0.4 });
    const claw = new THREE.Mesh(new THREE.BoxGeometry(scale * 1.0, scale * 0.22, scale * 0.22), clawMat);
    claw.position.set(scale * 1.15, scale * 0.25, scale * 0.45);
    g.add(claw);
    const claw2 = claw.clone();
    claw2.position.z = -scale * 0.45;
    g.add(claw2);
    // slight translucency feel via opacity on a shell plate
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshStandardMaterial({
        color: Pal.prawnShell,
        transparent: true,
        opacity: 0.28,
        roughness: 0.3,
      })
    );
    shell.scale.set(scale * 1.75, scale * 0.5, scale);
    shell.position.y = scale * 0.25;
    g.add(shell);
    return g;
  }

  function onResize() {
    if (!renderer || !camera) return;
    const wrap = $("canvas-wrap");
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    camera.aspect = w / Math.max(1, h);
    applyHomeCamera();
    renderer.setSize(w, h);
  }

  function updateLine() {
    const line = scene.getObjectByName("fishLine");
    const tipBall = rodTip.getObjectByName("tipBall");
    if (!line || !tipBall) return;
    const a = tipBall.getWorldPosition(new THREE.Vector3());
    const b = floatMesh.visible
      ? floatMesh.getWorldPosition(new THREE.Vector3())
      : a.clone().add(new THREE.Vector3(0, -0.3, -0.5));
    const pos = line.geometry.attributes.position;
    pos.setXYZ(0, a.x, a.y, a.z);
    pos.setXYZ(1, b.x, b.y, b.z);
    pos.needsUpdate = true;
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!renderer) return;
    const t = performance.now() / 1000;
    game.clock = t;

    // Water surface ripple (plane local Z → world Y after -90° X rot)
    if (waterMesh) {
      const pos = waterMesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z =
          Math.sin(x * 2.1 + t * 1.6) * 0.028 +
          Math.cos(y * 2.4 + t * 1.3) * 0.02 +
          Math.sin((x + y) * 1.1 + t * 0.7) * 0.012;
        pos.setZ(i, z);
      }
      pos.needsUpdate = true;
      waterMesh.geometry.computeVertexNormals();
    }
    // Rising bubbles (all aerator clusters)
    if (poolGroup) {
      poolGroup.traverse((obj) => {
        if (obj.name !== "bubbles" || !obj.geometry) return;
        const pos = obj.geometry.attributes.position;
        const top = obj.userData.waterY;
        const bot = obj.userData.bottomY;
        for (let i = 0; i < pos.count; i++) {
          let y = pos.getY(i) + 0.022 + (i % 5) * 0.002;
          if (y > top - 0.02) y = bot;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      });
    }

    // Ambient shrimp swim
    shrimpMeshes.forEach((s, i) => {
      const ph = s.userData.phase + t * s.userData.speed;
      s.position.x += Math.sin(ph) * 0.003;
      s.position.z += Math.cos(ph * 0.8) * 0.002;
      s.rotation.y = Math.sin(ph) * 0.5 + Math.PI;
      if (Math.abs(s.position.x) > 2) s.position.x *= -0.95;
      if (Math.abs(s.position.z) > 1.2) s.position.z *= -0.95;
    });

    // Wow time scale (land slow-mo)
    const nowMs = performance.now();
    let timeScale = 1;
    if (game.wow.slowUntil && nowMs < game.wow.slowUntil) {
      timeScale = (Wow.land && Wow.land.slowMoScale) || 0.35;
    }
    const dt = (1 / 60) * timeScale;

    // Camera push-in on bite
    if (camera && game.camHome) {
      let push = 0;
      if (game.wow.biteUntil && nowMs < game.wow.biteUntil) {
        const u = 1 - (game.wow.biteUntil - nowMs) / ((Wow.bite && Wow.bite.cameraMs) || 420);
        const wave = Math.sin(Math.min(1, Math.max(0, u)) * Math.PI);
        push = (game.wow.camPush || 0.25) * wave;
      }
      const look = game.camLook || new THREE.Vector3(0, 0.7, -0.55);
      const dir = look.clone().sub(game.camHome).normalize();
      // Home pose is farther than the original ~4.7m; keep the bite push readable.
      const distScale = Math.min(2.4, Math.max(1, game.camHome.distanceTo(look) / 4.65));
      camera.position.copy(game.camHome).add(dir.multiplyScalar(push * distScale));
      camera.lookAt(look);
    }

    // Splash particles
    if (game.splash && game.splash.length) {
      for (let i = game.splash.length - 1; i >= 0; i--) {
        const p = game.splash[i];
        p.life -= dt;
        p.vel.y -= 2.8 * dt;
        p.mesh.position.x += p.vel.x * dt;
        p.mesh.position.y += p.vel.y * dt;
        p.mesh.position.z += p.vel.z * dt;
        p.mesh.material.opacity = Math.max(0, p.life * 1.2);
        if (p.life <= 0) {
          scene.remove(p.mesh);
          if (p.mesh.geometry) p.mesh.geometry.dispose();
          if (p.mesh.material) p.mesh.material.dispose();
          game.splash.splice(i, 1);
        }
      }
    }

    // Float bob / sink
    if (floatMesh && floatMesh.visible) {
      floatBob.phase += 0.05 * (timeScale < 1 ? 0.5 : 1);
      let y = (game.waterY || 0.38) + 0.02;
      if (game.state === STATE.WAITING || game.state === STATE.TEASING) {
        y += Math.sin(floatBob.phase) * floatBob.amp;
      } else if (game.state === STATE.BITE_TEASE) {
        y += Math.sin(floatBob.phase * 3) * 0.04 - 0.02;
      } else if (game.state === STATE.BITE_SINK) {
        floatBob.sink = Math.min(0.22, floatBob.sink + 0.018);
        y -= floatBob.sink;
        // 阿波急頓
        floatMesh.rotation.x = -floatBob.sink * 1.2;
      } else if (game.state === STATE.FIGHTING) {
        y += Math.sin(t * 8) * 0.03 - 0.08;
        floatMesh.rotation.x = 0;
      } else {
        floatMesh.rotation.x = 0;
      }
      floatMesh.position.y = y;
      floatMesh.rotation.z = Math.sin(floatBob.phase * 0.7) * 0.08;
    }

    // Rod subtle sway
    if (rodTip) {
      rodTip.rotation.z = Math.sin(t * 1.1) * 0.02;
      if (game.state === STATE.FIGHTING && game.fight.holding) {
        rodTip.rotation.z -= 0.08;
      }
      if (game.wow.biteUntil && nowMs < game.wow.biteUntil) {
        rodTip.rotation.z -= 0.05;
      }
    }

    if (game.state === STATE.FIGHTING) updateFight(dt);

    updateLine();
    renderer.render(scene, camera);
  }

  // ——— Gameplay ———
  function setButtons() {
    const s = game.state;
    btnCast.disabled = s !== STATE.IDLE;
    btnTease.disabled = s !== STATE.WAITING;
    btnStrike.disabled = !(
      s === STATE.WAITING ||
      s === STATE.TEASING ||
      s === STATE.BITE_TEASE ||
      s === STATE.BITE_SINK ||
      s === STATE.FIGHTING
    );
  }

  function cast() {
    if (game.state !== STATE.IDLE) return;
    game.state = STATE.CASTING;
    setStatus("拋竿中…");
    setButtons();
    floatBob.sink = 0;
    game.castUsedTease = false;
    game.pendingSpecies = null;
    game.pendingMatch = null;
    game.lastCatchFeedback = [];
    if (game.rebuildFloat) game.rebuildFloat((pick.float && pick.float.style) || "apo");
    floatMesh.visible = true;
    // Seat offset
    const offsets = { A: [0.2, 0.0], B: [-1.2, -0.6], C: [1.3, 0.5] };
    const o = offsets[pick.seat.id] || [0, 0];
    floatMesh.position.x = o[0] + rand(-0.15, 0.15);
    floatMesh.position.z = o[1] + rand(-0.1, 0.1);

    setTimeout(() => {
      game.state = STATE.WAITING;
      setStatus("等蝦 · 盯住浮標");
      setButtons();
      const depthName = (pick.depth && pick.depth.name) || "中水";
      toast("餌已落水（" + depthName + "），等訊號…");
      scheduleBite();
    }, 600);
  }

  function scheduleBite() {
    clearBiteTimer();
    const base = rand(2800, 7500) / biteRate();
    game.biteTimer = setTimeout(() => beginBiteSequence(), base);
  }

  function beginBiteSequence() {
    if (game.state !== STATE.WAITING && game.state !== STATE.TEASING) return;

    const approaching = chooseApproachingSpecies();
    const match = game.pendingMatch || { bite: 1, hook: 1, escape: 1, fight: 1 };
    const depthFalse = (pick.depth && pick.depth.falseBiteMul) || 1;

    // False bite on wall seat sometimes (hide species → fewer false, aggressive → more nibble)
    let falseP = (pick.seat.falseBite || 0) * (1.2 - (pick.float.signal || 1) * 0.2) * depthFalse;
    if (approaching) {
      falseP *= 0.85 + (1 - approaching.personality.hide) * 0.3;
    }
    if (chance(falseP)) {
      game.state = STATE.BITE_TEASE;
      setStatus("浮標郁動…？");
      setButtons();
      setTimeout(() => {
        if (game.state === STATE.BITE_TEASE) {
          game.state = STATE.WAITING;
          setStatus("假訊 · 繼續等");
          setButtons();
          game.pendingSpecies = null;
          game.pendingMatch = null;
          scheduleBite();
        }
      }, 700);
      return;
    }

    // Tease dips then clear sink — shy species tease longer
    game.state = STATE.BITE_TEASE;
    const hide = approaching ? approaching.personality.hide : 0.4;
    setStatus(approaching && approaching.rarity !== "common" ? "有動靜…" : "試探中…");
    setButtons();
    const teaseMs = rand(600, 1400) * (0.85 + hide * 0.4);
    game.biteTimer = setTimeout(() => {
      if (game.state !== STATE.BITE_TEASE) return;
      game.state = STATE.BITE_SINK;
      floatBob.sink = 0;
      setStatus("滅頂！！");
      biteFlash.classList.add("show");
      setButtons();
      triggerBiteWow();
      const strike = Tech.STRIKE || { baseWindowMs: 900 };
      const windowMs =
        (strike.baseWindowMs || 900) *
        pick.rod.windowMul *
        pick.float.signal *
        (0.9 + (match.hook - 1) * 0.25);
      game.biteTimer = setTimeout(() => {
        if (game.state === STATE.BITE_SINK) {
          biteFlash.classList.remove("show");
          const name = approaching ? approaching.nameZh : "蝦";
          failCatch("放槍喇", "滅頂窗口過咗，" + name + "走咗。");
        }
      }, windowMs);
    }, teaseMs);
  }

  function tease() {
    if (game.state !== STATE.WAITING) return;
    game.state = STATE.TEASING;
    setStatus("逗蝦中…");
    setButtons();
    clearBiteTimer();
    game.castUsedTease = true;
    floatBob.amp = 0.035;
    const teaseCfg = Tech.TEASE || {};
    const now = Date.now();
    const cooled =
      game.lastTeaseAt && now - game.lastTeaseAt < (teaseCfg.cooldownMs || 1800);
    game.lastTeaseAt = now;
    setTimeout(() => {
      floatBob.amp = 0.015;
      if (game.state !== STATE.TEASING) return;
      // Sample a ghost species for tease response feel
      const ghost = chooseApproachingSpecies();
      let boost = (teaseCfg.baseBoost || 0.35) + (pick.seat.teaseBonus || 0);
      if (ghost) {
        boost += (ghost.personality.aggression || 0) * (teaseCfg.aggressionScale || 0.25);
        boost += (ghost.personality.hide || 0) * (teaseCfg.hideScale || 0.15);
      }
      if (cooled) boost *= teaseCfg.cooldownPenalty || 0.55;
      if (chance(boost * biteRate() * 0.5)) {
        beginBiteSequence();
      } else {
        game.state = STATE.WAITING;
        setStatus("未咬 · 再等");
        setButtons();
        game.pendingSpecies = null;
        game.pendingMatch = null;
        scheduleBite();
      }
    }, 500);
  }

  function strikeDown() {
    const strike = Tech.STRIKE || { earlyBase: 0.22, blindBase: 0.08, sinkGood: 0.04, goodHookFloor: 0.55 };
    const match = game.pendingMatch || { hook: 1 };
    if (game.state === STATE.BITE_SINK || game.state === STATE.BITE_TEASE) {
      if (game.state === STATE.BITE_TEASE) {
        clearBiteTimer();
        biteFlash.classList.remove("show");
        const earlyP = (strike.earlyBase || 0.22) * pick.rod.windowMul * match.hook;
        if (chance(earlyP)) {
          game.lastStrikePerfect = false;
          startFight(rollShrimp(true));
        } else {
          failCatch("早槍", "仲喺度試探，未滅頂就開槍。");
        }
        return;
      }
      clearBiteTimer();
      biteFlash.classList.remove("show");
      const sinkProgress = floatBob.sink;
      const good = sinkProgress > (strike.sinkGood || 0.04);
      const hookP = (strike.goodHookFloor || 0.55) * match.hook;
      if (good || chance(hookP)) {
        game.lastStrikePerfect = !!good;
        if (good) {
          spawnSplash(floatMesh && floatMesh.position, 8);
          showWowStamp("好槍！");
          haptic(20);
        }
        startFight(rollShrimp(false));
      } else {
        const nm = game.pendingSpecies ? game.pendingSpecies.nameZh : "蝦";
        failCatch("刺空", "槍慢半拍，" + nm + "甩嘴走咗。");
      }
      return;
    }
    if (game.state === STATE.WAITING || game.state === STATE.TEASING) {
      clearBiteTimer();
      // Blind — spawn a random species if lucky
      if (!game.pendingSpecies) chooseApproachingSpecies();
      if (chance((strike.blindBase || 0.08) * match.hook)) {
        game.lastStrikePerfect = false;
        startFight(rollShrimp(true));
      } else {
        failCatch("盲槍", "浮標未有訊號就開槍，嚇走晒。");
        game.pendingSpecies = null;
        game.pendingMatch = null;
      }
      return;
    }
    if (game.state === STATE.FIGHTING) {
      game.fight.holding = true;
    }
  }

  function strikeUp() {
    if (game.state === STATE.FIGHTING) {
      game.fight.holding = false;
    }
  }

  function rollShrimp(early) {
    if (!game.pendingSpecies) chooseApproachingSpecies();
    const sp = game.pendingSpecies;
    const match = game.pendingMatch || { fight: 1, apoBand: "mid" };
    const sizeBonus = (pick.bait.sizeBonus || 0) + (pick.seat.sizeBonus || 0);

    let liang;
    if (sp && sp.weightLiang) {
      const lo = sp.weightLiang[0];
      const hi = sp.weightLiang[1];
      liang = rand(lo, hi) * (1 + sizeBonus * 0.5) * (early ? 0.9 : 1);
      if (sp.rarity === "rare" || sp.rarity === "legend") {
        if (chance(0.12)) liang *= 1.15;
      } else if (chance(0.08)) {
        liang *= 1.25;
      }
    } else {
      let grams = rand(18, 55) * (1 + sizeBonus) * (early ? 0.85 : 1);
      liang = grams / 37.5;
    }
    liang = Math.round(liang * 100) / 100;
    const grams = Math.round(Spec.liangToGrams(liang) * 10) / 10;
    const label = sp ? sp.nameZh : "沼蝦";
    return {
      grams,
      liang,
      label,
      id: Date.now(),
      speciesId: sp ? sp.id : null,
      rarity: sp ? sp.rarity : "common",
      fightStrength: (sp && sp.fightStrength) || 1,
      escapeChance: (sp && sp.escapeChance) || 0.12,
      matchFight: match.fight || 1,
      matchEscape: match.escape || 1,
      apoBand: match.apoBand || "mid",
      depthId: pick.depth ? pick.depth.id : "mid",
      baitId: pick.bait ? pick.bait.id : "aka",
      usedTease: !!game.castUsedTease,
      matchNotes: (match.notes || []).slice(),
    };
  }

  function startFight(shrimp) {
    game.state = STATE.FIGHTING;
    const strength = (shrimp.fightStrength || 1) * (shrimp.matchFight || 1);
    // Stronger shrimp → lower ease (harder to fill progress), wilder target
    const ease = pick.rod.fightEase / Math.sqrt(strength);
    game.fight = {
      tension: 0.35,
      target: rand(0.38, 0.58),
      holding: false,
      progress: 0,
      shrimp,
      time: 0,
      ease,
      strength,
      escapeMul: shrimp.matchEscape || 1,
    };
    setStatus("搏蝦中！按住拉、鬆開放");
    tensionWrap.classList.add("show");
    setButtons();
    const tip = shrimp.label ? "搏住「" + shrimp.label + "」！" : "搏住佢！";
    toast(tip + " 睇張力", "alert");
  }

  function updateFight(dt) {
    const f = game.fight;
    f.time += dt;
    const strength = f.strength || 1;
    const escapeMul = f.escapeMul || 1;
    // Stronger shrimp pulls harder
    f.target += (Math.random() - 0.5) * (0.04 * strength);
    f.target = Math.max(0.22, Math.min(0.78, f.target));

    if (f.holding) {
      f.tension += 0.55 * dt * f.ease;
    } else {
      f.tension -= 0.35 * dt * (0.9 + escapeMul * 0.1);
    }
    f.tension += (f.target - 0.5) * 0.15 * dt * strength;
    f.tension = Math.max(0, Math.min(1, f.tension));

    if (f.tension >= 0.32 && f.tension <= 0.72) {
      f.progress += dt * 0.28 * f.ease;
    } else {
      f.progress -= dt * 0.05 * escapeMul;
      // Soft escape rolls when outside sweet zone
      const esc = (f.shrimp && f.shrimp.escapeChance) || 0.12;
      if (f.time > 2.5 && chance(esc * escapeMul * dt * 0.15)) {
        endFight(false, "脫鈎", (f.shrimp && f.shrimp.label ? f.shrimp.label : "蝦") + "掙扎脫鈎走咗。");
        return;
      }
    }

    tensionFill.style.width = (f.tension * 100).toFixed(1) + "%";
    let label = "適中";
    let hint = "按住拉緊 · 鬆開放線";
    if (f.tension < 0.28) {
      label = "太鬆";
      hint = "快啲拉！唔係走蝦";
      tensionState.style.color = "var(--amber-soft)";
    } else if (f.tension > 0.78) {
      label = "太緊";
      hint = "即刻放！唔係斷線";
      tensionState.style.color = "var(--danger)";
    } else {
      tensionState.style.color = "var(--warn)";
    }
    tensionState.textContent = label;
    tensionHint.textContent = hint + ` · 進度 ${Math.min(100, Math.floor(f.progress * 100))}%`;

    if (f.tension >= 0.95) {
      endFight(false, "斷線", "拉得太盡，子線啪一聲斷咗。");
      return;
    }
    if (f.tension <= 0.05 && f.time > 1.2) {
      endFight(false, "走蝦", "線太鬆，蝦脫鈎游走。");
      return;
    }
    if (f.progress >= 1) {
      endFight(true, null, null);
      return;
    }
    if (f.time > 16 + strength * 2) {
      endFight(false, "脫力", "搏太耐，蝦走咗。");
    }
  }

  function endFight(success, failTitle, failMsg) {
    tensionWrap.classList.remove("show");
    game.fight.holding = false;
    if (success) {
      const s = game.fight.shrimp;
      const firstBasket = game.basket.length === 0;
      game.basket.unshift(s);
      if (game.basket.length > 50) game.basket.pop();
      updateBasketUI();
      // 圖鑑 + 合約
      game.lastCatchFeedback = [];
      let contractsDone = 0;
      if (Prog && game.progress) {
        const info = {
          speciesId: s.speciesId,
          nameZh: s.label,
          rarity: s.rarity,
          liang: s.liang,
          apoBand: s.apoBand,
          depthId: s.depthId,
          baitId: s.baitId,
          usedTease: s.usedTease,
        };
        const res = Prog.recordCatch(game.progress, info);
        game.lastCatchFeedback = res.feedback || [];
        contractsDone = (res.contractUpdates || []).filter((c) => c.done).length;
        updateProgressUI();
      }
      // Soft currency (not P2W)
      if (Shop && game.shop) {
        const earned = Shop.earnForCatch(game.shop, s);
        if (earned.gained) {
          game.lastCatchFeedback.push("＋" + earned.gained + " 夜幣");
        }
        if (contractsDone) {
          const ce = Shop.earnForContract(game.shop, contractsDone);
          if (ce.gained) game.lastCatchFeedback.push("合約獎 ＋" + ce.gained + " 夜幣");
        }
        updateShopUI();
      }
      // Land wow (<3s)
      if (game.lastStrikePerfect) triggerLandWow("perfect");
      else if (firstBasket) triggerLandWow("first");
      else triggerLandWow("land");
      showResult(true, s);
    } else {
      failCatch(failTitle, failMsg);
    }
    game.pendingSpecies = null;
    game.pendingMatch = null;
  }

  function failCatch(title, msg) {
    game.state = STATE.RESOLVE;
    biteFlash.classList.remove("show");
    tensionWrap.classList.remove("show");
    floatMesh.visible = false;
    setStatus("失敗");
    setButtons();
    game.pendingSpecies = null;
    game.pendingMatch = null;
    toast((title ? title + " · " : "") + (msg || ""), "alert");
    showResult(false, null, title, msg);
  }

  function showResult(ok, shrimp, title, msg) {
    game.state = STATE.RESOLVE;
    floatMesh.visible = false;
    clearBiteTimer();
    biteFlash.classList.remove("show");
    const card = $("result-card");
    if (ok && shrimp) {
      const rarityZh = (Spec.RARITY_ZH && Spec.RARITY_ZH[shrimp.rarity]) || "";
      const notes = (shrimp.matchNotes || []).slice(0, 2).join(" · ");
      const fb = (game.lastCatchFeedback || []).map((x) => "· " + x).join("<br/>");
      card.className = "result-card";
      if (game.shop && game.shop.equipped && game.shop.equipped.frame) {
        card.classList.add(game.shop.equipped.frame);
      }
      card.innerHTML = `
        <div class="photo" aria-hidden="true"></div>
        <div class="title">中！${shrimp.label}</div>
        <div class="meta">${rarityZh ? rarityZh + " · " : ""}${shrimp.grams} g　·　${shrimp.liang.toFixed(2)} 兩<br/>已放入蝦簍${notes ? "<br/>" + notes : ""}</div>
        ${fb ? '<div class="feedback">' + fb + "</div>" : ""}
        <div class="stamp">夜貓釣蝦場 · 漁獲紀錄</div>`;
      setStatus("收蝦成功");
      const extra = game.lastCatchFeedback && game.lastCatchFeedback.length ? " · " + game.lastCatchFeedback[0] : "";
      toast(`收穫 ${shrimp.label} ${shrimp.liang.toFixed(2)} 兩` + extra, "ok");
    } else {
      card.innerHTML = `
        <div class="photo fail" aria-hidden="true"></div>
        <div class="title fail">${title || "空槍"}</div>
        <div class="meta">${msg || "今鋪冇事，再嚟過。"}</div>`;
    }
    $("modal-result").classList.remove("hidden");
    setButtons();
  }

  function resetToIdle() {
    $("modal-result").classList.add("hidden");
    game.state = STATE.IDLE;
    floatMesh.visible = false;
    floatBob.sink = 0;
    setStatus("待命");
    setButtons();
  }

  function bossRefill() {
    game.bossBoostUntil = Date.now() + 45000;
    bossBanner.classList.add("show");
    toast("老闆倒蝦！活躍度 ↑", "ok");
    if (game.state === STATE.WAITING) {
      clearBiteTimer();
      scheduleBite();
    }
  }

  // ——— Modals ———
  function openGuide() {
    $("modal-guide").classList.remove("hidden");
  }
  function closeGuide() {
    $("modal-guide").classList.add("hidden");
  }
  function openBasket() {
    $("modal-count").textContent = String(game.basket.length);
    $("modal-weight").textContent = game.basket
      .reduce((s, x) => s + x.liang, 0)
      .toFixed(1);
    const list = $("basket-list");
    list.innerHTML = "";
    if (!game.basket.length) {
      list.innerHTML = '<li style="color:var(--muted);justify-content:center">蝦簍仲空呀</li>';
    } else {
      game.basket.slice(0, 12).forEach((s, i) => {
        const li = document.createElement("li");
        const rar = s.rarity && Spec.RARITY_ZH ? Spec.RARITY_ZH[s.rarity] : "";
        li.innerHTML = `<span>#${i + 1} ${s.label}${rar ? " · " + rar : ""}</span><span>${s.liang.toFixed(2)} 兩 · ${s.grams}g</span>`;
        list.appendChild(li);
      });
    }
    $("modal-basket").classList.remove("hidden");
  }
  function closeBasket() {
    $("modal-basket").classList.add("hidden");
  }

  // ——— Wire UI ———
  function hideSplash() {
    if (!splashEl || splashEl.classList.contains("hidden")) return;
    splashEl.classList.add("hidden");
    splashEl.setAttribute("aria-hidden", "true");
    setupEl.removeAttribute("aria-hidden");
    setupEl.removeAttribute("inert");
    const startBtn = $("btn-start");
    if (startBtn) startBtn.focus();
  }
  if (splashEl) {
    splashEl.addEventListener("click", hideSplash);
  }

  $("btn-start").addEventListener("click", () => {
    setupEl.classList.add("hidden");
    hudEl.classList.remove("hidden");
    if (!game.sceneReady) {
      if (!initScene()) return;
    }
    game.state = STATE.IDLE;
    setStatus("待命 · 可以拋竿");
    setButtons();
    updateProgressUI();
    updateShopUI();
    let startMsg = `${pick.seat.name} · ${pick.depth.name} · ${pick.bait.name}`;
    if (Shop && game.shop && Shop.passEffects(game.shop).prioritySeatFluff) {
      startMsg += " · 月卡優先留枱";
    }
    toast(startMsg);
  });

  btnCast.addEventListener("click", cast);
  btnTease.addEventListener("click", tease);

  btnStrike.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    strikeDown();
  });
  btnStrike.addEventListener("pointerup", (e) => {
    e.preventDefault();
    strikeUp();
  });
  btnStrike.addEventListener("pointerleave", () => strikeUp());
  btnStrike.addEventListener("pointercancel", () => strikeUp());

  window.addEventListener("keydown", (e) => {
    if (splashEl && !splashEl.classList.contains("hidden") && (e.code === "Enter" || e.code === "Space")) {
      e.preventDefault();
      hideSplash();
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      if (e.repeat) {
        if (game.state === STATE.FIGHTING) game.fight.holding = true;
        return;
      }
      strikeDown();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      strikeUp();
    }
  });

  $("btn-guide").addEventListener("click", openGuide);
  $("btn-guide-close").addEventListener("click", closeGuide);
  $("modal-guide").addEventListener("click", (e) => {
    if (e.target.id === "modal-guide") closeGuide();
  });

  if ($("btn-contracts")) {
    $("btn-contracts").addEventListener("click", openContracts);
    $("btn-contracts-close").addEventListener("click", closeContracts);
    $("modal-contracts").addEventListener("click", (e) => {
      if (e.target.id === "modal-contracts") closeContracts();
    });
  }
  if ($("btn-dex")) {
    $("btn-dex").addEventListener("click", openDex);
    $("btn-dex-close").addEventListener("click", closeDex);
    $("modal-dex").addEventListener("click", (e) => {
      if (e.target.id === "modal-dex") closeDex();
    });
  }
  if ($("btn-shop")) {
    $("btn-shop").addEventListener("click", openShop);
    $("btn-shop-close").addEventListener("click", closeShop);
    $("modal-shop").addEventListener("click", (e) => {
      if (e.target.id === "modal-shop") closeShop();
    });
  }

  $("btn-basket").addEventListener("click", openBasket);
  $("btn-basket-close").addEventListener("click", closeBasket);
  $("modal-basket").addEventListener("click", (e) => {
    if (e.target.id === "modal-basket") closeBasket();
  });

  $("btn-result-ok").addEventListener("click", resetToIdle);

  $("btn-boss").addEventListener("click", bossRefill);
  bossBanner.addEventListener("click", () => bossBanner.classList.remove("show"));

  function syncSoundLabel() {
    btnSound.textContent = game.soundOn ? "♪ 音效開" : "♪ 音效關";
    btnSound.setAttribute("aria-pressed", game.soundOn ? "true" : "false");
  }
  btnSound.addEventListener("click", () => {
    game.soundOn = !game.soundOn;
    syncSoundLabel();
    toast(game.soundOn ? "聲效開啟（第一版暫未有音效檔）" : "已靜音");
  });
  syncSoundLabel();

  // Initial button state before scene
  setButtons();
  updateProgressUI();
  updateShopUI();

  // Smoke / deep-link: ?autostart=1 → play view with float visible (no bite timer)
  // Optional: &panel=contracts|dex opens that modal after start
  const __params = new URLSearchParams(location.search);
  if (__params.get("autostart") === "1") {
    hideSplash();
    requestAnimationFrame(() => {
      $("btn-start").click();
      setTimeout(() => {
        try {
          if (game.rebuildFloat) game.rebuildFloat((pick.float && pick.float.style) || "apo");
          if (floatMesh) {
            floatMesh.visible = true;
            floatMesh.position.set(0.2, (game.waterY || 0.42) + 0.018, 0.05);
          }
          game.state = STATE.WAITING;
          setStatus("睇浮標 · 氣泡區");
          setButtons();
          updateLine();
          updateProgressUI();
          const panel = __params.get("panel");
          if (panel === "contracts") openContracts();
          else if (panel === "dex") openDex();
          else if (panel === "shop") openShop();
          const wowQ = __params.get("wow");
          if (wowQ === "bite") {
            game.state = STATE.BITE_SINK;
            floatBob.sink = 0.08;
            biteFlash.classList.add("show");
            triggerBiteWow();
            setStatus("滅頂！！");
          } else if (wowQ === "land") {
            triggerLandWow("perfect");
          }
        } catch (e) {}
      }, 700);
    });
  }
})();
