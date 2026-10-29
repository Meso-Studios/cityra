'use strict';
/* =====================================================================
   CITY.RA — eco.js
   Factions, resources, storage, power grid, upkeep and shortages,
   production queues, placement, selling, upgrades and research.
   ===================================================================== */

const BASE_CAP = { credits: 1e9, fuel: 1000, materials: 800, food: 600, water: 600, metal: 600, supplies: 500 };

const Eco = {
  makeFaction(i, key, o = {}) {
    const F = FACTIONS[key];
    const start = o.start || { credits: 6000, fuel: 400, materials: 400, food: 300, water: 300, metal: 250, supplies: 250 };
    return {
      id: i, key, name: F.name, short: F.short, color: F.color, isPlayer: !!o.player, isAI: !o.player, aiBonus: 1, alive: true, team: o.team == null ? i : o.team,
      res: { ...start }, cap: { ...BASE_CAP }, power: { prod: 0, use: 0 }, lowPower: false, radar: false,
      tech: new Set(o.tech || []), research: null, q: { bld: [], inf: [], veh: [], air: [], sea: [] }, primary: {},
      rep: 0, civKills: 0, lack: {}, fuelUse: 0, income: { tax: 0, trade: 0 }, rates: {}, last: { ...start },
      stats: { kills: 0, lost: 0, bkills: 0, blost: 0, harvested: 0, aid: 0, evac: 0, built: 0, trained: 0 },
      aiLab: { tier: 1, sub: 0, runs: 0, batch: [], infra: {}, spent: 0 },
      startX: 0, startY: 0, unlimited: !!o.unlimited,
    };
  },

  costOf(f, def, isUnit) {
    const F = FACTIONS[f.key], out = {};
    let m = isUnit && F.mod.cost ? F.mod.cost[def.cat] || 1 : 1;
    if (isUnit && def.robotic) m *= AILab.mult(f).costMul;
    for (const k in def.cost) out[RES_SHORT[k] || k] = Math.round(def.cost[k] * m);
    return out;
  },
  canAfford(f, cost) { if (f.unlimited) return true; for (const k in cost) if ((f.res[k] || 0) < cost[k]) return false; return true; },
  pay(f, cost) { if (f.unlimited) return; for (const k in cost) f.res[k] -= cost[k]; },
  refund(f, cost, k = 1) { for (const r in cost) f.res[r] += cost[r] * k; },
  missing(f, cost) { const m = []; for (const k in cost) if ((f.res[k] || 0) < cost[k]) m.push(RES_LABEL[k]); return m; },

  has(f, type, built = true) { return G.blds.some((b) => !b.dead && b.owner === f.id && b.type === type && (!built || b.built >= 1)); },
  count(f, type) { let n = 0; for (const b of G.blds) if (!b.dead && b.owner === f.id && b.type === type) n++; return n; },

  // requirement check; returns null if available, else a reason
  locked(f, key, isUnit) {
    const d = isUnit ? UNITS[key] : BLDS[key];
    if (d.faction && d.faction !== f.key) return 'Exclusive to ' + FACTIONS[d.faction].name;
    if (isUnit && !this.has(f, PRODUCER[d.cat])) return 'Needs ' + BLDS[PRODUCER[d.cat]].name;
    if (!isUnit && !this.has(f, 'hq')) return 'Needs a Headquarters';
    if (G.cfg.instant && f.isPlayer) return null; // sandbox: no prerequisites
    if (d.req) for (const r of d.req) if (!this.has(f, r)) return 'Needs ' + BLDS[r].name;
    if (d.tech && !f.tech.has(d.tech)) return 'Research ' + TECH[d.tech].name;
    return null;
  },

  queue(f, key, isUnit) {
    const d = isUnit ? UNITS[key] : BLDS[key], cat = isUnit ? d.cat : 'bld';
    if (this.locked(f, key, isUnit)) return false;
    const q = f.q[cat];
    if (q.length >= (cat === 'bld' ? 6 : 12)) return false;
    q.push({ key, isUnit, t: 0, T: d.time, paid: false, done: false, hold: false, cost: this.costOf(f, d, isUnit) });
    return true;
  },
  cancel(f, cat, idx) {
    const q = f.q[cat], it = q[idx]; if (!it) return;
    if (it.paid) this.refund(f, it.cost, 1);
    q.splice(idx, 1);
  },
  speed(f, cat) {
    const ptype = cat === 'bld' ? 'hq' : PRODUCER[cat];
    let n = 0, lvl = 1;
    for (const b of G.blds) if (!b.dead && b.owner === f.id && b.type === ptype && b.built >= 1) { n++; if (b.level > 1) lvl = 1.3; }
    if (!n) return 0;
    let s = Math.min(2.5, 1 + 0.5 * (n - 1)) * lvl * (f.lowPower ? 0.5 : 1) * (1 + 0.22 * AILab.infraLvl(f, 'factory'));
    if (cat === 'inf' && (f.lack.food || f.lack.water)) s *= 0.5;
    if ((cat === 'veh' || cat === 'air' || cat === 'sea') && f.lack.fuel) s *= 0.5;
    if (f.isAI) s *= f.aiSpeed || 1;
    return s * (G.cfg.buildSpeed || 1);
  },

  updateQueues(f, dt) {
    for (const cat in f.q) {
      const q = f.q[cat], it = q[0]; if (!it || it.done || it.hold) continue;
      if (!it.paid) { if (this.canAfford(f, it.cost)) { this.pay(f, it.cost); it.paid = true; } else { it.waiting = true; continue; } }
      it.waiting = false;
      const sp = this.speed(f, cat); if (!sp) continue;
      it.t += G.cfg.instant && f.isPlayer ? it.T : dt * sp;
      if (it.t >= it.T) {
        if (it.isUnit) {
          if (this.spawnProduced(f, it.key)) { q.shift(); f.stats.trained++; if (f.id === G.player) Bus.emit('msg', UNITS[it.key].name + ' ready', 'info'); Bus.emit('sfx', 'ready'); }
          else it.t = it.T;
        } else { it.done = true; if (f.id === G.player) { Bus.emit('msg', BLDS[it.key].name + ' ready to place', 'good'); Bus.emit('sfx', 'ready'); } }
      }
    }
    if (f.research) {
      const r = f.research, lab = this.has(f, 'lab'); if (!lab) return;
      r.t += G.cfg.instant && f.isPlayer ? r.T : dt * (f.lowPower ? 0.5 : 1) * (FACTIONS[f.key].mod.research || 1) * (f.isAI ? f.aiSpeed || 1 : 1);
      if (r.t >= r.T) { this.completeTech(f, r.key); f.research = null; }
    }
  },
  startResearch(f, key) {
    if (f.research || f.tech.has(key) || !this.has(f, 'lab')) return false;
    if ((TECH[key].req || []).some((k) => !f.tech.has(k))) return false;
    const c = { credits: TECH[key].cost }; if (!this.canAfford(f, c)) return false;
    this.pay(f, c); f.research = { key, t: 0, T: TECH[key].time }; return true;
  },
  completeTech(f, key) {
    f.tech.add(key);
    if (key === 'composite') for (const u of G.units) if (u.owner === f.id && u.d.cat === 'veh') { u.maxHp = Math.round(u.maxHp * 1.2); u.hp *= 1.2; }
    Bus.emit('msg', 'Research complete: ' + TECH[key].name, f.id === G.player ? 'good' : 'info');
    if (f.id === G.player) Bus.emit('sfx', 'ready');
  },

  place(f, tx, ty) {
    const it = f.q.bld[0]; if (!it || !it.done) return false;
    const ok = World.canPlace(it.key, f.id, tx, ty); if (!ok.ok) return ok;
    const b = World.addBld(it.key, f.id, tx, ty);
    f.q.bld.shift(); f.stats.built++;
    if (it.key === 'refinery') {
      const dock = Abil.refDock(b, { id: G.nextId, d: UNITS.harvester });
      const h = World.spawnUnit('harvester', f.id, dock.x, dock.y);
      h.a = Math.PI / 2;
    }
    if (it.key === 'shelter') b.refugees = 0;
    Bus.emit('sfx', 'place', b.x, b.y);
    if (BLDS[it.key].repeat && f.id === G.player && UI.shift) this.queue(f, it.key, false);
    return { ok: true, b };
  },

  sell(b) {
    const f = fac(b.owner), c = this.costOf(f, b.d, false);
    f.res.credits += (c.credits || 0) * 0.5 * (b.hp / b.maxHp); f.res.materials += (c.materials || 0) * 0.3;
    World.freeTiles(b); b.dead = true; G.ents.delete(b.id);
    FX.add('dust', b.x, b.y, { size: 10, grow: 30, max: 1.2, c: '150,140,120', alpha: 0.5 });
    if (b.docks) for (const id of b.docks) { const p = G.ents.get(id); if (p) { p.home = 0; p.state = 'orbit'; p.ord = { t: 'orbit', x: p.x, y: p.y }; } }
    Bus.emit('sfx', 'cash', b.x, b.y);
  },
  upgrade(b) {
    const f = fac(b.owner), d = b.d; if (!d.up || b.level > 1 || b.upg) return false;
    const cost = {}; for (const k in d.up.cost) cost[RES_SHORT[k] || k] = d.up.cost[k];
    if (!this.canAfford(f, cost)) { if (f.id === G.player) Bus.emit('msg', 'Insufficient resources: ' + this.missing(f, cost).join(', '), 'warn'); return false; }
    this.pay(f, cost); b.upg = { t: 0, T: d.up.time }; return true;
  },

  spawnProduced(f, key) {
    const d = UNITS[key], ptype = PRODUCER[d.cat];
    const prods = G.blds.filter((b) => !b.dead && b.owner === f.id && b.type === ptype && b.built >= 1);
    if (!prods.length) return false;
    let p = prods.find((b) => b.id === f.primary[d.cat]) || prods[(f.rr = (f.rr || 0) + 1) % prods.length];
    let x = p.x, y = (p.ty + p.h) * TILE + 12, u;
    if (d.cat === 'air') {
      if (d.plane) {
        const hg = prods.find((b) => b.docks.indexOf(0) >= 0);
        if (!hg) { if (f.id === G.player && !f.dockMsg) { f.dockMsg = true; Bus.emit('msg', 'All airfield docks are full — build another airfield', 'warn'); setTimeout(() => (f.dockMsg = false), 15000); } return false; }
        p = hg; const di = hg.docks.indexOf(0), pos = Air.dockPos(hg, di);
        u = World.spawnUnit(key, f.id, pos.x, pos.y, { docked: true, a: -Math.PI / 2 }); hg.docks[di] = u.id; u.home = hg.id; u.state = 'docked';
      } else { u = World.spawnUnit(key, f.id, p.x, p.y + 10, { a: -Math.PI / 2 }); u.alt = 0.2; u.state = 'hover'; u.home = p.id; }
    } else if (d.cat === 'sea') {
      const M = G.map; let spot = -1;
      for (let r = 1; r <= 4 && spot < 0; r++) for (let yy = p.ty - r; yy < p.ty + p.h + r && spot < 0; yy++) for (let xx = p.tx - r; xx < p.tx + p.w + r; xx++) { if (Path.passable(d.mc, xx, yy) && MOVE.naval[M.terr[yy * M.w + xx]]) { spot = yy * M.w + xx; break; } }
      if (spot < 0) return false;
      u = World.spawnUnit(key, f.id, ((spot % M.w) + 0.5) * TILE, (((spot / M.w) | 0) + 0.5) * TILE);
    } else {
      // exit tile below the producer
      const M = G.map; let spot = -1;
      for (let r = 0; r < 4 && spot < 0; r++) for (let xx = p.tx - r; xx < p.tx + p.w + r && spot < 0; xx++) { const yy = p.ty + p.h + r; if (Path.passable(d.mc, xx, yy)) spot = yy * M.w + xx; }
      if (spot < 0) spot = Path.nearestPassable(d.mc, ((p.x / TILE) | 0), p.ty + p.h, 6);
      if (spot < 0) return false;
      x = ((spot % M.w) + 0.5) * TILE; y = (((spot / M.w) | 0) + 0.5) * TILE;
      u = World.spawnUnit(key, f.id, x, y, { a: Math.PI / 2 });
    }
    if (p.rally && u.d.cat !== 'air' && !(u.d.ab && u.d.ab.harvest)) World.moveTo(u, p.rally.x + U.rnd(-12, 12), p.rally.y + U.rnd(-12, 12));
    else if (u.d.cat !== 'air' && !(u.d.ab && u.d.ab.harvest)) World.moveTo(u, u.x + U.rnd(-20, 20), u.y + 30 + U.rnd(0, 20));
    Bus.emit('produced', u, p);
    return true;
  },

  /* ---------- bitcoin mining ----------
     Each farm's payout scales with the datacenter network and with the
     number of farms (the mining pool effect). */
  btcIncome(f, miners) {
    if (miners == null) miners = this.count(f, 'bitcoin');
    const dcs = AILab.datacenters(f);
    const mult = U.clamp(1 + 0.12 * Math.max(0, miners - 1), 1, 2.5);
    const each = 1.2 * (1 + 0.45 * dcs) * mult;
    return { miners, dcs, each, total: each * miners, mult };
  },

  /* ---------- per-second economy ---------- */
  tick() {
    for (const f of G.factions) {
      if (!f.alive) continue;
      const cap = { ...BASE_CAP }; let prod = 0, use = 0, radar = false;
      const make = { fuel: 0, materials: 0, food: 0, water: 0, metal: 0, supplies: 0, credits: 0 };
      let infN = 0;
      const btc = this.btcIncome(f);
      const gridK = 1 + 0.22 * AILab.infraLvl(f, 'power');
      for (const b of G.blds) {
        if (b.dead || b.owner !== f.id || b.built < 1) continue;
        const d = b.d, k = b.hp / b.maxHp;
        if (d.pw > 0) prod += (b.type === 'power' && b.level > 1 ? 200 : d.pw) * (0.4 + 0.6 * k) * gridK; else use -= d.pw || 0;
        if (d.store) for (const r in d.store) cap[r] += d.store[r];
        if (b.type === 'radar') radar = true;
      }
      for (const c of G.civb) if (c.ctrl === f.id && !c.rubble) {
        if (c.d.cap === 'power' && Civ.functional(c)) prod += 120 * gridK;
        if (c.d.cap === 'oil') { make.fuel += 1.5; make.credits += 1; }
        if (c.d.cap === 'fuel') make.fuel += 0.4;
        if (c.d.cap === 'airport') make.credits += 3;
        if (c.d.cap === 'port') make.credits += 2;
        if (c.d.cap === 'heal') for (const o of G.hash.query(c.x, c.y, 5 * TILE, World.tmp)) if (o.kind === 'unit' && o.owner === f.id && o.d.cat === 'inf' && o.hp < o.maxHp) o.hp = Math.min(o.maxHp, o.hp + 5);
      }
      f.power.prod = Math.round(prod); f.power.use = Math.round(use);
      f.lowPower = use > prod; f.radar = radar && !f.lowPower;
      const pk = f.lowPower ? 0.5 : 1;
      const resK = 1 + 0.25 * AILab.infraLvl(f, 'resource'), oreK = 1 + 0.2 * AILab.infraLvl(f, 'ore');
      const makeK = (r) => (r === 'metal' ? oreK : r === 'food' || r === 'water' || r === 'fuel' || r === 'supplies' ? resK : 1);
      for (const b of G.blds) {
        if (b.dead || b.owner !== f.id || b.built < 1) continue;
        const d = b.d, k = (0.4 + 0.6 * b.hp / b.maxHp) * pk * (b.level > 1 ? 1.5 : 1);
        if (d.btc) { make.credits += btc.each * k; continue; }
        if (d.make) for (const r in d.make) {
          if (r === 'supplies' && d.eat) { const need = d.eat.food * k, needM = d.eat.metal * k; if (f.res.food >= need && f.res.metal >= needM) { f.res.food -= need; f.res.metal -= needM; make.supplies += d.make.supplies * k * resK; } }
          else make[r] += d.make[r] * k * makeK(r) * (r === 'food' ? Math.max(0, 1 - Fall.at(b.x, b.y) * 1.2) * (G.nuclearWinter ? 0.4 : 1) : 1);
        }
        if (d.convert && f.res.credits > 30) { const n = 1.2 * pk * (b.level > 1 ? 1.5 : 1) * (1 + 0.22 * AILab.infraLvl(f, 'factory')); f.res.credits -= n * 2; make.materials += n; }
      }
      for (const u of G.units) if (u.owner === f.id && !u.dead && u.d.cat === 'inf') infN++;
      // refugee upkeep handled in Civ; infantry upkeep
      const foodUse = infN * 0.012, waterUse = infN * 0.012;
      for (const r in make) f.res[r] = (f.res[r] || 0) + make[r] * (f.isAI && r !== 'credits' ? f.aiBonus : 1);
      if (f.isAI && f.aiTrickle) f.res.credits += f.aiTrickle;
      f.res.food -= foodUse; f.res.water -= waterUse; f.res.fuel -= f.fuelUse; f.fuelUse = 0;
      // trade agreements
      for (const o of G.factions) if (o !== f && o.alive && G.dip[f.id][o.id].trade) { const v = 3 * (FACTIONS[f.key].mod.trade || 1) * (this.has(f, 'logistics') ? 1.5 : 1) * (G.dip[f.id][o.id].sanction || G.dip[o.id][f.id].sanction ? 0 : 1); f.res.credits += v; f.income.trade += v; }
      for (const r of RES_KEYS) { if (r === 'credits') continue; f.res[r] = U.clamp(f.res[r], 0, cap[r]); }
      if (f.unlimited) for (const r of RES_KEYS) f.res[r] = Math.max(f.res[r], r === 'credits' ? 50000 : cap[r]);
      f.cap = cap;
      const hadShort = { ...f.lack };
      f.lack.food = f.res.food < 1 && infN > 0; f.lack.water = f.res.water < 1 && infN > 0;
      f.lack.fuel = f.res.fuel < 1; f.lack.supplies = f.res.supplies < 1;
      if (f.id === G.player) for (const r of ['food', 'water', 'fuel', 'supplies']) if (f.lack[r] && !hadShort[r]) Bus.emit('msg', RES_LABEL[r] + ' shortage — ' + ({ food: 'infantry morale and training suffer', water: 'infantry morale and training suffer', fuel: 'vehicles slowed, aircraft grounded', supplies: 'no resupply for ammunition' })[r], 'bad');
      // rates (per minute, smoothed)
      for (const r of RES_KEYS) { const dlt = (f.res[r] - (f.last[r] || 0)) * 60; f.rates[r] = f.rates[r] == null ? dlt : U.lerp(f.rates[r], dlt, 0.15); f.last[r] = f.res[r]; }
    }
    Market.tick();
  },

  checkAlive() {
    for (const f of G.factions) {
      if (!f.alive || f.noElim) continue;
      const hasB = G.blds.some((b) => b.owner === f.id && !b.dead && !b.d.wall && !b.d.walk);
      const hasU = G.units.some((u) => u.owner === f.id && !u.dead && (u.d.w.length || (u.d.ab && (u.d.ab.carry || u.d.ab.capture))));
      if (!hasB && !hasU) {
        f.alive = false;
        for (const s of G.settlements) if (s.ctrl === f.id) s.ctrl = -1;
        for (const c of G.civb) if (c.ctrl === f.id) c.ctrl = -1;
        Zones.clearClaims(f.id);
        Bus.emit('msg', f.name + ' has been defeated', f.id === G.player ? 'bad' : 'good');
        Bus.emit('defeated', f);
      }
    }
  },
};

