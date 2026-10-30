import { STATUS } from './agents.js';

const LEGEND = [
  { key: 'thinking', label: '諗緊' },
  { key: 'running', label: '開工' },
  { key: 'waiting', label: '要你' },
  { key: 'done', label: '完成' },
  { key: 'idle', label: '收工' },
];

export class HUD {
  constructor() {
    this.counters = document.getElementById('counters');
    this.teamList = document.getElementById('team-list');
    this.activityLog = document.getElementById('activity-log');
    this.legend = document.getElementById('legend');
    this.stopBtn = document.getElementById('btn-stop');
    this.simTag = document.querySelector('.sim-tag');
    this.lightBtns = [...document.querySelectorAll('.lighting button')];

    this._buildLegend();
  }

  _buildLegend() {
    this.legend.innerHTML = LEGEND.map(
      (l) => `<span><i style="background:${STATUS[l.key].color}"></i>${l.label}</span>`
    ).join('');
  }

  onStop(handler) {
    this.stopBtn.addEventListener('click', handler);
  }

  onLighting(handler) {
    this.lightBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.lightBtns.forEach((b) => b.classList.toggle('active', b === btn));
        handler(btn.dataset.light);
      });
    });
  }

  setRunning(running) {
    this.stopBtn.textContent = running ? '停止模擬' : '繼續模擬';
    this.stopBtn.classList.toggle('stopped', !running);
    if (this.simTag) {
      this.simTag.textContent = running ? '模擬中' : '已暫停';
    }
  }

  render(snapshot) {
    const { agents, counts, log, running } = snapshot;
    this.setRunning(running);

    const map = {
      working: counts.working,
      waiting: counts.waiting,
      idle: counts.idle,
      free: counts.free,
    };
    this.counters.querySelectorAll('[data-k]').forEach((el) => {
      const k = el.dataset.k;
      const b = el.querySelector('b');
      if (b) b.textContent = String(map[k] ?? 0);
    });

    this.teamList.innerHTML = agents
      .map((a) => {
        const st = STATUS[a.status];
        return `<li class="team-item">
          <span class="team-dot" style="background:${a.color};color:${a.color}"></span>
          <div class="team-meta">
            <div class="name">${a.name}</div>
            <div class="role">${a.breed} · ${a.role}</div>
            <div class="status-line">${a.message}</div>
          </div>
          <span class="team-status" style="color:${st.color}">${st.label}</span>
        </li>`;
      })
      .join('');

    this.activityLog.innerHTML = log
      .slice(0, 24)
      .map((row) => `<li><time>${row.time}</time>${row.text}</li>`)
      .join('');
  }
}
