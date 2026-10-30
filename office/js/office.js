import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AGENTS } from './agents.js';

const ROOM = { w: 22, d: 16, h: 3.2 };

function mesh(geo, color, opts = {}) {
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.75,
      metalness: opts.metalness ?? 0.05,
      transparent: !!opts.transparent,
      opacity: opts.opacity ?? 1,
      flatShading: opts.flat ?? false,
      side: opts.side ?? THREE.FrontSide,
    })
  );
  m.castShadow = opts.cast !== false;
  m.receiveShadow = opts.receive !== false;
  return m;
}

function makeBoardTexture(title, lines, opts = {}) {
  const w = opts.w || 512;
  const h = opts.h || 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // panel bg
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, opts.bgTop || '#1a2238');
  grad.addColorStop(1, opts.bgBot || '#121828');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // border
  ctx.strokeStyle = opts.border || '#7c6cf0';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  // accent bar
  ctx.fillStyle = opts.accent || '#7c6cf0';
  ctx.fillRect(18, 22, 10, 36);

  ctx.fillStyle = '#f3f4f6';
  ctx.font = 'bold 28px "Segoe UI", "PingFang HK", "Noto Sans TC", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 40, 40);

  ctx.font = '20px "Segoe UI", "PingFang HK", "Noto Sans TC", sans-serif';
  let y = 88;
  for (const line of lines) {
    if (typeof line === 'object') {
      ctx.fillStyle = line.color || '#c8d0e0';
      ctx.fillText(line.text, 36, y);
    } else {
      ctx.fillStyle = '#c8d0e0';
      ctx.fillText(line, 36, y);
    }
    y += 32;
    if (y > h - 24) break;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export class OfficeScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.waypoints = {};
    this.deskSlots = [];
    this.labelSprites = [];
    this._waveTime = 0;
    this._boardTick = 0;
    this._lastSnap = null;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87c8e8);
    this.scene.fog = new THREE.Fog(0x87c8e8, 36, 72);

    const aspect = window.innerWidth / window.innerHeight;
    const frustum = 11;
    this.camera = new THREE.OrthographicCamera(
      -frustum * aspect,
      frustum * aspect,
      frustum,
      -frustum,
      0.1,
      160
    );
    this.camera.position.set(18, 16, 18);
    this.camera.lookAt(0, 0.5, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.4, 0);
    this.controls.minZoom = 0.45;
    this.controls.maxZoom = 2.8;
    this.controls.maxPolarAngle = Math.PI / 2.15;
    this.controls.minPolarAngle = 0.35;
    this.controls.screenSpacePanning = true;

    this._lights();
    this._buildIsland();
    this._buildOcean();
    this._buildRoom();
    this._buildDesks();
    this._buildBossRoom();
    this._buildLounge();
    this._buildKitchen();
    this._buildAquariums();
    this._buildCatToys();
    this._buildInfoBoards();
    this._buildWaypoints();

    window.addEventListener('resize', () => this.onResize());
  }

  _lights() {
    this.hemi = new THREE.HemisphereLight(0xfff8ee, 0x4a7a88, 1.05);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff2d6, 1.55);
    this.sun.position.set(12, 18, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -28;
    this.sun.shadow.camera.right = 28;
    this.sun.shadow.camera.top = 28;
    this.sun.shadow.camera.bottom = -28;
    this.sun.shadow.bias = -0.0002;
    this.scene.add(this.sun);

    this.fill = new THREE.DirectionalLight(0xb8d0ff, 0.35);
    this.fill.position.set(-10, 8, -6);
    this.scene.add(this.fill);

    this.lamp = new THREE.PointLight(0xffd9a0, 0.0, 18, 2);
    this.lamp.position.set(0, 2.4, 0);
    this.scene.add(this.lamp);
  }

  _buildIsland() {
    const island = new THREE.Group();
    this.island = island;

    // sand base under office (slightly larger than room)
    const sand = mesh(
      new THREE.CylinderGeometry(15.5, 16.8, 0.55, 48),
      0xe8d4a8,
      { roughness: 0.95, cast: false }
    );
    sand.position.y = -0.4;
    island.add(sand);

    // rock rim ring (torus-ish via torus + scattered rocks)
    const rim = mesh(
      new THREE.TorusGeometry(15.2, 0.55, 8, 48),
      0x8a8070,
      { roughness: 0.92, cast: false, flat: true }
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.15;
    island.add(rim);

    // scattered rocks around shore
    for (let i = 0; i < 28; i++) {
      const ang = (i / 28) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const r = 14.2 + Math.random() * 1.8;
      const s = 0.25 + Math.random() * 0.55;
      const rock = mesh(
        new THREE.DodecahedronGeometry(s, 0),
        Math.random() > 0.5 ? 0x7a7468 : 0x958a78,
        { roughness: 0.95, cast: false, flat: true }
      );
      rock.position.set(Math.cos(ang) * r, -0.05 + s * 0.2, Math.sin(ang) * r);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      island.add(rock);
    }

    // small beach patches near corners
    [[-11, -8], [11, -7], [-10, 8], [12, 7]].forEach(([x, z]) => {
      const patch = mesh(
        new THREE.CylinderGeometry(1.4, 1.6, 0.12, 10),
        0xf0e0b8,
        { cast: false, roughness: 1 }
      );
      patch.position.set(x, -0.12, z);
      island.add(patch);
    });

    // coconut palms around island rim (~10) — larger, keep glass office view clear
    // scale ~1.55× prior (trunk 1.8→2.8, fronds 1.4→2.15)
    const palmSpots = [
      [-13.8, -4.2], [-14.2, 2.5], [-12.5, 9.2], [-7.5, 13.5],
      [3.5, 14.0], [11.5, 10.5], [14.2, 3.0], [13.5, -5.5],
      [8.5, -12.5], [-4.0, -13.8],
    ];
    const PALM_SCALE = 1.55;
    palmSpots.forEach(([x, z], pi) => {
      const h = 1.8 * PALM_SCALE;
      const trunkR0 = 0.12 * PALM_SCALE;
      const trunkR1 = 0.18 * PALM_SCALE;
      const trunk = mesh(
        new THREE.CylinderGeometry(trunkR0, trunkR1, h, 6),
        0x8b5a2b,
        { cast: false, flat: true }
      );
      trunk.position.set(x, h / 2 - 0.2, z);
      // slight lean away from office center
      trunk.rotation.z = Math.cos(pi) * 0.08;
      trunk.rotation.x = Math.sin(pi) * 0.06;
      island.add(trunk);
      const crownY = h - 0.25;
      const frondLen = 1.4 * PALM_SCALE;
      const frondW = 0.35 * PALM_SCALE;
      for (let k = 0; k < 6; k++) {
        const leaf = mesh(
          new THREE.BoxGeometry(frondLen, 0.08 * PALM_SCALE, frondW),
          k % 2 ? 0x2f8f4e : 0x3aa55c,
          { cast: false, flat: true }
        );
        leaf.position.set(x, crownY, z);
        leaf.rotation.y = (k / 6) * Math.PI * 2 + pi * 0.15;
        leaf.rotation.z = 0.5;
        island.add(leaf);
      }
      // small coconut cluster
      const nut = mesh(
        new THREE.SphereGeometry(0.12 * PALM_SCALE, 6, 5),
        0x6b4423,
        { cast: false, flat: true }
      );
      nut.position.set(x + 0.15, crownY - 0.25, z);
      island.add(nut);
    });

    this.scene.add(island);
  }

  _buildOcean() {
    // large water plane with vertex waves
    const segs = 48;
    const size = 90;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    this._waveBase = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      this._waveBase[i * 3] = pos.getX(i);
      this._waveBase[i * 3 + 1] = pos.getY(i);
      this._waveBase[i * 3 + 2] = pos.getZ(i);
    }

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x2a8fc4,
      roughness: 0.35,
      metalness: 0.15,
      transparent: true,
      opacity: 0.88,
      flatShading: true,
    });
    this.water = new THREE.Mesh(geo, waterMat);
    this.water.position.y = -0.55;
    this.water.receiveShadow = true;
    this.water.castShadow = false;
    this.scene.add(this.water);

    // deeper ocean disc under for color depth
    const deep = mesh(
      new THREE.CylinderGeometry(48, 48, 0.2, 32),
      0x1a5f8a,
      { cast: false, receive: false, roughness: 1 }
    );
    deep.position.y = -0.85;
    this.scene.add(deep);

    // sun/moon disc over the sea (no city)
    this.celestial = mesh(
      new THREE.SphereGeometry(0.85, 16, 12),
      0xffe08a,
      { cast: false, receive: false, roughness: 0.4 }
    );
    this.celestial.position.set(8, 7.5, -22);
    this.scene.add(this.celestial);
  }

  _animateWaves(dt) {
    if (!this.water) return;
    this._waveTime += dt;
    this._waveFrame = (this._waveFrame || 0) + 1;
    const t = this._waveTime;
    const pos = this.water.geometry.attributes.position;
    const base = this._waveBase;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const z = base[i * 3 + 2];
      // quiet under island; fade near shore
      const r2 = x * x + z * z;
      let amp = 0.12;
      if (r2 < 256) amp *= Math.max(0, (Math.sqrt(r2) - 14) / 2);
      const y =
        Math.sin(x * 0.35 + t * 1.6) * amp +
        Math.cos(z * 0.28 + t * 1.2) * amp * 0.7 +
        Math.sin((x + z) * 0.18 + t * 0.9) * amp * 0.45;
      pos.setY(i, base[i * 3 + 1] + y);
    }
    pos.needsUpdate = true;
    // normals every other frame — enough for flatShading iso look
    if (this._waveFrame % 2 === 0) this.water.geometry.computeVertexNormals();
  }

  _buildRoom() {
    // floor wood
    const floor = mesh(
      new THREE.BoxGeometry(ROOM.w, 0.12, ROOM.d),
      0xd8c3a0,
      { roughness: 0.85, cast: false }
    );
    floor.position.y = -0.06;
    this.scene.add(floor);

    // wood plank lines
    const lineMat = new THREE.LineBasicMaterial({ color: 0xc4ad86, transparent: true, opacity: 0.45 });
    for (let i = -10; i <= 10; i++) {
      const pts = [
        new THREE.Vector3(-ROOM.w / 2 + 0.2, 0.01, i * 0.72),
        new THREE.Vector3(ROOM.w / 2 - 0.2, 0.01, i * 0.72),
      ];
      if (Math.abs(i * 0.72) < ROOM.d / 2 - 0.2) {
        this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
      }
    }

    // back + left walls (open front for iso view)
    const wallMat = { roughness: 0.9, cast: false };
    const back = mesh(new THREE.BoxGeometry(ROOM.w, ROOM.h, 0.18), 0xe8e4dc, wallMat);
    back.position.set(0, ROOM.h / 2, -ROOM.d / 2);
    this.scene.add(back);

    const left = mesh(new THREE.BoxGeometry(0.18, ROOM.h, ROOM.d), 0xe4e0d8, wallMat);
    left.position.set(-ROOM.w / 2, ROOM.h / 2, 0);
    this.scene.add(left);

    // pale window / cork panels removed — three left-style digital boards in _buildInfoBoards
    // (skyline / city buildings removed — ocean island only)
  }

  _buildInfoBoards() {
    this.boardMeshes = [];
    const greenStyle = {
      w: 512,
      h: 320,
      accent: '#22a874',
      border: '#22a874',
      bgTop: '#14241c',
      bgBot: '#0c1812',
    };

    // Three green boards on LEFT wall (−X) — frees back wall for ultra-long aquarium
    const leftX = -ROOM.w / 2 + 0.2;
    const frameX = -ROOM.w / 2 + 0.16;
    const boardSpecs = [
      {
        kind: 'roster',
        z: -5.2,
        title: '夜貓總部 · 貓員名單',
        lines: [
          { text: '10 隻唔同品種 · 海島辦公', color: '#7ec8ef' },
          ...AGENTS.slice(0, 6).map((a) => ({ text: `${a.name} · ${a.breed}`, color: a.color })),
        ],
      },
      {
        kind: 'status',
        z: -1.0,
        title: '今日狀態看板',
        lines: [
          { text: '模擬運行中…', color: '#22a874' },
          '諗緊 / 開工 / 要你 / 完成 / 收工',
          '望窗：四面環海 · 海島總部',
          '玩嘢：貓爪板 · 毛線球 · 紙箱',
          '提示：撳 HUD 可停模擬／換燈光',
        ],
      },
      {
        kind: 'breed',
        z: 3.2,
        title: '品種地圖 · Breed Map',
        lines: [
          { text: '每隻貓＝一個 bot', color: '#7ec8ef' },
          ...AGENTS.slice(0, 6).map((a) => ({
            text: `${a.breedKey}: ${a.breed}`,
            color: '#c8d0e0',
          })),
        ],
      },
    ];

    for (const spec of boardSpecs) {
      const tex = makeBoardTexture(spec.title, spec.lines, { ...greenStyle });
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(2.9, 1.8),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
      );
      board.position.set(leftX, 1.7, spec.z);
      board.rotation.y = Math.PI / 2; // face into room (+X)
      this.scene.add(board);
      // dark frame + green edge strip
      const frame = mesh(new THREE.BoxGeometry(0.06, 1.95, 3.05), 0x1a2a22, { cast: false });
      frame.position.set(frameX, 1.7, spec.z);
      this.scene.add(frame);
      const glow = mesh(new THREE.BoxGeometry(0.02, 2.02, 3.12), 0x22a874, {
        cast: false,
        roughness: 0.4,
        metalness: 0.2,
      });
      glow.position.set(frameX - 0.02, 1.7, spec.z);
      this.scene.add(glow);
      this.boardMeshes.push({ mesh: board, kind: spec.kind });
    }
  }

  /** Optional: refresh status board from sim snapshot */
  refreshBoards(snapshot) {
    if (!snapshot || !this.boardMeshes) return;
    this._lastSnap = snapshot;
    const statusBoard = this.boardMeshes.find((b) => b.kind === 'status');
    if (!statusBoard) return;

    const c = snapshot.counts || {};
    const agents = snapshot.agents || [];
    const working = agents.filter((a) => a.status === 'running' || a.status === 'thinking').slice(0, 2);
    const waiting = agents.filter((a) => a.status === 'waiting').slice(0, 2);

    const lines = [
      { text: snapshot.running ? '● 模擬運行中' : '■ 已暫停', color: snapshot.running ? '#22a874' : '#e09412' },
      { text: `開工/諗緊 ${c.working ?? 0} · 要你 ${c.waiting ?? 0}`, color: '#c8d0e0' },
      { text: `收工 ${c.idle ?? 0} · 空枱 ${c.free ?? 0}`, color: '#c8d0e0' },
    ];
    if (working[0]) lines.push({ text: `忙碌：${working[0].name}`, color: '#3b8ee0' });
    if (waiting[0]) lines.push({ text: `等你：${waiting[0].name}`, color: '#e09412' });
    lines.push({ text: '海島總部 · 四面環海', color: '#7ec8ef' });

    const tex = makeBoardTexture('今日狀態看板', lines, {
      w: 512, h: 320, accent: '#22a874', border: '#22a874', bgTop: '#14241c', bgBot: '#0c1812',
    });
    const old = statusBoard.mesh.material.map;
    statusBoard.mesh.material.map = tex;
    statusBoard.mesh.material.needsUpdate = true;
    if (old) old.dispose();
  }

  _buildCatToys() {
    const toys = new THREE.Group();
    this.catToys = toys;

    // 休閒區 — office floor upper-right / NE of open plan (back-right, +X −Z)
    // clear of desks (≤x1.5), boss glass (+X +Z), kitchen (back center)
    const LEISURE = { x: 7.6, z: -3.4 };
    this.leisureCenter = new THREE.Vector3(LEISURE.x, 0, LEISURE.z);

    // floor mat marker for 休閒區
    const mat = mesh(
      new THREE.BoxGeometry(4.2, 0.035, 3.4),
      0xd4a574,
      { cast: false, roughness: 0.95 }
    );
    mat.position.set(LEISURE.x, 0.02, LEISURE.z);
    toys.add(mat);
    const matBorder = mesh(
      new THREE.BoxGeometry(4.35, 0.02, 3.55),
      0xb8845a,
      { cast: false, roughness: 1 }
    );
    matBorder.position.set(LEISURE.x, 0.012, LEISURE.z);
    toys.add(matBorder);

    // --- 貓爪板 / scratching post ---
    const post = new THREE.Group();
    const pole = mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.35, 10), 0xc4a882, { roughness: 0.95 });
    pole.position.y = 0.7;
    post.add(pole);
    for (let i = 0; i < 6; i++) {
      const band = mesh(
        new THREE.TorusGeometry(0.145, 0.025, 6, 16),
        0xb8956a,
        { cast: false, roughness: 1 }
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.25 + i * 0.2;
      post.add(band);
    }
    const base = mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.1, 16), 0x5a5048, { cast: false });
    base.position.y = 0.05;
    post.add(base);
    const platform = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 12), 0x6b5a4a);
    platform.position.y = 1.4;
    post.add(platform);
    const string = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 4), 0xdddddd, { cast: false });
    string.position.set(0.25, 1.15, 0);
    post.add(string);
    const feather = mesh(new THREE.SphereGeometry(0.08, 8, 6), 0xe74c3c, { flat: true });
    feather.position.set(0.25, 0.9, 0);
    post.add(feather);
    post.position.set(LEISURE.x - 1.35, 0, LEISURE.z + 0.55); // ~ (6.25, -2.85)
    toys.add(post);

    // --- yarn / 毛線球 ---
    const yarn = mesh(new THREE.SphereGeometry(0.18, 12, 10), 0xe8a0c8, { roughness: 0.9 });
    yarn.position.set(LEISURE.x - 0.15, 0.18, LEISURE.z - 0.85); // ~ (7.45, -4.25)
    toys.add(yarn);
    const yarn2 = mesh(new THREE.SphereGeometry(0.12, 10, 8), 0x7c6cf0, { roughness: 0.9 });
    yarn2.position.set(LEISURE.x + 0.25, 0.12, LEISURE.z - 0.55); // ~ (7.85, -3.95)
    toys.add(yarn2);
    const trailPts = [
      new THREE.Vector3(LEISURE.x - 0.15, 0.05, LEISURE.z - 0.85),
      new THREE.Vector3(LEISURE.x + 0.35, 0.04, LEISURE.z - 0.35),
      new THREE.Vector3(LEISURE.x + 0.7, 0.04, LEISURE.z + 0.15),
      new THREE.Vector3(LEISURE.x + 0.45, 0.04, LEISURE.z + 0.55),
    ];
    const trail = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(trailPts),
      new THREE.LineBasicMaterial({ color: 0xe8a0c8 })
    );
    toys.add(trail);

    // --- cardboard box ---
    const box = new THREE.Group();
    const boxBody = mesh(new THREE.BoxGeometry(0.9, 0.55, 0.7), 0xc4a574, { roughness: 0.95 });
    boxBody.position.y = 0.28;
    box.add(boxBody);
    const flap1 = mesh(new THREE.BoxGeometry(0.9, 0.04, 0.35), 0xb89560, { cast: false });
    flap1.position.set(0, 0.58, -0.28);
    flap1.rotation.x = -0.6;
    box.add(flap1);
    const flap2 = mesh(new THREE.BoxGeometry(0.9, 0.04, 0.35), 0xb89560, { cast: false });
    flap2.position.set(0, 0.58, 0.28);
    flap2.rotation.x = 0.55;
    box.add(flap2);
    const hole = mesh(
      new THREE.CircleGeometry(0.18, 12),
      0x3a2e22,
      { cast: false, receive: false, side: THREE.DoubleSide }
    );
    hole.position.set(0.46, 0.3, 0);
    hole.rotation.y = Math.PI / 2;
    box.add(hole);
    box.position.set(LEISURE.x + 1.2, 0, LEISURE.z + 0.35); // ~ (8.8, -3.05)
    box.rotation.y = -0.45;
    toys.add(box);

    // --- jingle ball ---
    const jingle = mesh(new THREE.SphereGeometry(0.1, 10, 8), 0xf0c040, { metalness: 0.3, roughness: 0.4 });
    jingle.position.set(LEISURE.x + 0.55, 0.1, LEISURE.z + 0.95); // ~ (8.15, -2.45)
    toys.add(jingle);

    this.scene.add(toys);
  }

  _buildDesks() {
    // 8 open desks in 2 rows + colors
    const colors = [
      0x8b6be6, 0x3b8ee0, 0x22a874, 0xe09412,
      0xde4b40, 0x4ecb71, 0xe8c547, 0x7c6cf0,
    ];
    const positions = [
      [-7.5, -5.0], [-4.5, -5.0], [-1.5, -5.0], [1.5, -5.0],
      [-7.5, -2.8], [-4.5, -2.8], [-1.5, -2.8], [1.5, -2.8],
    ];

    positions.forEach(([x, z], i) => {
      const desk = this._makeDesk(colors[i]);
      desk.position.set(x, 0, z);
      this.scene.add(desk);

      // floor glow pad
      const pad = mesh(
        new THREE.BoxGeometry(2.2, 0.02, 1.8),
        colors[i],
        { roughness: 0.5, metalness: 0.1, cast: false }
      );
      pad.material.transparent = true;
      pad.material.opacity = 0.35;
      pad.position.set(x, 0.015, z);
      this.scene.add(pad);

      this.deskSlots.push({
        id: i,
        desk: new THREE.Vector3(x, 0, z + 0.35),
        seat: new THREE.Vector3(x, 0, z + 0.55),
        color: colors[i],
        occupiedBy: null,
      });
    });
  }

  _makeDesk(accent) {
    const g = new THREE.Group();
    const top = mesh(new THREE.BoxGeometry(1.6, 0.08, 0.85), 0xe8e0d4);
    top.position.y = 0.72;
    g.add(top);
    // legs
    [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]].forEach(([lx, lz]) => {
      const leg = mesh(new THREE.BoxGeometry(0.08, 0.72, 0.08), 0xc8c0b4, { cast: false });
      leg.position.set(lx, 0.36, lz);
      g.add(leg);
    });
    // dual monitors
    [-0.28, 0.28].forEach((mx) => {
      const stand = mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), 0x333333);
      stand.position.set(mx, 0.9, -0.2);
      g.add(stand);
      const mon = mesh(new THREE.BoxGeometry(0.55, 0.38, 0.04), 0x222831);
      mon.position.set(mx, 1.15, -0.2);
      g.add(mon);
      const screen = mesh(new THREE.BoxGeometry(0.48, 0.3, 0.02), accent, {
        roughness: 0.3,
        metalness: 0.2,
        cast: false,
      });
      screen.position.set(mx, 1.15, -0.17);
      g.add(screen);
    });
    // keyboard
    const kb = mesh(new THREE.BoxGeometry(0.45, 0.03, 0.18), 0x3a3a42);
    kb.position.set(0, 0.78, 0.15);
    g.add(kb);
    // chair
    const seat = mesh(new THREE.BoxGeometry(0.45, 0.08, 0.45), 0x4a5568);
    seat.position.set(0, 0.42, 0.7);
    g.add(seat);
    const back = mesh(new THREE.BoxGeometry(0.45, 0.5, 0.08), 0x4a5568);
    back.position.set(0, 0.7, 0.9);
    g.add(back);
    return g;
  }

  _buildBossRoom() {
    // glass 主管室 in +X +Z corner
    const ox = 6.5;
    const oz = 4.2;
    const gw = 7.5;
    const gd = 5.5;

    const glassOpts = {
      transparent: true,
      opacity: 0.22,
      metalness: 0.15,
      roughness: 0.15,
      cast: false,
      side: THREE.DoubleSide,
    };

    // floor accent
    const bossFloor = mesh(
      new THREE.BoxGeometry(gw, 0.03, gd),
      0xc9b896,
      { cast: false, roughness: 0.7 }
    );
    bossFloor.position.set(ox, 0.02, oz);
    this.scene.add(bossFloor);

    // glass walls
    const walls = [
      { geo: [gw, 2.4, 0.06], pos: [ox, 1.2, oz - gd / 2] },
      { geo: [gw, 2.4, 0.06], pos: [ox, 1.2, oz + gd / 2] },
      { geo: [0.06, 2.4, gd], pos: [ox - gw / 2, 1.2, oz] },
      { geo: [0.06, 2.4, gd], pos: [ox + gw / 2, 1.2, oz] },
    ];
    walls.forEach(({ geo, pos }) => {
      const w = mesh(new THREE.BoxGeometry(...geo), 0xb8d4ef, glassOpts);
      w.position.set(...pos);
      this.scene.add(w);
      // frame
      const frame = mesh(
        new THREE.BoxGeometry(geo[0] > 1 ? geo[0] : 0.1, 0.08, geo[2] > 1 ? geo[2] : 0.1),
        0xe8e8ec,
        { cast: false }
      );
      frame.position.set(pos[0], 2.4, pos[2]);
      this.scene.add(frame);
    });

    // meeting table
    const table = mesh(new THREE.CylinderGeometry(1.1, 1.15, 0.1, 24), 0xe0d6c8);
    table.position.set(ox, 0.72, oz);
    this.scene.add(table);
    const pedestal = mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.65, 12), 0xc8beb0, { cast: false });
    pedestal.position.set(ox, 0.35, oz);
    this.scene.add(pedestal);

    // door gap marker (open entrance on -X side of boss room)
    this.bossCenter = new THREE.Vector3(ox, 0, oz);
    this.bossDoor = new THREE.Vector3(ox - gw / 2 - 0.4, 0, oz);
  }

  _buildLounge() {
    // green circular rug + larger L sofa (~1.4×) — middle of EMPTY plaza
    // QA11 (-4.0,2.5) closer but left-gap still bigger → -4.25; desks at -5/-2.8
    const cx = -4.25;
    const cz = 2.5;
    this.loungeCenter = new THREE.Vector3(cx, 0, cz);

    const SOFA_SCALE = 1.4;
    const rugR = 2.1;
    const rug = mesh(
      new THREE.CylinderGeometry(rugR, rugR, 0.04, 32),
      0x3d8f5a,
      { cast: false, roughness: 0.95 }
    );
    rug.position.set(cx, 0.03, cz);
    this.scene.add(rug);

    const sofaMat = 0x6b7280;
    // long seat along +X (toward room center); back faces −Z (toward desks)
    const seatLen = 2.4 * SOFA_SCALE;
    const seatDep = 0.85 * SOFA_SCALE;
    const seatH = 0.4;
    const sofaA = mesh(new THREE.BoxGeometry(seatLen, seatH, seatDep), sofaMat);
    sofaA.position.set(cx + 0.85, seatH / 2 + 0.08, cz - 0.85);
    this.scene.add(sofaA);
    const sofaBack = mesh(
      new THREE.BoxGeometry(seatLen, 0.55 * SOFA_SCALE, 0.18 * SOFA_SCALE),
      sofaMat
    );
    sofaBack.position.set(cx + 0.85, 0.55 * SOFA_SCALE + 0.08, cz - 0.85 - seatDep / 2 - 0.05);
    this.scene.add(sofaBack);
    // chaise / return toward −X (open plaza / left wall), along +Z
    const chaiseLen = 1.8 * SOFA_SCALE;
    const chaiseW = 0.85 * SOFA_SCALE;
    const sofaB = mesh(new THREE.BoxGeometry(chaiseW, seatH, chaiseLen), sofaMat);
    sofaB.position.set(cx - 1.25, seatH / 2 + 0.08, cz + 0.35);
    this.scene.add(sofaB);

    const coffee = mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.08, 20), 0xd8cfc0);
    coffee.position.set(cx - 0.2, 0.35, cz + 0.25);
    this.scene.add(coffee);
    const cleg = mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 8), 0xb0a898, { cast: false });
    cleg.position.set(cx - 0.2, 0.16, cz + 0.25);
    this.scene.add(cleg);
  }

  _buildKitchen() {
    // shift whole cluster toward +X (right wall), still on back wall
    const kx = 8.0;
    const kz = -ROOM.d / 2 + 0.55;
    const base = mesh(new THREE.BoxGeometry(4.5, 0.9, 0.7), 0xf2f2f0);
    base.position.set(kx, 0.45, kz);
    this.scene.add(base);
    const counter = mesh(new THREE.BoxGeometry(4.5, 0.08, 0.75), 0xffffff, { roughness: 0.4 });
    counter.position.set(kx, 0.94, kz);
    this.scene.add(counter);
    // coffee machine
    const cm = mesh(new THREE.BoxGeometry(0.4, 0.45, 0.35), 0x2a2a2e);
    cm.position.set(kx - 1.5, 1.2, kz);
    this.scene.add(cm);
    // stools
    [-0.5, 0.8, 2.1].forEach((sx) => {
      const stool = mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.55, 12), 0x888890);
      stool.position.set(sx + kx, 0.28, -ROOM.d / 2 + 1.35);
      this.scene.add(stool);
    });
    this.kitchenSpot = new THREE.Vector3(kx, 0, -ROOM.d / 2 + 1.5);
  }

  _buildAquariums() {
    // Ultra-long wall aquarium on BACK wall (red oval) — left of relocated kitchen
    this.aquariums = [];
    const fishColors = [0xff6b4a, 0xffc857, 0x4ecdc4, 0xff8fab, 0x7c6cf0, 0xf0e68c, 0xffffff, 0xff66aa];

    // kitchen spans ~5.75..10.25 at kx=8; tank fills almost all wall left of it
    const tankW = 11.5;
    const tankH = 1.65;
    const tankD = 0.55; // shallow, wall-hugging
    const standH = 0.28; // thin stand so tank reads as covering the wall
    const cx = -2.0; // spans ≈ -7.75 .. 3.75
    const cz = -ROOM.d / 2 + tankD / 2 + 0.12;

    const group = new THREE.Group();
    group.position.set(cx, 0, cz);
    // width along X, facing into room (+Z) — no rotation

    const stand = mesh(
      new THREE.BoxGeometry(tankW + 0.08, standH, tankD + 0.06),
      0x5a4638,
      { roughness: 0.85 }
    );
    stand.position.y = standH / 2;
    group.add(stand);

    const glass = mesh(
      new THREE.BoxGeometry(tankW, tankH, tankD),
      0xc8e8f8,
      {
        transparent: true,
        opacity: 0.2,
        roughness: 0.12,
        metalness: 0.05,
        cast: false,
        side: THREE.DoubleSide,
      }
    );
    glass.position.y = standH + tankH / 2;
    group.add(glass);

    const rim = mesh(
      new THREE.BoxGeometry(tankW + 0.05, 0.06, tankD + 0.05),
      0x2a3038,
      { cast: false, roughness: 0.6 }
    );
    rim.position.y = standH + tankH + 0.025;
    group.add(rim);

    // dark back panel (against wall) so water reads clearly
    const backPanel = mesh(
      new THREE.BoxGeometry(tankW * 0.98, tankH * 0.92, 0.03),
      0x1a3a48,
      { cast: false, roughness: 0.9 }
    );
    backPanel.position.set(0, standH + tankH / 2, -tankD / 2 + 0.02);
    group.add(backPanel);

    const water = mesh(
      new THREE.BoxGeometry(tankW * 0.96, tankH * 0.78, tankD * 0.82),
      0x3aa0c8,
      {
        transparent: true,
        opacity: 0.38,
        roughness: 0.2,
        metalness: 0.05,
        cast: false,
        side: THREE.DoubleSide,
      }
    );
    const waterY = standH + tankH * 0.45;
    water.position.y = waterY;
    group.add(water);

    const gravel = mesh(
      new THREE.BoxGeometry(tankW * 0.94, 0.07, tankD * 0.8),
      0xb8956a,
      { cast: false, roughness: 1 }
    );
    gravel.position.y = standH + 0.04;
    group.add(gravel);

    // plants spaced along the long tank
    const plantSpots = [];
    for (let i = 0; i < 11; i++) {
      plantSpots.push([-tankW * 0.42 + i * (tankW * 0.084), ((i % 3) - 1) * 0.12]);
    }
    plantSpots.forEach(([px, pz], i) => {
      const h = 0.32 + (i % 4) * 0.1;
      const weed = mesh(
        new THREE.ConeGeometry(0.07 + (i % 2) * 0.025, h, 5),
        i % 2 ? 0x2d8a5a : 0x3da06a,
        { cast: false, flat: true }
      );
      weed.position.set(px, standH + 0.06 + h / 2, pz);
      group.add(weed);
    });
    // a few rocks
    [-3.5, -0.5, 2.8].forEach((rx, i) => {
      const rock = mesh(
        new THREE.DodecahedronGeometry(0.14 + i * 0.03, 0),
        0x6a6570,
        { cast: false, flat: true }
      );
      rock.position.set(rx, standH + 0.14, 0.05);
      group.add(rock);
    });

    const fishList = [];
    const nFish = 14;
    for (let i = 0; i < nFish; i++) {
      const col = fishColors[i % fishColors.length];
      const body = mesh(
        new THREE.SphereGeometry(0.065, 8, 6),
        col,
        { cast: false, roughness: 0.45, flat: true }
      );
      body.scale.set(1.7, 0.85, 0.7);
      const tail = mesh(
        new THREE.ConeGeometry(0.035, 0.08, 4),
        col,
        { cast: false, flat: true }
      );
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -0.1;
      const fish = new THREE.Group();
      fish.add(body);
      fish.add(tail);
      const phase = (i / nFish) * Math.PI * 2;
      // long orbit along tank length (X), shallow in depth (Z)
      const rx = tankW * 0.38 + (i % 4) * 0.22;
      const rz = 0.12 + (i % 3) * 0.04;
      const cy = waterY + ((i % 5) - 2) * 0.09;
      fish.position.set(Math.cos(phase) * rx, cy, Math.sin(phase) * rz);
      group.add(fish);
      fishList.push({
        mesh: fish,
        phase,
        speed: 0.4 + (i % 7) * 0.08,
        rx,
        rz,
        cy,
        zMul: 1.1 + (i % 3) * 0.1,
      });
    }

    this.scene.add(group);
    this.aquariums.push({ group, fish: fishList });
  }

  _animateFish(dt) {
    if (!this.aquariums) return;
    for (const tank of this.aquariums) {
      for (const f of tank.fish) {
        f.phase += dt * f.speed;
        const x = Math.cos(f.phase) * f.rx;
        const z = Math.sin(f.phase * f.zMul) * f.rz;
        const y = f.cy + Math.sin(f.phase * 2.2) * 0.04;
        f.mesh.position.set(x, y, z);
        // face swim direction (tangent of orbit)
        const dx = -Math.sin(f.phase) * f.rx;
        const dz = Math.cos(f.phase * f.zMul) * f.rz * f.zMul;
        f.mesh.rotation.y = Math.atan2(dx, dz);
      }
    }
  }

  _buildWaypoints() {
    this.waypoints = {
      lounge: this.loungeCenter.clone(),
      kitchen: this.kitchenSpot.clone(),
      boss: this.bossCenter.clone(),
      bossDoor: this.bossDoor.clone(),
      wanderA: new THREE.Vector3(4, 0, -1),
      wanderB: new THREE.Vector3(-7.5, 0, 5.5),
      wanderC: new THREE.Vector3(8, 0, 1),
    };
  }

  setLighting(mode) {
    if (!this.lamp || !this.lamp.isLight) {
      this.lamp = new THREE.PointLight(0xffd9a0, 0, 18, 2);
      this.lamp.position.set(0, 2.4, 0);
      this.scene.add(this.lamp);
    }
    const presets = {
      day: {
        bg: 0x87c8e8,
        fog: 0x87c8e8,
        sun: 1.55,
        sunColor: 0xfff2d6,
        hemi: 1.05,
        lamp: 0,
        celestial: 0xffe08a,
        celY: 7.5,
        exposure: 1.1,
        water: 0x2a8fc4,
      },
      evening: {
        bg: 0xe89868,
        fog: 0xe89868,
        sun: 1.0,
        sunColor: 0xffb070,
        hemi: 0.75,
        lamp: 0.55,
        celestial: 0xff9955,
        celY: 4.2,
        exposure: 1.0,
        water: 0x3a6a8a,
      },
      night: {
        bg: 0x152038,
        fog: 0x152038,
        sun: 0.35,
        sunColor: 0xa0b4ff,
        hemi: 0.55,
        lamp: 1.2,
        celestial: 0xe8eef8,
        celY: 6.8,
        exposure: 0.95,
        water: 0x143a58,
      },
    };
    const p = presets[mode] || presets.day;
    this.scene.background.set(p.bg);
    this.scene.fog.color.set(p.fog);
    this.sun.intensity = p.sun;
    this.sun.color.set(p.sunColor);
    this.hemi.intensity = p.hemi;
    this.lamp.intensity = p.lamp;
    this.celestial.material.color.set(p.celestial);
    this.celestial.position.y = p.celY;
    this.renderer.toneMappingExposure = p.exposure;
    if (this.water && this.water.material) {
      this.water.material.color.set(p.water);
    }
  }

  update(dt, snapshot) {
    this._animateWaves(dt);
    this._animateFish(dt);
    this._boardTick += dt;
    if (snapshot) {
      this._lastSnap = snapshot;
    }
    // refresh status board every ~2.5s when we have a snap
    if (this._lastSnap && this._boardTick > 2.5) {
      this._boardTick = 0;
      this.refreshBoards(this._lastSnap);
    }
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    const frustum = 11;
    this.camera.left = -frustum * aspect;
    this.camera.right = frustum * aspect;
    this.camera.top = frustum;
    this.camera.bottom = -frustum;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