/* =====================================================================
   AI INNOVATION — datacenter training runs, model tiers 1–12
   (Drone → Servo → Rover → Sentry → Cortex → Vector → Chassis →
   Turbine → Goliath → Matrix → Colossus → Mainframe 12.8), robotic
   combat scaling and infrastructure AI optimizations.
   ===================================================================== */
const AILab = {
  fresh() { return { tier: 1, sub: 0, runs: 0, batch: [], infra: {}, specs: {}, spent: 0 }; },

  init(f) {
    if (!f.aiLab) f.aiLab = this.fresh();
    const L = f.aiLab;
    if (!Array.isArray(L.batch)) L.batch = [];
    if (!L.infra || typeof L.infra !== 'object') L.infra = {};
    if (!L.specs || typeof L.specs !== 'object') L.specs = {};
    for (const r of L.batch) { if (r.T0 == null) r.T0 = r.T || 1; if (r.t == null) r.t = 0; }
    L.tier = U.clamp(L.tier | 0 || 1, 1, AI_MODELS.length);
    L.sub = Math.max(0, L.sub | 0);
    if (L.tier >= AI_MODELS.length) L.tier = AI_MODELS.length, L.sub = Math.min(L.sub, AI_MODELS[AI_MODELS.length - 1].maxSub);
    L.runs = L.runs | 0; L.spent = +L.spent || 0;
    return L;
  },

  model(f) { return AI_MODELS[this.init(f).tier - 1]; },
  next(f) { return AI_MODELS[Math.min(AI_MODELS.length - 1, this.init(f).tier)]; },
  atMax(f) { const L = this.init(f); return L.tier >= AI_MODELS.length && L.sub >= AI_MODELS[L.tier - 1].maxSub; },
  label(f) { const L = this.init(f); return AI_MODELS[L.tier - 1].name + ' ' + L.tier + '.' + L.sub; },
  rankText(f) { const L = this.init(f), m = this.model(f); return L.tier + '.' + L.sub + ' / ' + AI_MODELS.length + '.' + AI_MODELS[AI_MODELS.length - 1].maxSub + ' · ' + m.name; },
  progress(f) { const L = this.init(f), m = this.model(f); return U.clamp(L.sub / Math.max(1, m.maxSub), 0, 1); },

  datacenters(f) { let n = 0; for (const b of G.blds) if (!b.dead && b.owner === f.id && b.type === 'datacenter' && b.built >= 1) n++; return n; },
  dcLevel(f) { let lv = 1; for (const b of G.blds) if (!b.dead && b.owner === f.id && b.type === 'datacenter' && b.built >= 1 && b.level > lv) lv = b.level; return lv; },
  slots(f) { const n = this.datacenters(f); return n <= 0 ? 0 : Math.min(4, n + (this.dcLevel(f) > 1 ? 1 : 0)); },

  runCost(f) {
    const L = this.init(f), m = this.model(f);
    return Math.round(m.cost * (1 + L.sub * 0.07) * (1 - 0.03 * (L.tier - 1)) * (1 - 0.04 * (this.dcLevel(f) - 1)));
  },
  // Datacenter network speed: every extra datacenter adds a parallel slot and
  // cuts training time. This is applied live, so buying one mid-run speeds
  // up all active training runs immediately.
  netSpeed(f) {
    const dcs = this.datacenters(f);
    if (dcs <= 0) return 0;
    return 1 + 0.3 * (dcs - 1) + 0.15 * (this.dcLevel(f) - 1);
  },
  factoryK(f) { return 1 + 0.22 * this.infraLvl(f, 'factory'); },
  trainSpeed(f) { return this.netSpeed(f) * this.factoryK(f) * (f.lowPower ? 0.5 : 1); },
  runBaseTime(f) { const L = this.init(f), m = this.model(f); return Math.max(5, m.time * (1 + L.sub * 0.05)); },
  runTime(f) { const s = Math.max(0.05, this.trainSpeed(f)); return this.runBaseTime(f) / s; },
  runState(f, r) {
    const T0 = r.T0 || r.T || 1, s = Math.max(0.05, this.trainSpeed(f));
    const t = U.clamp(r.t, 0, T0);
    return { pct: t / T0, eta: (T0 - t) / s, speed: s, T0 };
  },

  startRun(f, n = 1) {
    const L = this.init(f);
    if (this.atMax(f)) { this.say(f, 'Mainframe 12.8 is the apex — no further training possible.', 'info'); return 0; }
    const dcs = this.datacenters(f);
    if (dcs <= 0) { this.say(f, 'Training runs need an AI Datacenter — build one first.', 'warn'); return 0; }
    const slots = this.slots(f), free = slots - L.batch.length;
    if (free <= 0) { this.say(f, 'All ' + slots + ' datacenter training slot' + (slots === 1 ? ' is' : 's are') + ' busy.', 'warn'); return 0; }
    n = Math.max(1, Math.min(n | 0, free));
    const each = this.runCost(f);
    let done = 0;
    for (let i = 0; i < n; i++) {
      const c = { credits: each };
      if (!this.canAffordFor(f, c)) break;
      if (!f.unlimited) f.res.credits -= each;
      L.spent += each;
      const T0 = G.cfg.instant && f.isPlayer ? 0.5 : this.runBaseTime(f);
      L.batch.push({ t: 0, T0, T: T0, tier: L.tier, sub: L.sub });
      done++;
    }
    if (!done) { this.say(f, 'Training run needs ' + U.fmt(each) + ' credits.', 'warn'); return 0; }
    this.say(f, 'Datacenter training run' + (done > 1 ? 's' : '') + ' started — ' + this.label(f) + ' (' + U.fmt(each * done) + ' cr)', 'good');
    Bus.emit('sfx', 'ready');
    return done;
  },
  canAffordFor(f, cost) { return f.unlimited || f.res.credits >= cost.credits; },
  say(f, text, kind) { if (f.id === G.player) UI.msg(text, kind || 'info'); },

  update(f, dt) {
    if (!f || !f.alive) return;
    const L = this.init(f);
    if (!L.batch.length) return;
    const dc = this.datacenters(f);
    if (dc <= 0) return; // runs are paused while every datacenter is gone
    const sp = this.trainSpeed(f);
    if (sp <= 0) return;
    for (let i = L.batch.length - 1; i >= 0; i--) {
      const r = L.batch[i], T0 = r.T0 || r.T || 1;
      r.t += dt * sp;
      if (r.t >= T0) { L.batch.splice(i, 1); this.advance(f); }
    }
  },

  advance(f) {
    const L = this.init(f), m = this.model(f);
    const before = this.mult(f);
    L.runs++;
    let breakthrough = false;
    if (L.sub >= m.maxSub) {
      if (L.tier < AI_MODELS.length) { L.tier++; L.sub = 0; breakthrough = true; }
      else L.sub = m.maxSub;
    } else L.sub++;
    const after = this.mult(f);
    // every existing robotic chassis is retrofitted with the new model
    const k = after.hp / Math.max(0.01, before.hp);
    for (const u of G.units) if (!u.dead && u.owner === f.id && u.d.robotic) {
      u.maxHp = Math.round(u.maxHp * k); u.hp = Math.min(u.maxHp, Math.round(u.hp * k)); u.aiMul = after;
    }
    if (f.id === G.player) {
      this.say(f, breakthrough ? 'AI model breakthrough — ' + this.label(f) + ' online. Robotic units upgraded.' : 'Training complete — ' + this.label(f) + ' (' + Math.round(this.progress(f) * 100) + '%)', 'good');
      Bus.emit('sfx', 'ready');
    }
    Bus.emit('aiTrained', f, L);
  },

  // Combat multipliers for robotic units: each new model is a major jump,
  // the 2–8 sub-steps inside a model add a further gradual improvement.
  mult(f) {
    const L = this.init(f), cur = AI_MODELS[L.tier - 1], nxt = AI_MODELS[Math.min(AI_MODELS.length - 1, L.tier)];
    const frac = (L.sub / Math.max(1, cur.maxSub)) * (L.tier >= AI_MODELS.length ? 0 : 0.4);
    const lerp = (a, b) => a + (b - a) * frac;
    let out;
    if (L.tier >= AI_MODELS.length) {
      const s = L.sub * 0.025;
      out = { dmg: cur.dmg * (1 + s), hp: cur.hp * (1 + s), spd: cur.spd * (1 + s * 0.3), rel: cur.rel * (1 - s * 0.3), costMul: cur.costMul * (1 - s * 0.2) };
    } else out = { dmg: lerp(cur.dmg, nxt.dmg), hp: lerp(cur.hp, nxt.hp), spd: lerp(cur.spd, nxt.spd), rel: lerp(cur.rel, nxt.rel), costMul: lerp(cur.costMul, nxt.costMul) };
    // combat specializations
    const as = this.specLvl(f, 'assault'), ae = this.specLvl(f, 'aegis'), rc = this.specLvl(f, 'recon'), lg = this.specLvl(f, 'logistics'), sg = this.specLvl(f, 'siege');
    out.dmg *= 1 + 0.12 * as;
    out.hp *= 1 + 0.12 * ae;
    out.spd *= 1 + 0.08 * rc;
    out.rel *= 1 - 0.04 * as;
    out.costMul *= 1 - 0.06 * lg;
    out.range = 1 + 0.10 * sg;
    out.vsBld = 1 + 0.20 * sg;
    return out;
  },

  /* ---------- combat specializations ---------- */
  specLvl(f, key) { return this.init(f).specs[key] || 0; },
  specCost(f, key) { const d = AI_SPECS[key], lv = this.specLvl(f, key); return Math.round(d.baseCost * (lv + 1) * (1 + 0.12 * (this.init(f).tier - 1))); },
  specWhy(f, key) {
    const d = AI_SPECS[key], L = this.init(f), lv = this.specLvl(f, key);
    if (this.datacenters(f) <= 0) return 'Needs an AI Datacenter';
    if (L.tier < d.minTier) return 'Needs model tier ' + d.minTier + ' (' + AI_MODELS[d.minTier - 1].name + ')';
    if (lv >= d.maxLvl) return 'Maxed';
    const c = this.specCost(f, key);
    if (!f.unlimited && f.res.credits < c) return 'Needs ' + U.fmt(c) + ' cr';
    return '';
  },
  buySpec(f, key) {
    const why = this.specWhy(f, key);
    if (why) { this.say(f, (AI_SPECS[key] ? AI_SPECS[key].name + ': ' : '') + why, 'warn'); return false; }
    const before = this.mult(f), L = this.init(f), c = this.specCost(f, key);
    if (!f.unlimited) f.res.credits -= c;
    L.spent += c;
    L.specs[key] = this.specLvl(f, key) + 1;
    const after = this.mult(f), k = after.hp / Math.max(0.01, before.hp);
    for (const u of G.units) if (!u.dead && u.owner === f.id && u.d.robotic) {
      u.maxHp = Math.round(u.maxHp * k); u.hp = Math.min(u.maxHp, Math.round(u.hp * k)); u.aiMul = after;
    }
    this.say(f, AI_SPECS[key].name + ' level ' + L.specs[key] + ' installed — robotic fleet updated', 'good');
    Bus.emit('sfx', 'cash');
    return true;
  },

  /* ---------- infrastructure optimizations ---------- */
  infraLvl(f, key) { return this.init(f).infra[key] || 0; },
  infraCost(f, key) { const d = AI_INFRA_OPTS[key], lv = this.infraLvl(f, key); return Math.round(d.baseCost * (lv + 1) * (1 + 0.15 * (this.init(f).tier - 1))); },
  infraWhy(f, key) {
    const d = AI_INFRA_OPTS[key], L = this.init(f), lv = this.infraLvl(f, key);
    if (this.datacenters(f) <= 0) return 'Needs an AI Datacenter';
    if (L.tier < d.minTier) return 'Needs model tier ' + d.minTier + ' (' + AI_MODELS[d.minTier - 1].name + ')';
    if (lv >= d.maxLvl) return 'Maxed';
    const c = this.infraCost(f, key);
    if (!f.unlimited && f.res.credits < c) return 'Needs ' + U.fmt(c) + ' cr';
    return '';
  },
  buyInfra(f, key) {
    const why = this.infraWhy(f, key);
    if (why) { this.say(f, (AI_INFRA_OPTS[key] ? AI_INFRA_OPTS[key].name + ': ' : '') + why, 'warn'); return false; }
    const L = this.init(f), c = this.infraCost(f, key);
    if (!f.unlimited) f.res.credits -= c;
    L.spent += c;
    L.infra[key] = this.infraLvl(f, key) + 1;
    this.say(f, AI_INFRA_OPTS[key].name + ' installed — level ' + L.infra[key] + ' of ' + AI_INFRA_OPTS[key].maxLvl, 'good');
    Bus.emit('sfx', 'cash');
    return true;
  },

  /* ---------- enemy AI invests in models and optimizations ---------- */
  aiTick(f) {
    const L = this.init(f);
    if (this.datacenters(f) <= 0) return;
    const tier = AI_MODELS[L.tier - 1];
    if (f.res.credits > this.runCost(f) * 1.6 && L.batch.length < this.slots(f) && Math.random() < 0.35) this.startRun(f, 1);
    if (f.res.credits > 4000 && Math.random() < 0.22) {
      for (const key in AI_INFRA_OPTS) if (!this.infraWhy(f, key)) { this.buyInfra(f, key); break; }
    }
    if (f.res.credits > 5000 && Math.random() < 0.18) {
      for (const key in AI_SPECS) if (!this.specWhy(f, key)) { this.buySpec(f, key); break; }
    }
  },
};

