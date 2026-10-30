import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

export class OfficeScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.waypoints = {};
    this.deskSlots = [];
    this.labelSprites = [];

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
    this.scene.background = new THREE.Color(0xa9d4f2);
    this.scene.fog = new THREE.Fog(0xa9d4f2, 28, 55);

    const aspect = window.innerWidth / window.innerHeight;
    const frustum = 11;
    this.camera = new THREE.OrthographicCamera(
      -frustum * aspect,
      frustum * aspect,
      frustum,
      -frustum,
      0.1,
      120
    );
    this.camera.position.set(18, 16, 18);
    this.camera.lookAt(0, 0.5, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.4, 0);
    this.controls.minZoom = 0.55;
    this.controls.maxZoom = 2.8;
    this.controls.maxPolarAngle = Math.PI / 2.15;
    this.controls.minPolarAngle = 0.35;
    this.controls.screenSpacePanning = true;

    this._lights();
    this._buildRoom();
    this._buildDesks();
    this._buildBossRoom();
    this._buildLounge();
    this._buildKitchen();
    this._buildPlants();
    this._buildWaypoints();

    window.addEventListener('resize', () => this.onResize());
  }

  _lights() {
    this.hemi = new THREE.HemisphereLight(0xfff8ee, 0x8a7a66, 1.05);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff2d6, 1.55);
    this.sun.position.set(12, 18, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -20;
    this.sun.shadow.camera.right = 20;
    this.sun.shadow.camera.top = 20;
    this.sun.shadow.camera.bottom = -20;
    this.sun.shadow.bias = -0.0002;
    this.scene.add(this.sun);

    this.fill = new THREE.DirectionalLight(0xb8d0ff, 0.35);
    this.fill.position.set(-10, 8, -6);
    this.scene.add(this.fill);

    this.lamp = new THREE.PointLight(0xffd9a0, 0.0, 18, 2);
    this.lamp.position.set(0, 2.4, 0);
    this.scene.add(this.lamp);
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

    // window panes on back wall
    for (let i = 0; i < 4; i++) {
      const frame = mesh(new THREE.BoxGeometry(3.2, 2.0, 0.08), 0xf5f5f5, { cast: false });
      frame.position.set(-7 + i * 4.5, 1.7, -ROOM.d / 2 + 0.12);
      this.scene.add(frame);
      const glass = mesh(
        new THREE.BoxGeometry(2.9, 1.7, 0.04),
        0x9ec9ef,
        { transparent: true, opacity: 0.35, metalness: 0.2, roughness: 0.2, cast: false }
      );
      glass.position.copy(frame.position);
      glass.position.z += 0.04;
      this.scene.add(glass);
    }

    // city skyline outside (simple boxes)
    const skyGroup = new THREE.Group();
    skyGroup.position.set(0, 0, -ROOM.d / 2 - 2);
    for (let i = 0; i < 12; i++) {
      const h = 1.5 + Math.random() * 4;
      const bldg = mesh(
        new THREE.BoxGeometry(1.2 + Math.random(), h, 1),
        0x6a7a90,
        { cast: false, receive: false }
      );
      bldg.position.set(-10 + i * 1.9, h / 2, -1 - Math.random());
      skyGroup.add(bldg);
    }
    this.scene.add(skyGroup);
    this.skyline = skyGroup;

    // sun/moon disc
    this.celestial = mesh(
      new THREE.SphereGeometry(0.7, 16, 12),
      0xffe08a,
      { cast: false, receive: false, roughness: 0.4 }
    );
    this.celestial.position.set(6, 5.5, -ROOM.d / 2 - 3);
    this.scene.add(this.celestial);

    // wall screen
    const screen = mesh(new THREE.BoxGeometry(3.6, 1.8, 0.08), 0x1a2233, { cast: false });
    screen.position.set(7.5, 1.8, -ROOM.d / 2 + 0.15);
    this.scene.add(screen);
    const chart = mesh(new THREE.BoxGeometry(3.2, 1.4, 0.04), 0x243048, { cast: false });
    chart.position.copy(screen.position);
    chart.position.z += 0.05;
    this.scene.add(chart);
    // fake chart bars
    for (let i = 0; i < 8; i++) {
      const bh = 0.2 + Math.random() * 0.9;
      const bar = mesh(new THREE.BoxGeometry(0.25, bh, 0.05), i % 2 ? 0x7c6cf0 : 0x22a874, { cast: false });
      bar.position.set(6.2 + i * 0.35, 1.2 + bh / 2, -ROOM.d / 2 + 0.22);
      this.scene.add(bar);
    }
  }

  _buildDesks() {
    // 8 open desks in 2 rows + colors
    const colors = [
      0x8b6be6, 0x3b8ee0, 0x22a874, 0xe09412,
      0xde4b40, 0x4ecb71, 0xe8c547, 0x7c6cf0,
    ];
    const positions = [
      [-7.5, -2.5], [-4.5, -2.5], [-1.5, -2.5], [1.5, -2.5],
      [-7.5, 1.0], [-4.5, 1.0], [-1.5, 1.0], [1.5, 1.0],
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
    // green circular rug + L sofa
    const rug = mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 0.04, 32),
      0x3d8f5a,
      { cast: false, roughness: 0.95 }
    );
    rug.position.set(-6.5, 0.03, 5.2);
    this.scene.add(rug);

    const sofaMat = 0x6b7280;
    const sofaA = mesh(new THREE.BoxGeometry(2.4, 0.4, 0.85), sofaMat);
    sofaA.position.set(-7.2, 0.28, 4.5);
    this.scene.add(sofaA);
    const sofaBack = mesh(new THREE.BoxGeometry(2.4, 0.55, 0.18), sofaMat);
    sofaBack.position.set(-7.2, 0.55, 4.05);
    this.scene.add(sofaBack);
    const sofaB = mesh(new THREE.BoxGeometry(0.85, 0.4, 1.8), sofaMat);
    sofaB.position.set(-5.5, 0.28, 5.5);
    this.scene.add(sofaB);

    const coffee = mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.08, 20), 0xd8cfc0);
    coffee.position.set(-6.3, 0.35, 5.5);
    this.scene.add(coffee);
    const cleg = mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 8), 0xb0a898, { cast: false });
    cleg.position.set(-6.3, 0.16, 5.5);
    this.scene.add(cleg);

    this.loungeCenter = new THREE.Vector3(-6.5, 0, 5.2);
  }

  _buildKitchen() {
    const base = mesh(new THREE.BoxGeometry(4.5, 0.9, 0.7), 0xf2f2f0);
    base.position.set(2, 0.45, -ROOM.d / 2 + 0.55);
    this.scene.add(base);
    const counter = mesh(new THREE.BoxGeometry(4.5, 0.08, 0.75), 0xffffff, { roughness: 0.4 });
    counter.position.set(2, 0.94, -ROOM.d / 2 + 0.55);
    this.scene.add(counter);
    // coffee machine
    const cm = mesh(new THREE.BoxGeometry(0.4, 0.45, 0.35), 0x2a2a2e);
    cm.position.set(0.5, 1.2, -ROOM.d / 2 + 0.55);
    this.scene.add(cm);
    // stools
    [-0.5, 0.8, 2.1].forEach((sx) => {
      const stool = mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.55, 12), 0x888890);
      stool.position.set(sx + 2, 0.28, -ROOM.d / 2 + 1.35);
      this.scene.add(stool);
    });
    this.kitchenSpot = new THREE.Vector3(2, 0, -ROOM.d / 2 + 1.5);
  }

  _buildPlants() {
    const spots = [
      [-9.5, -6], [-9.5, 6], [9.5, -6], [3, 6.5], [-2, -6.5],
    ];
    spots.forEach(([x, z]) => {
      const pot = mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.35, 10), 0xc4785a);
      pot.position.set(x, 0.18, z);
      this.scene.add(pot);
      const leaf = mesh(new THREE.SphereGeometry(0.45, 8, 6), 0x3d8f5a, { flat: true });
      leaf.position.set(x, 0.7, z);
      leaf.scale.set(1, 1.2, 1);
      this.scene.add(leaf);
      const leaf2 = mesh(new THREE.SphereGeometry(0.3, 8, 6), 0x4eaa68, { flat: true });
      leaf2.position.set(x + 0.25, 0.85, z + 0.1);
      this.scene.add(leaf2);
    });
  }

  _buildWaypoints() {
    this.waypoints = {
      lounge: this.loungeCenter.clone(),
      kitchen: this.kitchenSpot.clone(),
      boss: this.bossCenter.clone(),
      bossDoor: this.bossDoor.clone(),
      wanderA: new THREE.Vector3(4, 0, -1),
      wanderB: new THREE.Vector3(-2, 0, 3.5),
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
        bg: 0xa9d4f2,
        fog: 0xa9d4f2,
        sun: 1.55,
        sunColor: 0xfff2d6,
        hemi: 1.05,
        lamp: 0,
        celestial: 0xffe08a,
        celY: 5.5,
        exposure: 1.1,
      },
      evening: {
        bg: 0xf0a679,
        fog: 0xf0a679,
        sun: 1.0,
        sunColor: 0xffb070,
        hemi: 0.75,
        lamp: 0.55,
        celestial: 0xff9955,
        celY: 3.8,
        exposure: 1.0,
      },
      night: {
        bg: 0x1d2747,
        fog: 0x1d2747,
        sun: 0.35,
        sunColor: 0xa0b4ff,
        hemi: 0.55,
        lamp: 1.2,
        celestial: 0xe8eef8,
        celY: 5.2,
        exposure: 0.95,
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
