import * as THREE from 'three';
import { AGENTS, STATUS, pickMessage } from './agents.js';
import { createCat, animateCatWalk, setCatSeated, rememberBaseScale } from './cats.js';

const ZONE = {
  desk: 'desk',
  lounge: 'lounge',
  boss: 'boss',
  kitchen: 'kitchen',
  wander: 'wander',
};

/** 狀態 → 目標區域 */
function zoneForStatus(status) {
  switch (status) {
    case 'thinking':
    case 'running':
      return ZONE.desk;
    case 'waiting':
      return Math.random() < 0.55 ? ZONE.boss : ZONE.desk;
    case 'done':
      return Math.random() < 0.5 ? ZONE.lounge : ZONE.kitchen;
    case 'idle':
    default:
      return Math.random() < 0.4 ? ZONE.lounge : (Math.random() < 0.5 ? ZONE.wander : ZONE.kitchen);
  }
}

function makeLabelSprite(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  // pill
  ctx.fillStyle = 'rgba(12, 16, 24, 0.78)';
  roundRect(ctx, 16, 12, 224, 40, 12);
  ctx.fill();
  ctx.strokeStyle = color || '#a78bfa';
  ctx.lineWidth = 3;
  roundRect(ctx, 16, 12, 224, 40, 12);
  ctx.stroke();
  ctx.fillStyle = '#f3f4f6';
  ctx.font = 'bold 22px "Segoe UI", "PingFang HK", "Noto Sans TC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 33);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.4, 1);
  sprite.center.set(0.5, 0);
  return sprite;
}

/** Status pill under name — Traditional Chinese, smaller */
function makeStatusSprite(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 56;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 56);
  ctx.fillStyle = 'rgba(12, 16, 24, 0.72)';
  roundRect(ctx, 48, 8, 160, 36, 10);
  ctx.fill();
  ctx.strokeStyle = color || '#6b7280';
  ctx.lineWidth = 2.5;
  roundRect(ctx, 48, 8, 160, 36, 10);
  ctx.stroke();
  ctx.fillStyle = color || '#f3f4f6';
  ctx.font = 'bold 20px "Segoe UI", "PingFang HK", "Noto Sans TC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 27);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.35, 0.32, 1);
  sprite.center.set(0.5, 0);
  return sprite;
}

function redrawStatusSprite(sprite, text, color) {
  const canvas = sprite.material.map.image;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(12, 16, 24, 0.72)';
  roundRect(ctx, 48, 8, 160, 36, 10);
  ctx.fill();
  ctx.strokeStyle = color || '#6b7280';
  ctx.lineWidth = 2.5;
  roundRect(ctx, 48, 8, 160, 36, 10);
  ctx.stroke();
  ctx.fillStyle = color || '#f3f4f6';
  ctx.font = 'bold 20px "Segoe UI", "PingFang HK", "Noto Sans TC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 27);
  sprite.material.map.needsUpdate = true;
}

// World-Y offsets above cat feet (name above, status below, clear gap)
const LABEL_Y_NAME = 1.85;
const LABEL_Y_STATUS = 1.38; // ~0.47 below name baseline
const LABEL_Y_BUBBLE = 2.45;