/* =====================================================================
   STOCK & MUNICIPAL EXCHANGE
   Invest in listed corporations (defense, mining, energy, logistics,
   agri, robotics) AND municipal bonds/equities for every city/town on
   the map. Prices & dividends react dynamically to real-time theatre
   events, city prosperity, mining output, research, and combat.
   ===================================================================== */
const CORP_DEFS = [
  {
    id: 'c_aegis', ticker: 'AEGS', name: 'Aegis Defense Systems', sector: 'Defense & Aerospace', base: 140, div: 0.016,
    cityBlds: ['factory', 'airport', 'warehouse', 'checkpoint'],
    desc: 'Armoured vehicles, aerospace frames and precision munitions. Stock valuation depends on intact city Factories, Airports, Warehouses & Checkpoints plus active military combat.',
  },
  {
    id: 'c_orlov', ticker: 'ORLV', name: 'Orlov Heavy Mining & Construction', sector: 'Resources & Construction', base: 110, div: 0.022,
    cityBlds: ['factory', 'construction', 'warehouse', 'station'],
    desc: 'Ore smelting, steelworks and civil reconstruction. Dependent on city Factories, Construction Sites, Warehouses & Rail Stations as well as active Refineries and Ore Collectors.',
  },
  {
    id: 'c_helios', ticker: 'HLIO', name: 'Helios Power & Grid', sector: 'Energy & Utilities', base: 95, div: 0.026,
    cityBlds: ['powerstation', 'substation', 'waterplant', 'fuelstation', 'derrick'],
    desc: 'Regional power generation, substations, water treatment and fuel distribution. Directly tied to functional city Power Stations, Substations, Water Plants, Fuel Stations & Oil Derricks.',
  },
  {
    id: 'c_trans', ticker: 'TRNS', name: 'Trans-Continental Logistics', sector: 'Shipping & Transit', base: 105, div: 0.020,
    cityBlds: ['port', 'airport', 'station', 'transit', 'warehouse', 'market'],
    desc: 'Maritime harbours, rail freight, bus depots and highway convoys. Driven by intact city Harbours, Airports, Rail Stations, Bus Depots, Markets & highway traffic.',
  },
  {
    id: 'c_ceres', ticker: 'CRES', name: 'Ceres Agri & MedCorp', sector: 'Food, Retail & Medical', base: 88, div: 0.024,
    cityBlds: ['farmhouse', 'supermarket', 'hospital', 'clinic', 'restaurant', 'shop'],
    desc: 'Agri-food supply chains, supermarkets and municipal hospitals. Depends on functional Farmsteads, Supermarkets, Hospitals, Clinics, Restaurants & Shops across cities.',
  },
  {
    id: 'c_meridian_fin', ticker: 'MFIN', name: 'Meridian Bancorp & Realty', sector: 'Finance & Urban Realty', base: 120, div: 0.025,
    cityBlds: ['bank', 'cityhall', 'apartment', 'market', 'shop', 'house'],
    desc: 'Commercial banking, municipal credit and residential real estate. Dependent on city Banks, City Halls, Apartment Blocks, Market Halls & thriving urban populations.',
  },
  {
    id: 'c_nexus', ticker: 'NXRB', name: 'Nexus Cybernetics & AI', sector: 'Robotics & AI Models', base: 168, div: 0.015,
    cityBlds: ['university', 'commtower', 'school', 'substation', 'bank'],
    desc: 'Autonomous combat robotics, neural datacenters and foundation AI models. Depends on city Universities, Comm Towers, Schools & Substations plus AI Datacenters and model tiers.',
  },
];

