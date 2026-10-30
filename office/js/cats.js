import * as THREE from 'three';

/** 品種配色／特徵 */
const BREEDS = {
  calico: {
    body: 0xf2d2b6,
    belly: 0xfff5e8,
    patches: [0xe8913a, 0x2a2a2e, 0xf2d2b6],
    eyes: 0x4ecb71,
    earInner: 0xf5a8b8,
    scale: 1.0,
    earFold: false,
    fluff: 0.05,
    points: false,
    spots: true,
  },
  britishShorthair: {
    body: 0x8aa0b8,
    belly: 0xb0c0d0,
    patches: [],
    eyes: 0xd4a017,
    earInner: 0xc8a0b0,
    scale: 1.05,
    earFold: false,
    fluff: 0.12,
    points: false,
    spots: false,
  },
  maineCoon: {
    body: 0xb07a45,
    belly: 0xe8d0a8,
    patches: [0x8a5a30],
    eyes: 0x6ec6ff,
    earInner: 0xe8b0a0,
    scale: 1.22,
    earFold: false,
    fluff: 0.22,
    points: false,
    spots: false,
    tufts: true,
  },
  siamese: {
    body: 0xe8dcc8,
    belly: 0xf5efe4,
    patches: [],
    eyes: 0x4a90e2,
    earInner: 0xd4a090,
    scale: 0.95,
    earFold: false,
    fluff: 0.02,
    points: true,
    pointColor: 0x4a3528,
    spots: false,
  },
  abyssinian: {
    body: 0xc07840,
    belly: 0xe8c090,
    patches: [0xa06030],
    eyes: 0xb8e050,
    earInner: 0xe0a090,
    scale: 0.98,
    earFold: false,
    fluff: 0.04,
    points: false,
    spots: false,
  },
  russianBlue: {
    body: 0x7a8fa8,
    belly: 0xa8b8c8,
    patches: [],
    eyes: 0x50e090,
    earInner: 0xc0a0b0,
    scale: 1.0,
    earFold: false,
    fluff: 0.08,
    points: false,
    spots: false,
  },
  bengal: {
    body: 0xd4a04a,
    belly: 0xf0e0b8,
    patches: [0x5a3a18],
    eyes: 0x70d040,
    earInner: 0xe8a898,
    scale: 1.02,
    earFold: false,
    fluff: 0.03,
    points: false,
    spots: true,
    rosettes: true,
  },
  scottishFold: {
    body: 0x9aa0a8,
    belly: 0xd0d4d8,
    patches: [],
    eyes: 0xd4a017,
    earInner: 0xe8b0b8,
    scale: 0.96,
    earFold: true,
    fluff: 0.1,
    points: false,
    spots: false,
  },
  orangeTabby: {
    body: 0xe8913a,
    belly: 0xffe8c8,
    patches: [0xc87020],
    eyes: 0x50c878,
    earInner: 0xf0a0a8,
    scale: 1.0,
    earFold: false,
    fluff: 0.06,
    points: false,
    spots: false,
    stripes: true,
  },
  black: {
    body: 0x1a1a1e,
    belly: 0x2e2e34,
    patches: [],
    eyes: 0xe8c547,
    earInner: 0x4a3038,
    scale: 1.0,
    earFold: false,
    fluff: 0.05,
    points: false,
    spots: false,
  },
};

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.72,
    metalness: opts.metalness ?? 0.05,
    flatShading: true,
  });
}

