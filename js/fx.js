'use strict';
/* =====================================================================
   CITY.RA — fx.js
   Pooled particles (explosions, smoke, fire, sparks, debris, water,
   flares, contrails), temporary light sources and persistent decals.
   ===================================================================== */

const FX = {
  parts: [],
  pool: new Pool(() => ({})),
  lights: [],
  max: 3200,
  quality: 1,
  smokeLife: 0.45, // fraction of each smoke puff's authored lifetime
  vr: null, // last rendered view: effects far off-screen are skipped entirely

  add(type, x, y, o) {
    if (this.parts.length >= this.max * this.quality) return null;
    const vr = this.vr; if (vr && (x < vr.x0 - 320 || x > vr.x1 + 320 || y < vr.y0 - 420 || y > vr.y1 + 320)) return null;
    const p = this.pool.get();
    p.type = type; p.x = x; p.y = y; p.z = o.z || 0; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.life = 0; p.max = o.max || 1; p.size = o.size || 3; p.grow = o.grow || 0; p.c = o.c || '#fff'; p.a = o.a || 0; p.va = o.va || 0; p.len = o.len || 0; p.drag = o.drag == null ? 0.9 : o.drag;    p.alpha = o.alpha == null ? 1 : o.alpha; p.trail = !!o.trail; p.blw = o.blw || 0;
    p.v = o.v != null ? o.v : ((Math.random() * 8) | 0);
    p.sx = o.sx != null ? o.sx : x; p.sy = o.sy != null ? o.sy : y;
    if (type === 'smoke' || type === 'dust') p.max *= this.smokeLife; // smoke clears faster
    this.parts.push(p); return p;
  },

  light(x, y, r, life, col) { this.lights.push({ x, y, r, life, max: life, col: col || '255,190,110' }); },

  explosion(x, y, s = 1, opts = {}) {
    const q = this.quality, n = Math.round(18 * s * q) + 5;
    // 1. Blinding white-blue plasma flash & multi-stage thermal bloom
    this.add('glow', x, y, { size: 9 * s, grow: 105 * s, max: 0.09, c: '255,255,255' });
    this.add('glow', x, y, { size: 18 * s, grow: 48 * s, max: 0.28, c: '255,240,180' });
    this.add('glow', x, y, { size: 14 * s, grow: 22 * s, max: 0.62, c: '255,140,42' });
    this.add('glow', x, y, { size: 10 * s, grow: 12 * s, max: 0.95, c: '205,52,14', alpha: 0.78 });
    // 2. Supersonic condensation Mach shockwave + ground dust blast wave
    this.add('ring', x, y, { size: 3 * s, grow: 225 * s, max: 0.34, c: '255,252,245' });
    this.add('ring', x, y, { size: 6 * s, grow: 148 * s, max: 0.58, c: '215,192,158' });
    if (s >= 0.95) this.add('ring', x, y, { size: 9 * s, grow: 270 * s, max: 0.44, c: '255,205,145' });
    // 3. Textured roiling fireball lobes with multi-stage thermal cooling (white-yellow -> orange -> crimson -> soot)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, edge = Math.random(), v = U.rnd(12, 78) * s * (0.35 + edge * 0.85);
      const col = edge < 0.25 ? '255,252,215' : edge < 0.58 ? '255,' + (150 + U.rint(70)) + ',42' : edge < 0.84 ? '240,' + (65 + U.rint(48)) + ',18' : '168,36,12';
      this.add('fire', x + Math.cos(a) * 4.5 * s * edge, y + Math.sin(a) * 4.5 * s * edge, {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - U.rnd(10, 32) * s,
        size: U.rnd(5.5, 13.5) * s, grow: U.rnd(10, 20) * s, max: U.rnd(0.38, 0.98),
        c: col, drag: 0.84, a: Math.random() * 6.28, va: U.rnd(-3.5, 3.5), v: i & 7
      });
    }
    // 4. Incandescent shrapnel & glowing ember arcs
    const spkN = Math.round(n * 0.95);
    for (let i = 0; i < spkN; i++) {
      const a = Math.random() * Math.PI * 2, fast = i < spkN * 0.45, v = (fast ? U.rnd(155, 380) : U.rnd(60, 175)) * s;
      this.add('spark', x, y - 2, {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - U.rnd(24, 72),
        size: fast ? 1.8 : 1.35, max: fast ? U.rnd(0.24, 0.55) : U.rnd(0.5, 1.25),
        c: fast ? '255,248,205' : '255,' + (135 + U.rint(85)) + ',45', drag: fast ? 0.91 : 0.95
      });
    }
    // 5. Billowing smoke column: buoyant dark billows rise and mushroom,
    //    shear downwind with age; a tan dust skirt races along the ground.
    const windX = G.wind ? Math.cos(G.wind) * 7 : 4;
    const colN = Math.round(9 * s * q) + 4; // rising column billows, hot base -> cool cap
    for (let i = 0; i < colN; i++) {
      const f = colN > 1 ? i / (colN - 1) : 0, hOff = f * (30 + 30 * s) * s + U.rnd(-6, 6) * s;
      const wob = U.rnd(-1, 1) * (4 + f * 18) * s;
      const shade = opts.dark ? 20 + U.rint(14) : f < 0.35 ? 66 + U.rint(20) : 34 + U.rint(22);
      const warm = f < 0.3 && !opts.dark;
      const cStr = warm ? shade + ',' + Math.round(shade * 0.72) + ',' + Math.round(shade * 0.5) : shade + ',' + (shade - 2) + ',' + Math.max(0, shade - 6);
      this.add('smoke', x + wob, y - hOff, {
        vx: wob * 0.7 + windX * (0.3 + f), vy: U.rnd(-66, -30) * s * (1 - f * 0.45),
        size: U.rnd(7, 13) * s * (0.7 + f * 0.9), grow: (15 + f * 26) * s, max: U.rnd(4.5, 8.5),
        c: cStr, alpha: 0.62, drag: 0.96, a: Math.random() * 6.28, va: U.rnd(-1.4, 1.4), v: i & 7, blw: 1
      });
    }
    const torN = Math.round(6 * s * q) + 3; // spreading torus billows at the cap
    for (let i = 0; i < torN; i++) {
      const a = Math.random() * Math.PI * 2, d = U.rnd(2, 11) * s;
      const shade = opts.dark ? 22 + U.rint(12) : 40 + U.rint(22);
      this.add('smoke', x + Math.cos(a) * d, y - (30 + 30 * s) * s + U.rnd(-8, 8) * s, {
        vx: Math.cos(a) * U.rnd(18, 52) * s + windX * 0.8, vy: U.rnd(-26, -8) * s,
        size: U.rnd(8, 14) * s, grow: U.rnd(20, 30) * s, max: U.rnd(5, 9),
        c: shade + ',' + (shade - 2) + ',' + Math.max(0, shade - 6), alpha: 0.58, drag: 0.95,
        a: Math.random() * 6.28, va: U.rnd(-1, 1), v: i & 7, blw: 1
      });
    }
    const duN = Math.round(8 * s * q) + 4; // ground-hugging dust skirt
    for (let i = 0; i < duN; i++) {
      const a = Math.random() * Math.PI * 2, v = U.rnd(25, 80) * s;
      const shade = opts.dark ? 60 + U.rint(20) : 138 + U.rint(30);
      this.add('smoke', x + Math.cos(a) * 6 * s, y + Math.sin(a) * 6 * s, {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.35 + 2,
        size: U.rnd(7, 13) * s, grow: U.rnd(24, 34) * s, max: U.rnd(3.5, 6.5),
        c: shade + ',' + (shade - 14) + ',' + (shade - 30), alpha: 0.4, drag: 0.93,
        a: Math.random() * 6.28, va: U.rnd(-0.8, 0.8), v: i & 7, blw: 2
      });
    }
    // 6. Ballistic chunks of earth/metal with smoke ribbons & ground bounce
    if (s >= 0.6) {
      const dbN = Math.round(n * 0.8);
      for (let i = 0; i < dbN; i++) {
        const a = Math.random() * Math.PI * 2, v = U.rnd(38, 185) * s;
        this.add('debris', x, y, {
          vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: U.rnd(60, 195) * s,
          size: U.rnd(1.5, 3.6) * Math.min(1.7, Math.sqrt(s)), max: U.rnd(0.8, 1.75),
          a: Math.random() * 6.28, va: U.rnd(-15, 15),
          c: U.pick(['#2d2926', '#4c453d', '#1c1a18', '#6e5f50', '#847565', '#d86b28', '#ff9b38']),
          drag: 0.97, trail: s >= 0.85 && i % 2 === 0
        });
      }
    }
    // 7. Secondary cook-off fireballs and rising mushroom column on heavy blasts
    if (s >= 1.2) {
      for (let i = 0; i < 12; i++) {
        const hOff = U.rnd(6, 44) * s;
        this.add('smoke', x + U.rnd(-13, 13) * s, y - hOff, {
          vx: U.rnd(-9, 9), vy: U.rnd(-52, -22), size: 12 * s, grow: 22 * s,
          max: U.rnd(3.4, 6.2), c: '34,30,27', alpha: 0.68, drag: 0.96, a: Math.random() * 6.28, va: U.rnd(-1, 1), v: i & 7
        });
        if (i < 5) {
          this.add('fire', x + U.rnd(-10, 10) * s, y - hOff * 0.65, {
            vx: U.rnd(-12, 12), vy: U.rnd(-38, -14), size: 8 * s, grow: 12 * s,
            max: U.rnd(0.45, 0.95), c: '255,155,40', drag: 0.9, a: Math.random() * 6.28, va: U.rnd(-2.5, 2.5), v: i & 7
          });
        }
      }
    }
    if (typeof Render !== 'undefined' && s >= 0.85) {
      Render.shake = Math.max(Render.shake || 0, Math.min(18, s * 4.4));
    }
    this.light(x, y, 125 * s, 0.72, '255,180,85');
  },

  contrail(x, y, a, span = 10, jet = true) {
    const wx = -Math.sin(a), wy = Math.cos(a), bx = -Math.cos(a), by = -Math.sin(a);
    const windX = G.wind ? Math.cos(G.wind) * 3.5 : 2, windY = G.wind ? Math.sin(G.wind) * 3.5 : 1;
    // Wingtip condensation vortex ribbons (left & right wingtips)
    for (const side of [-1, 1]) {
      const tx = x + wx * span * side + bx * 3, ty = y + wy * span * side + by * 3;
      this.add('contrail', tx, ty, {
        vx: windX + U.rnd(-1.8, 1.8), vy: windY + U.rnd(-1.8, 1.8),
        size: U.rnd(1.5, 2.3), grow: U.rnd(4.2, 6.8), max: U.rnd(2.2, 3.6),
        a: a + side * 0.04, va: side * U.rnd(0.25, 0.55),
        c: '238,245,255', alpha: 0.52, drag: 0.96, v: (side + 1)
      });
    }
    // Central jet exhaust vapor core + subtle afterburner thermal shimmer
    if (jet) {
      const ex = x + bx * (span * 0.75), ey = y + by * (span * 0.75);
      this.add('contrail', ex, ey, {
        vx: bx * 14 + windX, vy: by * 14 + windY,
        size: U.rnd(2.2, 3.2), grow: U.rnd(6.5, 9.5), max: U.rnd(1.8, 3.0),
        a, va: U.rnd(-0.4, 0.4), c: '245,248,255', alpha: 0.62, drag: 0.94, v: 3
      });
      this.add('fire', ex + bx * 1.5, ey + by * 1.5, {
        vx: bx * 22, vy: by * 22, size: 1.8, grow: 1.5, max: 0.11,
        c: '255,195,110', drag: 0.85, v: 0
      });
    }
  },

  smallHit(x, y, armored) {
    if (armored) { for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28, v = U.rnd(40, 120); this.add('spark', x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: 1.2, max: 0.25, c: '255,220,140' }); } }
    else this.add('dust', x, y, { size: 2.5, grow: 10, max: 0.5, c: '140,120,90', alpha: 0.5 });
  },
  muzzle(x, y, a, big, w, width) {
    if (G.era === 'napoleonic' && w) { // black powder: a flash and a bank of white smoke along the firing line
      if (w.wh === 'blade') { this.add('spark', x, y, { vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, size: 1, max: 0.15, c: '230,230,240' }); return; }
      const n = big ? 5 : Math.max(2, Math.round((width || 6) / 4)), px = -Math.sin(a), py = Math.cos(a);
      this.add('glow', x, y, { size: big ? 9 : 4, grow: big ? 10 : 5, max: 0.08, c: '255,220,140' });
      for (let i = 0; i < n; i++) { const o = (i / Math.max(1, n - 1) - 0.5) * (width || 6) * 1.6, sx = x + px * o + Math.cos(a) * 4, sy = y + py * o + Math.sin(a) * 4;
        this.add('smoke', sx, sy, { vx: Math.cos(a) * (big ? 30 : 14) + U.rnd(-3, 3), vy: Math.sin(a) * (big ? 30 : 14) - 3, size: big ? 6 : 3.2, grow: big ? 11 : 5, max: big ? U.rnd(3, 5) : U.rnd(2, 3.4), c: '232,228,214', alpha: big ? 0.62 : 0.5, drag: 0.93 }); }
      if (big) this.light(x, y, 50, 0.12);
      return;
    }
    this.add('glow', x + Math.cos(a) * 2, y + Math.sin(a) * 2, { size: big ? 7 : 3.5, grow: big ? 8 : 4, max: 0.08, c: '255,230,160' });
    if (big) { this.add('smoke', x + Math.cos(a) * 5, y + Math.sin(a) * 5, { vx: Math.cos(a) * 25, vy: Math.sin(a) * 25, size: 5, grow: 14, max: 1.2, c: '120,115,105', alpha: 0.45 }); this.light(x, y, 40, 0.1); }
  },
  smoke(x, y, s = 1, dark) { this.add('smoke', x + U.rnd(-3, 3), y + U.rnd(-3, 3), { vx: U.rnd(-4, 4) + 6, vy: U.rnd(-10, -3), size: 4 * s, grow: 10 * s, max: U.rnd(2, 4), c: dark ? '28,26,24' : '120,118,112', alpha: dark ? 0.6 : 0.4, drag: 0.98 }); },
  flame(x, y, s = 1) {
    this.add('fire', x + U.rnd(-5, 5) * s, y + U.rnd(-5, 5) * s, { vx: U.rnd(-6, 6), vy: U.rnd(-22, -8), size: U.rnd(3, 6) * s, grow: 4 * s, max: U.rnd(0.4, 0.8), c: '255,' + (90 + U.rint(110)) + ',30', drag: 0.95 });
    if (Math.random() < 0.3) this.smoke(x, y - 6, s, true);
  },
  water(x, y, s = 1) {
    this.add('ring', x, y, { size: 3, grow: 40 * s, max: 0.6, c: '220,240,255' });
    for (let i = 0; i < 6 * s; i++) { const a = Math.random() * 6.28, v = U.rnd(10, 50) * s; this.add('water', x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: U.rnd(30, 90), size: U.rnd(1.5, 3), max: 0.8, c: '220,235,245' }); }
  },
  trail(x, y, dark) { this.add('smoke', x, y, { size: 2.2, grow: 7, max: dark ? 0.9 : 1.5, c: dark ? '90,86,80' : '215,215,210', alpha: 0.5, drag: 0.9 }); },
  flare(x, y) { for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28; this.add('flare', x, y, { vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 + 20, size: 2.4, max: 1.4, c: '255,240,200', drag: 0.96 }); } this.light(x, y, 50, 1); },
  heal(x, y) { this.add('plus', x + U.rnd(-6, 6), y + U.rnd(-6, 6), { vy: -14, size: 3, max: 0.9, c: '120,230,150' }); },
  spray(x, y, tx, ty) { const a = U.ang(x, y, tx, ty); for (let i = 0; i < 2; i++) this.add('water', x, y, { vx: Math.cos(a + U.rnd(-0.2, 0.2)) * 90, vy: Math.sin(a + U.rnd(-0.2, 0.2)) * 90, vz: 30, size: 1.6, max: 0.5, c: '200,225,245' }); },

  update(dt) {
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life += dt;
      if (p.life >= p.max) { P[i] = P[P.length - 1]; P.pop(); this.pool.put(p); continue; }
      const dr = Math.pow(p.drag, dt * 30);
      p.vx *= dr; p.vy *= dr;
      if (p.type === 'smoke' && p.blw) {
        const k = p.life / p.max, wX = G.wind ? Math.cos(G.wind) * 26 : 8, wY = G.wind ? Math.sin(G.wind) * 26 : 3;
        if (p.blw === 1) { // buoyant billow: rise eases off, wind shear takes over with age
          const pull = Math.min(1, dt * (0.3 + k * 2.4));
          p.vx += (wX - p.vx) * pull; p.vy += ((wY * 0.3 - 7) - p.vy) * pull * 0.6;
          p.va *= 1 - Math.min(0.85, dt * (0.4 + k));
        } else { // ground dust: settles low, drifts downwind and thins
          p.vy += (3 - p.vy) * Math.min(1, dt * 1.6);
          p.vx += (wX * 0.7 - p.vx) * Math.min(1, dt * 0.9);
        }
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.size += p.grow * dt;
      if (p.va) p.a += p.va * dt;
      if (p.type === 'debris' || p.type === 'water') {
        p.vz -= 290 * dt; p.z += p.vz * dt;
        if (p.trail && p.z > 3 && Math.random() < 0.45) this.add('smoke', p.x, p.y - p.z * 0.4, { size: 1.6, grow: 5, max: 0.55, c: '75,70,64', alpha: 0.38, drag: 0.9 });
        if (p.z < 0) { p.z = 0; p.vz *= -0.32; p.vx *= 0.55; p.vy *= 0.55; p.va *= 0.5; }
      }
    }
    for (let i = this.lights.length - 1; i >= 0; i--) { const l = this.lights[i]; l.life -= dt; if (l.life <= 0) this.lights.splice(i, 1); }
  },

  draw(x, view) {
    const P = this.parts, x0 = view.x0 - 80, x1 = view.x1 + 80, y0 = view.y0 - 80, y1 = view.y1 + 80;
    x.globalCompositeOperation = 'source-over';
    for (const p of P) {
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const k = p.life / p.max;
      if (p.type === 'smoke' || p.type === 'dust') {
        const fin = p.blw ? (k < 0.22 ? k / 0.22 : 1) : (k < 0.1 ? k * 10 : 1);
        const fout = p.blw ? Math.pow(1 - k, 1.35) : (1 - k);
        const a = p.alpha * fout * fin; if (a < 0.01) continue;
        const r = p.size * (p.blw ? 2.1 : 1.75); x.globalAlpha = Math.min(1, a);
        const tex = SPR.smokeTex ? SPR.smokeTex(p.c, p.v || 0) : SPR.puff(p.c);
        if (p.a) {
          const py = p.y - p.life * 5; x.translate(p.x, py); x.rotate(p.a);
          x.drawImage(tex, -r, -r, r * 2, r * 2); x.rotate(-p.a); x.translate(-p.x, -py);
        } else {
          x.drawImage(tex, p.x - r, p.y - p.life * 5 - r, r * 2, r * 2);
        }
      } else if (p.type === 'contrail') {
        const a = p.alpha * Math.pow(1 - k, 1.35) * (k < 0.08 ? k * 12.5 : 1); if (a < 0.01) continue;
        const r = p.size * 1.55; x.globalAlpha = Math.min(1, a);
        const tex = SPR.contrailTex ? SPR.contrailTex(p.v || 0) : SPR.puff(p.c);
        x.save(); x.translate(p.x, p.y); x.rotate(p.a || 0);
        x.drawImage(tex, -r * 1.4, -r * 0.75, r * 2.8, r * 1.5); x.restore();
      } else if (p.type === 'debris') {
        if (p.z > 1) { x.globalAlpha = 0.28 * (1 - k); x.fillStyle = '#000'; x.fillRect(p.x - p.size * 0.4, p.y - p.size * 0.4, p.size * 0.8, p.size * 0.8); }
        x.save(); x.globalAlpha = Math.min(1, (1 - k) * 1.4); x.translate(p.x, p.y - p.z * 0.45); if (p.a) x.rotate(p.a);
        x.fillStyle = p.c; x.fillRect(-p.size * 0.6, -p.size * 0.4, p.size * 1.2, p.size * 0.8); x.restore();
      } else if (p.type === 'water') {
        x.globalAlpha = 1 - k; x.fillStyle = 'rgb(' + p.c + ')'; x.fillRect(p.x - p.size / 2, p.y - p.z * 0.4, p.size, p.size);
      } else if (p.type === 'plus') {
        x.globalAlpha = 1 - k; x.fillStyle = 'rgb(' + p.c + ')'; x.fillRect(p.x - 3, p.y - 0.8, 6, 1.6); x.fillRect(p.x - 0.8, p.y - 3, 1.6, 6);
      }
    }
    x.globalCompositeOperation = 'lighter';
    for (const p of P) {
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const k = p.life / p.max;
      if (p.type === 'fire') {
        const r = Math.max(0.8, p.size * (2.05 - k * 0.72));
        x.globalAlpha = Math.max(0, Math.pow(1 - k, 0.85));
        const stg = k < 0.25 ? 0 : k < 0.62 ? 1 : 2;
        const tex = SPR.fireTex ? SPR.fireTex(p.v || 0, stg) : SPR.puff(p.c);
        if (p.a) {
          x.translate(p.x, p.y); x.rotate(p.a);
          x.drawImage(tex, -r, -r, r * 2, r * 2); x.rotate(-p.a); x.translate(-p.x, -p.y);
        } else {
          x.drawImage(tex, p.x - r, p.y - r, r * 2, r * 2);
        }
      } else if (p.type === 'glow' || p.type === 'flare') {
        const r = Math.max(0.6, p.size * 1.6);
        x.globalAlpha = Math.max(0, (1 - k) * (p.type === 'glow' ? 0.88 : 1)); x.drawImage(SPR.puff(p.c), p.x - r, p.y - r, r * 2, r * 2);
      } else if (p.type === 'spark') {
        x.globalAlpha = Math.max(0, 1 - k * k); x.strokeStyle = 'rgb(' + p.c + ')'; x.lineWidth = p.size || 1.2;
        x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045); x.stroke();
      } else if (p.type === 'ring') {
        x.globalAlpha = 1; x.strokeStyle = 'rgba(' + p.c + ',' + ((1 - k) * (1 - k) * 0.68).toFixed(3) + ')'; x.lineWidth = 3.5 * (1 - k) + 0.6;
        x.beginPath(); x.arc(p.x, p.y, p.size, 0, 6.283); x.stroke();
      }
    }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  },
};