const Market = {
  init() {
    const r = RNG((G.map ? G.map.seed : 1) + 404);
    const items = [];
    // Listed companies (dependent on the presence & health of specific city buildings)
    for (const c of CORP_DEFS) {
      const p0 = Math.round(c.base * (0.92 + r() * 0.16));
      const hist = [];
      let hp = p0;
      for (let i = 0; i < 36; i++) { hp = Math.max(15, hp * (1 + (r() - 0.495) * 0.025)); hist.push(Math.round(hp * 10) / 10); }
      items.push({
        id: c.id, kind: 'corp', ticker: c.ticker, name: c.name, sector: c.sector, desc: c.desc,
        cityBlds: c.cityBlds || [], bldActive: 0, bldTotal: 0, bldBreak: '',
        price: hist[hist.length - 1], startPrice: p0, prevPrice: hist[hist.length - 2] || p0,
        divRate: c.div, shares: 0, avgCost: 0, hist, trend: 0,
      });
    }
    // Municipal city equities / bonds for every settlement on the map
    const usedTick = new Set(items.map((x) => x.ticker));
    for (const s of G.settlements || []) {
      let tk = s.name.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4);
      while (tk.length < 3) tk += 'X';
      if (usedTick.has(tk)) tk = tk.slice(0, 3) + (s.id % 10);
      usedTick.add(tk);
      const base = s.kind === 'city' ? 130 : s.kind === 'town' ? 90 : 60;
      const p0 = Math.round(base * (0.9 + r() * 0.2));
      const hist = [];
      let hp = p0;
      for (let i = 0; i < 36; i++) { hp = Math.max(12, hp * (1 + (r() - 0.495) * 0.02)); hist.push(Math.round(hp * 10) / 10); }
      items.push({
        id: 'city_' + s.id, kind: 'city', settId: s.id, ticker: tk,
        name: s.name + ' Municipal', sector: (s.kind[0].toUpperCase() + s.kind.slice(1)) + ' Bond & Development',
        desc: 'Municipal development fund for ' + s.name + '. Value and yield track local population, happiness, power/water, infrastructure and safety. You can also directly fund civic development.',
        price: hist[hist.length - 1], startPrice: p0, prevPrice: hist[hist.length - 2] || p0,
        divRate: s.kind === 'city' ? 0.025 : 0.028, shares: 0, avgCost: 0, hist, trend: 0, devLevel: 0,
      });
    }
    G.market = { t: 0, items, divPaid: 0, lastDiv: 0, realized: 0, filter: 'all', sel: items[0] ? items[0].id : null };
    for (const it of items) this.fundamental(it);
  },

  ensure() {
    if (!G.market || !G.market.items || !G.market.items.length) this.init();
    return G.market;
  },

  // Count intact/functional vs total city buildings that a corporation depends on
  cityBldStats(types) {
    let active = 0, total = 0;
    const byType = {};
    for (const t of types) byType[t] = { a: 0, t: 0 };
    for (const c of G.civb || []) {
      if (byType[c.type]) {
        total++; byType[c.type].t++;
        if (Civ.functional(c)) { active++; byType[c.type].a++; }
      }
    }
    const parts = [];
    for (const t of types) {
      if (byType[t].t > 0) parts.push(`${CIVB[t].name}: ${byType[t].a}/${byType[t].t}`);
    }
    return { active, total, ratio: total > 0 ? active / total : 0, summary: parts.join(' · ') || 'No linked city structures on map' };
  },

  fundamental(it) {
    if (it.kind === 'city') {
      const s = G.settlements[it.settId];
      if (!s) return it.startPrice;
      const popK = s.popMax > 0 ? U.clamp(s.pop / s.popMax, 0.1, 1.3) : 0.5;
      const happyK = U.clamp(s.happy / 62, 0.35, 1.6);
      const infraK = U.clamp(s.infra, 0.2, 1.2);
      const utilK = 0.65 + s.power * 0.2 + s.water * 0.15;
      const dangerPen = Math.max(0.25, 1 - s.danger / 115);
      const devBonus = 1 + (it.devLevel || 0) * 0.14;
      return Math.max(10, it.startPrice * popK * happyK * infraK * utilK * dangerPen * devBonus);
    }
    // Corporate fundamentals linked to presence & health of required city buildings + theatre activity
    const cb = this.cityBldStats(it.cityBlds || []);
    it.bldActive = cb.active;
    it.bldTotal = cb.total;
    it.bldBreak = cb.summary;
    // Presence & survival multiplier from city buildings (collapses if required city buildings are destroyed, surges when many are intact)
    const presenceK = cb.total > 0 ? (0.35 + 0.75 * cb.ratio + Math.min(0.45, cb.active * 0.025)) : 0.65;
    switch (it.id) {
      case 'c_aegis': {
        const combatU = G.units.filter((u) => !u.dead && u.d.w.length).length;
        const milFac = G.blds.filter((b) => !b.dead && (b.type === 'factory' || b.type === 'hangar' || b.type === 'silo')).length;
        return it.startPrice * presenceK * (0.82 + combatU * 0.01 + milFac * 0.045);
      }
      case 'c_orlov': {
        const refs = G.blds.filter((b) => !b.dead && (b.type === 'refinery' || b.type === 'mine')).length;
        const harv = G.units.filter((u) => !u.dead && u.type === 'harvester').length;
        return it.startPrice * presenceK * (0.78 + refs * 0.08 + harv * 0.055);
      }
      case 'c_helios': {
        const pwr = G.blds.filter((b) => !b.dead && (b.type === 'power' || b.type === 'fueldepot')).length;
        const oil = G.civb.filter((c) => !c.rubble && (c.type === 'derrick' || c.type === 'powerstation') && c.ctrl >= 0).length;
        return it.startPrice * presenceK * (0.82 + pwr * 0.045 + oil * 0.08);
      }
      case 'c_trans': {
        let trades = 0;
        for (let a = 0; a < G.factions.length; a++) for (let b = a + 1; b < G.factions.length; b++) if (G.dip[a] && G.dip[a][b] && G.dip[a][b].trade) trades++;
        const hwyCars = G.civs ? G.civs.filter((a) => !a.dead && a.veh && a.hwy).length : 0;
        const intactBridges = G.bridges.filter((b) => !b.broken).length / Math.max(1, G.bridges.length);
        return it.startPrice * presenceK * (0.72 + intactBridges * 0.3 + trades * 0.16 + hwyCars * 0.015);
      }
      case 'c_ceres': {
        const avgHappy = G.settlements.length ? G.settlements.reduce((s, x) => s + x.happy, 0) / G.settlements.length : 60;
        const farms = G.blds.filter((b) => !b.dead && (b.type === 'farm' || b.type === 'medical' || b.type === 'shelter')).length;
        return it.startPrice * presenceK * (0.65 + (avgHappy / 100) * 0.55 + farms * 0.06);
      }
      case 'c_meridian_fin': {
        const totalCash = G.settlements.reduce((s, x) => s + (x.cash || 0) + x.pop * 0.5, 0);
        const avgHappy = G.settlements.length ? G.settlements.reduce((s, x) => s + x.happy, 0) / G.settlements.length : 60;
        return it.startPrice * presenceK * (0.72 + (avgHappy / 100) * 0.45 + Math.min(0.55, totalCash / 3500));
      }
      case 'c_nexus': {
        let aiScore = 0;
        for (const f of G.factions) {
          if (f.tech.has('drones')) aiScore += 1.5;
          if (f.tech.has('robotics')) aiScore += 2;
          const L = AILab.init(f); aiScore += (L.tier - 1) * 1.4 + L.sub * 0.25;
        }
        const dcs = G.blds.filter((b) => !b.dead && b.type === 'datacenter').length;
        const bots = G.units.filter((u) => !u.dead && u.d.robotic).length;
        return it.startPrice * presenceK * (0.85 + aiScore * 0.08 + dcs * 0.12 + bots * 0.04);
      }
    }
    return it.startPrice * presenceK;
  },

  tick() {
    const M = this.ensure();
    M.t++;
    // Update prices and pay dividends every 3 seconds
    if (M.t % 3 !== 0) return;
    const f = fac(G.player);
    let divTotal = 0;
    for (const it of M.items) {
      const target = this.fundamental(it);
      const pull = (target - it.price) * 0.09;
      const noise = (Math.random() - 0.492) * it.price * 0.022;
      it.prevPrice = it.price;
      it.price = Math.max(5, Math.round((it.price + pull + noise) * 10) / 10);
      it.trend = it.price - it.prevPrice;
      it.hist.push(it.price);
      if (it.hist.length > 48) it.hist.shift();
      if (it.shares > 0 && f && f.alive) {
        // Yield scales if city is healthy or company is booming
        let yieldMod = 1;
        if (it.kind === 'city') {
          const s = G.settlements[it.settId];
          if (s) yieldMod = U.clamp((s.happy / 60) * s.infra * (s.danger > 40 ? 0.3 : 1), 0.2, 1.8);
        }
        const div = it.shares * it.price * (it.divRate / 20) * yieldMod;
        f.res.credits += div;
        divTotal += div;
      }
    }
    if (divTotal > 0) {
      M.lastDiv = divTotal;
      M.divPaid += divTotal;
    }
  },

  buy(id, qty) {
    const M = this.ensure(), it = M.items.find((x) => x.id === id), f = fac(G.player);
    if (!it || !f) return false;
    const cost = Math.round(it.price * qty);
    if (!f.unlimited && f.res.credits < cost) {
      if (qty > 1) {
        const maxQ = Math.floor(f.res.credits / it.price);
        if (maxQ >= 1) return this.buy(id, maxQ);
      }
      UI.msg('Not enough credits to buy ' + it.ticker, 'warn');
      return false;
    }
    if (!f.unlimited) f.res.credits -= cost;
    const totalCost = it.avgCost * it.shares + cost;
    it.shares += qty;
    it.avgCost = totalCost / it.shares;
    // Buying municipal bonds in a city boosts local cash, infrastructure materials & reputation
    if (it.kind === 'city') {
      const s = G.settlements[it.settId];
      if (s) {
        s.cash += cost * 0.35;
        s.stock.materials = Math.min(2000, s.stock.materials + qty * 2);
        Civ.blame(G.player, s, Math.min(4, qty * 0.18), Math.min(1, qty * 0.04));
      }
    }
    Bus.emit('sfx', 'cash');
    return true;
  },

  sell(id, qty) {
    const M = this.ensure(), it = M.items.find((x) => x.id === id), f = fac(G.player);
    if (!it || !f || it.shares <= 0) return false;
    qty = Math.min(qty, it.shares);
    const proceeds = Math.round(it.price * qty);
    const profit = proceeds - it.avgCost * qty;
    f.res.credits += proceeds;
    it.shares -= qty;
    if (it.shares <= 0) { it.shares = 0; it.avgCost = 0; }
    M.realized += profit;
    Bus.emit('sfx', 'cash');
    return true;
  },

  investCity(settId) {
    const M = this.ensure(), it = M.items.find((x) => x.kind === 'city' && x.settId === settId), f = fac(G.player);
    const s = G.settlements[settId];
    if (!it || !s || !f) return false;
    const cost = 500 + (it.devLevel || 0) * 250;
    if (!f.unlimited && f.res.credits < cost) { UI.msg('Needs ' + cost + ' credits for municipal development grant', 'warn'); return false; }
    if (!f.unlimited) f.res.credits -= cost;
    it.devLevel = (it.devLevel || 0) + 1;
    s.happy = Math.min(100, s.happy + 8);
    s.stock.materials = Math.min(2000, s.stock.materials + 120);
    s.stock.food = Math.min(2000, s.stock.food + 100);
    Civ.blame(G.player, s, 10, 2.5);
    it.price = Math.round((it.price * 1.06) * 10) / 10;
    UI.msg('Civic development grant boosted ' + s.name + ' (' + it.ticker + ')', 'good', s.x, s.y);
    Bus.emit('sfx', 'cash');
    return true;
  },

  portfolioValue() {
    const M = this.ensure();
    let v = 0, cost = 0;
    for (const it of M.items) if (it.shares > 0) { v += it.shares * it.price; cost += it.shares * it.avgCost; }
    return { val: Math.round(v), cost: Math.round(cost), pnl: Math.round(v - cost) };
  },
};