function makeBubbleSprite(emoji) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.beginPath();
  ctx.arc(64, 56, 40, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(48, 90);
  ctx.lineTo(58, 110);
  ctx.lineTo(72, 90);
  ctx.fill();
  ctx.font = '40px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 58);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(0.7, 0.7, 1);
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const BUBBLE_EMOJI = {
  thinking: '💭',
  running: '⚡',
  waiting: '✋',
  done: '✅',
  idle: '☕',
};

export class Simulation {
  constructor(office, onChange) {
    this.office = office;
    this.onChange = onChange;
    this.running = true;
    this.agents = [];
    this.log = [];
    this.elapsed = 0;
    this._initAgents();
  }

  _initAgents() {
    const desks = this.office.deskSlots;
    AGENTS.forEach((def, i) => {
      const cat = createCat(def.breedKey, def.color);
      rememberBaseScale(cat);
      const desk = desks[i % desks.length];
      const start = desk.seat.clone();
      // stagger initial positions a bit for non-desk overflow
      if (i >= desks.length) {
        start.copy(this.office.loungeCenter);
        start.x += (i - desks.length) * 0.6;
      }
      cat.position.copy(start);
      cat.rotation.y = Math.PI; // face monitors roughly
      this.office.scene.add(cat);

      const label = makeLabelSprite(def.name, def.color);
      label.position.copy(cat.position);
      label.position.y = LABEL_Y_NAME;
      this.office.scene.add(label);

      const statusKeys = Object.keys(STATUS);
      const status = statusKeys[i % statusKeys.length];
      const stInfo = STATUS[status];
      const statusLabel = makeStatusSprite(stInfo.label, stInfo.color);
      statusLabel.position.copy(cat.position);
      statusLabel.position.y = LABEL_Y_STATUS;
      this.office.scene.add(statusLabel);

      const bubble = makeBubbleSprite('💭');
      bubble.visible = false;
      bubble.position.copy(cat.position);
      bubble.position.y = LABEL_Y_BUBBLE;
      this.office.scene.add(bubble);

      const agent = {
        ...def,
        cat,
        label,
        statusLabel,
        bubble,
        status,
        message: pickMessage(status),
        deskIndex: i % desks.length,
        target: start.clone(),
        moving: false,
        seated: false,
        nextChange: 2 + Math.random() * 6,
        speed: 1.6 + Math.random() * 0.6,
      };
      this._applyStatusVisual(agent);
      this._retarget(agent, true);
      this.agents.push(agent);
      this._pushLog(`${def.name}（${def.breed}）上線 · ${STATUS[status].label}`);
    });
    this._emit();
  }

  _applyStatusVisual(agent) {
    const st = STATUS[agent.status] || STATUS.idle;
    redrawStatusSprite(agent.statusLabel, st.label, st.color);

    const emoji = BUBBLE_EMOJI[agent.status] || '🐱';
    // rebuild bubble texture cheaply
    const canvas = agent.bubble.material.map.image;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.beginPath();
    ctx.arc(64, 56, 40, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(48, 90);
    ctx.lineTo(58, 110);
    ctx.lineTo(72, 90);
    ctx.fill();
    ctx.font = '40px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 58);
    agent.bubble.material.map.needsUpdate = true;
    agent.bubble.visible = agent.status !== 'idle';
  }

  _retarget(agent, instant = false) {
    const zone = zoneForStatus(agent.status);
    let target = new THREE.Vector3();
    let seated = false;

    if (zone === ZONE.desk) {
      const desk = this.office.deskSlots[agent.deskIndex];
      target.copy(desk.seat);
      seated = true;
    } else if (zone === ZONE.lounge) {
      target.copy(this.office.loungeCenter);
      target.x += (Math.random() - 0.5) * 1.8;
      target.z += (Math.random() - 0.5) * 1.2;
    } else if (zone === ZONE.boss) {
      target.copy(this.office.bossCenter);
      target.x += (Math.random() - 0.5) * 1.5;
      target.z += (Math.random() - 0.5) * 1.5;
    } else if (zone === ZONE.kitchen) {
      target.copy(this.office.kitchenSpot);
      target.x += (Math.random() - 0.5) * 1.5;
    } else {
      const keys = ['wanderA', 'wanderB', 'wanderC'];
      const k = keys[Math.floor(Math.random() * keys.length)];
      target.copy(this.office.waypoints[k]);
      target.x += (Math.random() - 0.5) * 2;
      target.z += (Math.random() - 0.5) * 2;
    }

    agent.target.copy(target);
    agent.wantSeat = seated;
    if (instant) {
      agent.cat.position.copy(target);
      agent.moving = false;
      setCatSeated(agent.cat, seated);
      agent.seated = seated;
    } else {
      agent.moving = true;
      setCatSeated(agent.cat, false);
      agent.seated = false;
    }
  }

  toggle() {
    this.running = !this.running;
    this._pushLog(this.running ? '模擬恢復' : '模擬已停止');
    this._emit();
    return this.running;
  }

  update(dt) {
    if (!this.running) {
      // still bob labels
      this._syncOverlays(this.elapsed);
      return;
    }
    this.elapsed += dt;

    for (const agent of this.agents) {
      agent.nextChange -= dt;
      if (agent.nextChange <= 0) {
        this._cycleStatus(agent);
      }

      // move toward target
      const pos = agent.cat.position;
      const to = agent.target.clone().sub(pos);
      to.y = 0;
      const dist = to.length();
      if (dist > 0.08) {
        agent.moving = true;
        to.normalize();
        pos.addScaledVector(to, agent.speed * dt);
        agent.cat.rotation.y = Math.atan2(to.x, to.z);
        setCatSeated(agent.cat, false);
        agent.seated = false;
      } else {
        agent.moving = false;
        if (agent.wantSeat && !agent.seated) {
          setCatSeated(agent.cat, true);
          agent.seated = true;
          agent.cat.rotation.y = Math.PI; // face desk
        }
      }

      animateCatWalk(agent.cat, this.elapsed + agent.deskIndex, agent.speed, agent.moving);
    }

    this._syncOverlays(this.elapsed);
  }

  _syncOverlays(t) {
    for (const agent of this.agents) {
      const p = agent.cat.position;
      // name above, status below (~0.47 world units gap) — never overlap at iso angle
      agent.label.position.set(p.x, p.y + LABEL_Y_NAME, p.z);
      agent.statusLabel.position.set(p.x, p.y + LABEL_Y_STATUS, p.z);
      agent.bubble.position.set(
        p.x,
        p.y + LABEL_Y_BUBBLE + Math.sin(t * 3 + agent.deskIndex) * 0.05,
        p.z
      );
    }
  }

  _cycleStatus(agent) {
    const order = ['thinking', 'running', 'waiting', 'done', 'idle'];
    // weighted-ish random walk
    let next;
    const r = Math.random();
    if (agent.status === 'idle') next = r < 0.6 ? 'thinking' : 'running';
    else if (agent.status === 'thinking') next = r < 0.55 ? 'running' : (r < 0.8 ? 'waiting' : 'done');
    else if (agent.status === 'running') next = r < 0.35 ? 'waiting' : (r < 0.75 ? 'done' : 'thinking');
    else if (agent.status === 'waiting') next = r < 0.5 ? 'running' : 'done';
    else next = r < 0.4 ? 'idle' : 'thinking';

    // small chance to pick anything
    if (Math.random() < 0.08) next = order[Math.floor(Math.random() * order.length)];

    const prev = agent.status;
    agent.status = next;
    agent.message = pickMessage(next);
    agent.nextChange = 4 + Math.random() * 10;
    this._applyStatusVisual(agent);
    this._retarget(agent);
    this._pushLog(`${agent.name}：${STATUS[prev].label} → ${STATUS[next].label} · ${agent.message}`);
    this._emit();
  }

  _pushLog(text) {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    this.log.unshift({ time: `${hh}:${mm}:${ss}`, text });
    if (this.log.length > 40) this.log.length = 40;
  }

  _emit() {
    const counts = { working: 0, waiting: 0, idle: 0, free: 0 };
    for (const a of this.agents) {
      if (a.status === 'waiting') counts.waiting++;
      else if (a.status === 'idle' || a.status === 'done') counts.idle++;
      else counts.working++;
    }
    const used = new Set(this.agents.filter((a) => a.status === 'thinking' || a.status === 'running').map((a) => a.deskIndex));
    counts.free = Math.max(0, this.office.deskSlots.length - used.size);
    this.onChange?.({
      agents: this.agents,
      counts,
      log: this.log,
      running: this.running,
    });
  }

  getSnapshot() {
    const counts = { working: 0, waiting: 0, idle: 0, free: 0 };
    for (const a of this.agents) {
      if (a.status === 'waiting') counts.waiting++;
      else if (a.status === 'idle' || a.status === 'done') counts.idle++;
      else counts.working++;
    }
    const used = new Set(this.agents.filter((a) => a.status === 'thinking' || a.status === 'running').map((a) => a.deskIndex));
    counts.free = Math.max(0, this.office.deskSlots.length - used.size);
    return { agents: this.agents, counts, log: this.log, running: this.running };
  }
}
