import { OfficeScene } from './office.js';
import { Simulation } from './simulation.js';
import { HUD } from './hud.js';

const canvas = document.getElementById('office-canvas');
const office = new OfficeScene(canvas);
office.setLighting('day');

const hud = new HUD();
const sim = new Simulation(office, (snap) => hud.render(snap));
hud.render(sim.getSnapshot());

hud.onStop(() => {
  sim.toggle();
  hud.render(sim.getSnapshot());
});

hud.onLighting((mode) => {
  office.setLighting(mode);
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  sim.update(dt);
  office.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

console.info('[夜貓總部] 虛擬辦公室已載入 · 10 隻唔同品種嘅貓');