function box(w, h, d, color, y = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function sphere(r, color, y = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat(color));
  m.scale.set(sx, sy, sz);
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * 低多邊形 chibi 貓：每品種唔同色、耳形、體型、斑點。
 * 回傳 Object3D；內部有 userData.parts 方便行路擺動。
 */
export function createCat(breedKey, accentHex) {
  const b = BREEDS[breedKey] || BREEDS.black;
  const root = new THREE.Group();
  root.scale.setScalar(b.scale * 0.55);

  const bodyColor = b.body;
  const bellyColor = b.belly;

  // 身體
  const torso = sphere(0.42, bodyColor, 0.55, 1.15, 0.95, 1.35);
  root.add(torso);

  const belly = sphere(0.28, bellyColor, 0.42, 1.0, 0.9, 1.1);
  belly.position.z = 0.12;
  root.add(belly);

  // 頭
  const head = new THREE.Group();
  head.position.set(0, 1.05, 0.18);
  root.add(head);

  const skull = sphere(0.36, bodyColor, 0, 1.05, 0.95, 1.0);
  head.add(skull);

  // 暹羅色點
  if (b.points) {
    const muzzle = sphere(0.14, b.pointColor, -0.08, 1.1, 0.8, 1.0);
    muzzle.position.z = 0.28;
    head.add(muzzle);
    const earL = makeEar(b, true);
    const earR = makeEar(b, false);
    earL.children[0].material = mat(b.pointColor);
    earR.children[0].material = mat(b.pointColor);
    head.add(earL, earR);
  } else {
    head.add(makeEar(b, true), makeEar(b, false));
  }

  // 眼
  const eyeGeo = new THREE.SphereGeometry(0.07, 8, 6);
  const eyeMat = mat(b.eyes, { roughness: 0.35 });
  const pupilMat = mat(0x111111);
  [-0.12, 0.12].forEach((x) => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(x, 0.04, 0.3);
    eye.scale.set(1, 1.15, 0.7);
    head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), pupilMat);
    pupil.position.set(x, 0.04, 0.36);
    pupil.scale.set(0.7, 1.2, 0.5);
    head.add(pupil);
  });

  // 鼻
  const nose = box(0.06, 0.04, 0.05, 0xf0a0b0, -0.05);
  nose.position.z = 0.36;
  head.add(nose);

  // 腳
  const legs = [];
  const legPositions = [
    [-0.22, 0.18, 0.22],
    [0.22, 0.18, 0.22],
    [-0.22, 0.18, -0.22],
    [0.22, 0.18, -0.22],
  ];
  for (const [x, y, z] of legPositions) {
    const leg = box(0.12, 0.36, 0.14, bodyColor, y);
    leg.position.x = x;
    leg.position.z = z;
    root.add(leg);
    legs.push(leg);
  }

  // 尾
  const tail = new THREE.Group();
  tail.position.set(0, 0.7, -0.45);
  const tailSeg1 = box(0.1, 0.12, 0.36, b.points ? b.pointColor : bodyColor, 0);
  tailSeg1.rotation.x = 0.4;
  const tailSeg2 = box(0.08, 0.1, 0.28, b.points ? b.pointColor : bodyColor, 0.08);
  tailSeg2.position.z = -0.28;
  tailSeg2.rotation.x = 0.5;
  tail.add(tailSeg1, tailSeg2);
  root.add(tail);

  // 斑點／條紋裝飾
  if (b.spots || b.rosettes || b.stripes || (b.patches && b.patches.length)) {
    addPattern(root, head, b);
  }

  // 緬因耳簇
  if (b.tufts) {
    head.children.filter((c) => c.userData?.isEar).forEach((ear) => {
      const tuft = box(0.04, 0.16, 0.04, bodyColor, 0.28);
      tuft.position.x = ear.position.x * 0.3;
      ear.add(tuft);
    });
  }

  // 名牌錨點（name above status; keep gap vs simulation LABEL_Y_*）
  const labelAnchor = new THREE.Object3D();
  labelAnchor.position.set(0, 1.85, 0);
  root.add(labelAnchor);

  // 狀態泡泡錨點（above name stack）
  const bubbleAnchor = new THREE.Object3D();
  bubbleAnchor.position.set(0, 2.45, 0);
  root.add(bubbleAnchor);

  // 品種強調環（地板色帶用 accent）
  if (accentHex) {
    root.userData.accent = new THREE.Color(accentHex);
  }

  root.userData.parts = { head, torso, legs, tail, labelAnchor, bubbleAnchor, breedKey };
  root.userData.breed = breedKey;
  return root;
}

function makeEar(b, left) {
  const g = new THREE.Group();
  g.userData.isEar = true;
  const x = left ? -0.22 : 0.22;
  g.position.set(x, 0.28, -0.02);
  if (b.earFold) {
    g.rotation.z = left ? 0.85 : -0.85;
    g.rotation.x = -0.5;
  } else {
    g.rotation.z = left ? 0.25 : -0.25;
  }
  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.28, 4),
    mat(b.body)
  );
  outer.castShadow = true;
  const inner = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.18, 4),
    mat(b.earInner)
  );
  inner.position.y = -0.02;
  inner.position.z = 0.02;
  g.add(outer, inner);
  return g;
}

function addPattern(root, head, b) {
  const colors = b.patches?.length ? b.patches : [0x5a3a18];
  const n = b.rosettes ? 6 : b.stripes ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const c = colors[i % colors.length];
    const patch = sphere(
      b.rosettes ? 0.08 : 0.07,
      c,
      0.55 + (i % 2) * 0.15,
      b.stripes ? 0.5 : 1,
      0.7,
      b.stripes ? 1.4 : 1
    );
    patch.position.x = ((i % 3) - 1) * 0.22;
    patch.position.z = (i < 3 ? 0.25 : -0.15) + (i % 2) * 0.05;
    root.add(patch);
  }
  // 頭上細斑
  const forehead = sphere(0.06, colors[0], 0.12, 1.2, 0.6, 0.8);
  forehead.position.z = 0.2;
  head.add(forehead);
}

/** 行路時腳／尾擺動 */
export function animateCatWalk(cat, t, speed = 1, moving = false) {
  const parts = cat.userData.parts;
  if (!parts) return;
  if (moving) {
    const swing = Math.sin(t * 10 * speed) * 0.35;
    parts.legs.forEach((leg, i) => {
      leg.rotation.x = (i % 2 === 0 ? 1 : -1) * swing;
    });
    parts.tail.rotation.y = Math.sin(t * 6 * speed) * 0.4;
    parts.torso.position.y = 0.55 + Math.abs(Math.sin(t * 10 * speed)) * 0.03;
  } else {
    parts.legs.forEach((leg) => { leg.rotation.x = 0; });
    parts.tail.rotation.y = Math.sin(t * 1.5) * 0.15;
    parts.torso.position.y = 0.55;
  }
  // 輕輕呼吸
  parts.head.position.y = 1.05 + Math.sin(t * 2 + ((cat.userData && cat.userData.seed) || 0)) * 0.01;
}

/** 坐下姿勢（喺工位） */
export function setCatSeated(cat, seated) {
  const parts = cat.userData.parts;
  if (!parts) return;
  if (seated) {
    cat.scale.y = cat.userData.baseScaleY * 0.85;
    parts.legs.forEach((leg) => {
      leg.scale.y = 0.55;
      leg.position.y = 0.08;
    });
  } else {
    cat.scale.y = cat.userData.baseScaleY;
    parts.legs.forEach((leg) => {
      leg.scale.y = 1;
      leg.position.y = 0.18;
    });
  }
}

export function rememberBaseScale(cat) {
  cat.userData.baseScaleY = cat.scale.y;
}