/* persistent ground decals: craters and scorch marks, baked into terrain chunks */
const Decals = {
  add(x, y, r, kind = 'crater') {
    const M = G.map; if (!M) return;
    M.craters.push([Math.round(x), Math.round(y), Math.round(r), kind === 'scorch' ? 1 : 0]);
    if (M.craters.length > 2500) M.craters.splice(0, 200);
    if (typeof Render !== 'undefined') Render.stampDecal(x, y, r, kind);
  },
  draw(x, cx, cy, r, kind) {
    const seed = ((cx * 73 + cy * 151) | 0) & 1023;
    if (kind === 1 || kind === 'scorch') {
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r * 1.25);
      g.addColorStop(0, 'rgba(16,14,12,0.68)');
      g.addColorStop(0.5, 'rgba(28,24,20,0.38)');
      g.addColorStop(1, 'rgba(20,18,16,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r * 1.25, 0, 6.283); x.fill();
      if (r >= 6) {
        x.strokeStyle = 'rgba(18,15,12,0.28)'; x.lineWidth = Math.max(0.8, r * 0.08);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * 6.283 + hash2(seed, i, 11) * 0.7, len = r * (0.7 + hash2(seed, i, 12) * 0.65);
          x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 0.2, cy + Math.sin(a) * r * 0.2);
          x.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); x.stroke();
        }
      }
      return;
    }
    // Outer ejecta blanket & radial blast rays
    const outer = x.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.35);
    outer.addColorStop(0, 'rgba(35,30,24,0.45)');
    outer.addColorStop(0.55, 'rgba(78,68,54,0.28)');
    outer.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = outer; x.beginPath(); x.arc(cx, cy, r * 1.35, 0, 6.283); x.fill();
    // Raised crater rim (sunlit NW, shaded SE)
    x.strokeStyle = 'rgba(135,120,98,0.38)'; x.lineWidth = Math.max(1.2, r * 0.18);
    x.beginPath(); x.arc(cx + r * 0.04, cy + r * 0.04, r * 0.78, -0.4, 2.7); x.stroke();
    x.strokeStyle = 'rgba(25,20,16,0.52)';
    x.beginPath(); x.arc(cx - r * 0.03, cy - r * 0.03, r * 0.78, 2.7, 5.88); x.stroke();
    // Deep crater pit
    const pit = x.createRadialGradient(cx - r * 0.1, cy - r * 0.1, 0, cx, cy, r * 0.78);
    pit.addColorStop(0, 'rgba(18,15,12,0.88)');
    pit.addColorStop(0.6, 'rgba(42,36,29,0.72)');
    pit.addColorStop(0.88, 'rgba(92,80,65,0.35)');
    pit.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = pit; x.beginPath(); x.arc(cx, cy, r * 0.8, 0, 6.283); x.fill();
    // Scattered rubble clods around crater lip
    if (r >= 8) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.283 + hash2(seed, i, 3) * 0.6, d = r * (0.68 + hash2(seed, i, 4) * 0.45), sz = 1 + hash2(seed, i, 5) * Math.min(3, r * 0.14);
        x.fillStyle = i % 2 ? 'rgba(45,38,32,0.65)' : 'rgba(115,102,84,0.55)';
        x.fillRect(cx + Math.cos(a) * d - sz / 2, cy + Math.sin(a) * d - sz / 2, sz, sz);
      }
    }
  },
};
