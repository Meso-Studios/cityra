'use strict';
/* =====================================================================
   CITY.RA — era.js
   Eras swap the whole order of battle in place. The modern tables are
   snapshotted at load; Era.apply('napoleonic') replaces factions, units,
   weapons, structures, research, AI plans, resource names, civilian
   building names and the sprite set with the 1805 equivalents, while
   keeping the internal keys (barracks, factory, rifle, mbt…) so economy,
   production, AI and orders all work unchanged.
   ===================================================================== */

const ERA_TABLES = () => ({ UNITS, BLDS, WEAPONS, WH, FACTIONS, CAMO, ARCH, TECH, BUILD_ORDER_UI, AI_PLAN, AI_MIX, AI_TECH, RES_LABEL, CIVB, CAPTURE_INFO, PRODUCER });

/* ---------------- Napoleonic order of battle (1805) ---------------- */
const NAP = {
  factions: {
    france: { name: 'French Empire', short: 'FRA', color: '#3b63b8', dark: '#182c5a', light: '#bccdf0', coat: '#2c4a9c', trou: '#e9e4d6', face: '#c8382c',
      doctrine: 'La Grande Armée: corps manoeuvre, massed batteries and the Guard.', traits: ['Infantry cost 15% less', 'Artillery range +15%', 'Imperial Guard'],
      mod: { cost: { inf: 0.85 }, artRange: 1.15 }, unique: 'spec', arch: 'modern', humane: 0.5, aggr: 0.8 },
    britain: { name: 'United Kingdom', short: 'GBR', color: '#c43a2c', dark: '#5a1510', light: '#f2b8ae', coat: '#b3271e', trou: '#d9d4c4', face: '#1e2a4a',
      doctrine: 'Rules the waves. Firepower in two-deep lines, riflemen and gold.', traits: ['Ships cost 25% less and sail faster', 'Trade income +50%', 'Highland regiments'],
      mod: { cost: { sea: 0.75 }, speed: { sea: 1.15 }, trade: 1.5 }, unique: 'exo', arch: 'harbor', humane: 0.7, aggr: 0.5 },
    prussia: { name: 'Kingdom of Prussia', short: 'PRU', color: '#4a5a78', dark: '#1a2030', light: '#c4cede', coat: '#1f2b4a', trou: '#dcdcd0', face: '#b0302a',
      doctrine: 'Drill, discipline and the General Staff. Death’s Head Hussars.', traits: ['Infantry +15% durability', 'Research 30% faster', 'Death’s Head Hussars'],
      mod: { hp: { inf: 1.15 }, research: 1.3 }, unique: 'robotank', arch: 'brutal', humane: 0.5, aggr: 0.6 },
    austria: { name: 'Austrian Empire', short: 'AUT', color: '#e2dccb', dark: '#6a6250', light: '#fbf8ee', coat: '#ece7d8', trou: '#a7bad0', face: '#8a2a3a',
      doctrine: 'Vast Habsburg levies, the finest heavy horse in Europe.', traits: ['Cavalry +12% durability', 'Cavalry cost 10% less', 'Kürassier regiments'],
      mod: { hp: { veh: 1.12 }, cost: { veh: 0.9 } }, unique: 'mech', arch: 'modern', humane: 0.6, aggr: 0.45 },
    russia: { name: 'Russian Empire', short: 'RUS', color: '#3f7a46', dark: '#16301a', light: '#b8dcbc', coat: '#2c4a2c', trou: '#e2ddd0', face: '#b8322a',
      doctrine: 'Endless steppe, iron infantry and Cossack hosts.', traits: ['Infantry +10% durability', 'Units cost 10% less', 'Cossack hosts'],
      mod: { hp: { inf: 1.1 }, cost: { inf: 0.9, veh: 0.9 } }, unique: 'mammoth', arch: 'timber', humane: 0.3, aggr: 0.7 },
    spain: { name: 'Kingdom of Spain', short: 'ESP', color: '#d6a62c', dark: '#5a4210', light: '#f3e0a6', coat: '#e6dcc0', trou: '#3a4a8a', face: '#7a2a8a',
      doctrine: 'Treasure fleets, tercio pride and the guerrilla war.', traits: ['Reputation losses halved', 'Infantry +1 sight', 'Guerrilleros'],
      mod: { rep: 0.5, sight: { inf: 1 } }, unique: 'ghost', arch: 'timber', humane: 0.8, aggr: 0.5 },
  },
  // seats of power in 1805 (the objective), and period names for modern cities
  capitals1805: ['London', 'Paris', 'Berlin', 'Madrid', 'Vienna', 'Rome', 'Lisbon', 'Stockholm', 'Copenhagen', 'St Petersburg', 'Constantinople', 'Naples', 'Amsterdam', 'Moscow', 'Warsaw', 'Prague', 'Pest', 'Dresden', 'Munich', 'Brussels', 'Turin', 'Milan', 'Venice', 'The Hague', 'Dublin', 'Edinburgh', 'Bern', 'Christiania'],
  oldNames: { 'Saint Petersburg': 'St Petersburg', Istanbul: 'Constantinople', Ankara: 'Angora', Kyiv: 'Kiev', 'Gdańsk': 'Danzig', 'Wrocław': 'Breslau', Kaliningrad: 'Königsberg', Bratislava: 'Pressburg', Ljubljana: 'Laibach', Lviv: 'Lemberg', Szczecin: 'Stettin', 'Poznań': 'Posen', Tallinn: 'Reval', Tartu: 'Dorpat', Vilnius: 'Wilna', 'Chișinău': 'Kishinev', Izmir: 'Smyrna', Thessaloniki: 'Salonica', Oslo: 'Christiania', Helsinki: 'Helsingfors', Kaunas: 'Kovno', Brno: 'Brünn', Zagreb: 'Agram', 'Cluj-Napoca': 'Klausenburg', Bydgoszcz: 'Bromberg', Budapest: 'Pest', Volgograd: 'Tsaritsyn', 'Dnipro': 'Yekaterinoslav', Donetsk: 'Yuzovka', Mykolaiv: 'Nikolayev', Chernivtsi: 'Czernowitz', Olsztyn: 'Allenstein', Liberec: 'Reichenberg', Plzeň: 'Pilsen', Košice: 'Kaschau', Timișoara: 'Temeswar', Oradea: 'Grosswardein', Sibiu: 'Hermannstadt', Braşov: 'Kronstadt', Bucharest: 'Bucharest' },
  oldCountries: { Germany: 'German States', Italy: 'Italian States', Turkey: 'Ottoman Empire', Czechia: 'Bohemia', 'Czech Republic': 'Bohemia', Hungary: 'Hungary', Netherlands: 'Batavian Republic', Belgium: 'Austrian Netherlands', Greece: 'Ottoman Greece', Serbia: 'Ottoman Serbia', Bulgaria: 'Ottoman Rumelia', Romania: 'Wallachia', Ukraine: 'Little Russia', Belarus: 'White Russia', Norway: 'Norway (Danish)', Finland: 'Finland (Swedish)', Slovakia: 'Upper Hungary', Switzerland: 'Helvetic Republic', Lithuania: 'Lithuania (Russian)', Latvia: 'Livonia', Estonia: 'Estland', Moldova: 'Moldavia', 'Bosnia and Herz.': 'Ottoman Bosnia', 'Bosnia and Herzegovina': 'Ottoman Bosnia', 'United Kingdom': 'United Kingdom', Slovenia: 'Carniola', Croatia: 'Croatia', Albania: 'Ottoman Albania', 'North Macedonia': 'Ottoman Macedonia', Macedonia: 'Ottoman Macedonia', Montenegro: 'Montenegro', Kosovo: 'Ottoman Kosovo', Luxembourg: 'Luxembourg' },
  capitals: { france: [48.86, 2.35, 'Paris'], britain: [51.51, -0.13, 'London'], prussia: [52.52, 13.4, 'Berlin'], austria: [48.21, 16.37, 'Vienna'], russia: [59.94, 30.31, 'St Petersburg'], spain: [40.42, -3.7, 'Madrid'] },
  wh: {
    ball: [1.0, 0.7, 0.15, 0, 0.08, 0.04], blade: [1.1, 0.9, 0.35, 0, 0, 0.02], roundshot: [0.8, 1.0, 1.0, 0, 0.9, 0.9],
    canister: [1.25, 1.0, 0.3, 0, 0.3, 0.05], shellh: [1.0, 0.8, 0.5, 0, 0.6, 0.9], broadside: [0.7, 0.8, 0.8, 0, 1.25, 0.9],
  },
  // rng in game metres (no compression: smoothbore ranges are short already), splash = blast m
  weapons: {
    musket: { name: 'Musket volley (Charleville .69)', dmg: 22, rel: 3.4, proj: 'bullet', spd: 900, wh: 'ball', supp: 12, tg: 'g', snd: 'rifle', r: [90] },
    gmusket: { name: 'Grenadier volley', dmg: 27, rel: 3.2, proj: 'bullet', spd: 900, wh: 'ball', supp: 14, tg: 'g', snd: 'rifle', r: [90] },
    guard: { name: 'Guard volley', dmg: 32, rel: 2.9, proj: 'bullet', spd: 950, wh: 'ball', supp: 16, tg: 'g', snd: 'rifle', r: [100] },
    lmusket: { name: 'Skirmish fire', dmg: 12, rel: 2.2, proj: 'bullet', spd: 900, wh: 'ball', supp: 6, tg: 'g', snd: 'rifle', r: [110] },
    baker: { name: 'Baker rifle', dmg: 24, rel: 4.5, proj: 'bullet', spd: 1100, wh: 'ball', supp: 18, tg: 'g', snd: 'sniper', r: [200] },
    pistol: { name: 'Flintlock pistol', dmg: 8, rel: 2.5, proj: 'bullet', spd: 800, wh: 'ball', supp: 2, tg: 'g', snd: 'rifle', r: [25] },
    carbine: { name: 'Cavalry carbine', dmg: 13, rel: 2.8, proj: 'bullet', spd: 850, wh: 'ball', supp: 5, tg: 'g', snd: 'rifle', r: [70] },
    sabre: { name: 'Light cavalry sabre', dmg: 34, rel: 1.3, proj: 'bullet', spd: 2400, wh: 'blade', supp: 20, tg: 'g', snd: 'click', r: [9] },
    lance: { name: 'Lance', dmg: 42, rel: 1.6, proj: 'bullet', spd: 2400, wh: 'blade', supp: 24, tg: 'g', snd: 'click', r: [11] },
    heavysabre: { name: 'Heavy cavalry sword', dmg: 50, rel: 1.4, proj: 'bullet', spd: 2400, wh: 'blade', supp: 28, tg: 'g', snd: 'click', r: [9] },
    gun6: { name: '6-pounder roundshot', dmg: 60, rel: 6, proj: 'shell', spd: 650, wh: 'roundshot', supp: 22, tg: 'g', snd: 'cannon', r: [500, 4] },
    gun12: { name: '12-pounder roundshot', dmg: 88, rel: 8, proj: 'shell', spd: 700, wh: 'roundshot', supp: 28, tg: 'g', snd: 'cannon', r: [650, 5, 40] },
    canister: { name: 'Canister', dmg: 46, rel: 5, proj: 'bullet', spd: 900, wh: 'canister', supp: 30, tg: 'g', snd: 'cannon', r: [220, 10] },
    congreve: { name: 'Congreve rockets', dmg: 52, rel: 9, proj: 'arcrocket', spd: 230, wh: 'shellh', supp: 30, tg: 'g', snd: 'salvo', burst: 4, bgap: 0.3, spread: 70, r: [900, 15, 80] },
    broadside: { name: 'Broadside, 36 guns', dmg: 40, rel: 7, proj: 'shell', spd: 650, wh: 'broadside', supp: 25, tg: 'g', snd: 'cannon', burst: 6, bgap: 0.12, spread: 18, r: [450, 4] },
    broadside2: { name: 'Broadside, 74 guns (two decks)', dmg: 50, rel: 8, proj: 'shell', spd: 700, wh: 'broadside', supp: 30, tg: 'g', snd: 'cannon', burst: 10, bgap: 0.09, spread: 22, r: [520, 5] },
    broadsides: { name: 'Broadside, 14 guns', dmg: 30, rel: 6, proj: 'shell', spd: 620, wh: 'broadside', supp: 20, tg: 'g', snd: 'cannon', burst: 4, bgap: 0.14, spread: 16, r: [380, 3] },
    swivel: { name: 'Swivel guns', dmg: 14, rel: 2, proj: 'bullet', spd: 900, wh: 'canister', supp: 10, tg: 'g', snd: 'rifle', r: [150] },
    marines: { name: 'Marines’ muskets', dmg: 14, rel: 3, proj: 'bullet', spd: 900, wh: 'ball', supp: 8, tg: 'g', snd: 'rifle', r: [90] },
    fortgun: { name: '24-pounder fortress gun', dmg: 95, rel: 7, proj: 'shell', spd: 700, wh: 'roundshot', supp: 30, tg: 'g', snd: 'cannon', r: [700, 5] },
    fort32: { name: '32-pounder coastal gun', dmg: 140, rel: 10, proj: 'shell', spd: 720, wh: 'broadside', supp: 30, tg: 'g', snd: 'artillery', r: [850, 6] },
    redoubt: { name: 'Garrison volleys', dmg: 24, rel: 3, proj: 'bullet', spd: 900, wh: 'ball', supp: 12, tg: 'g', snd: 'rifle', r: [110] },
    tmusket: { name: 'Sentry musket', dmg: 12, rel: 3, proj: 'bullet', spd: 900, wh: 'ball', supp: 4, tg: 'g', snd: 'rifle', r: [120] },
  },
  /* units: def + real [length m, width m, speed m/s, sight m]; form = [ranks, files, file spacing m, rank spacing m] */
  units: {
    rifle: { name: 'Line infantry company', cat: 'inf', hp: 100, armor: 'none', w: ['musket'], ammo: 40, cost: { c: 90, s: 6 }, time: 6, mc: 'foot', form: [2, 6, 0.75, 1.1], real: [1.0, 0.6, 2.4, 150] },
    mg: { name: 'Grenadier company', cat: 'inf', hp: 130, armor: 'none', w: ['gmusket'], ammo: 40, cost: { c: 160, s: 8 }, time: 8, mc: 'foot', form: [2, 5, 0.8, 1.1], real: [1.0, 0.6, 2.3, 150] },
    sniper: { name: 'Rifle company (Baker rifles)', cat: 'inf', hp: 70, armor: 'none', w: ['baker'], ammo: 30, cost: { c: 220, s: 6 }, time: 9, mc: 'foot', camo: true, tech: 'rifles', form: [2, 3, 2.2, 2.2], real: [1.0, 0.6, 2.8, 230] },
    engineer: { name: 'Sappers', cat: 'inf', hp: 70, armor: 'none', w: ['pistol'], ammo: 20, cost: { c: 250 }, time: 8, mc: 'foot', ab: { capture: 1, repair: 1 }, form: [2, 3, 1.2, 1.4], real: [1.0, 0.6, 2.5, 120] },
    medic: { name: 'Regimental surgeon', cat: 'inf', hp: 50, armor: 'none', w: [], ammo: 0, cost: { c: 180, s: 8 }, time: 7, mc: 'foot', ab: { heal: 8 }, form: [1, 3, 1.4, 1], real: [1.0, 0.6, 2.5, 120] },
    recon: { name: 'Voltigeurs (light infantry)', cat: 'inf', hp: 70, armor: 'none', w: ['lmusket'], ammo: 50, cost: { c: 140 }, time: 6, mc: 'foot', ab: { detect: 1 }, form: [2, 4, 2.4, 2.4], real: [1.0, 0.6, 3.2, 240] },
    spec: { name: 'Imperial Guard grenadiers', cat: 'inf', hp: 230, armor: 'none', w: ['guard'], ammo: 50, cost: { c: 450, s: 15 }, time: 14, mc: 'foot', vet: 1, faction: 'france', tech: 'specops', form: [3, 6, 0.75, 1.1], real: [1.0, 0.6, 2.5, 170] },
    exo: { name: 'Highland regiment', cat: 'inf', hp: 170, armor: 'none', w: ['gmusket'], ammo: 50, cost: { c: 320, s: 10 }, time: 11, mc: 'foot', faction: 'britain', tech: 'specops', form: [2, 7, 0.75, 1.1], real: [1.0, 0.6, 2.6, 160] },
    ghost: { name: 'Guerrilleros', cat: 'inf', hp: 90, armor: 'none', w: ['lmusket'], ammo: 60, cost: { c: 260 }, time: 9, mc: 'foot', ab: { demo: 1, stealth: 1, detect: 1 }, faction: 'spain', tech: 'specops', form: [2, 3, 2.6, 2.6], real: [1.0, 0.6, 3.4, 230] },
    harvester: { name: 'Ore wagon (ox team)', cat: 'veh', hp: 300, armor: 'light', w: [], ammo: 0, cost: { c: 700 }, time: 10, mc: 'wheel', ab: { harvest: 300 }, real: [9, 2.2, 3, 100] },
    jeep: { name: 'Hussars', cat: 'veh', hp: 140, armor: 'light', w: ['sabre', 'carbine'], ammo: 30, cost: { c: 220, f: 4 }, time: 7, mc: 'foot', horse: 1, form: [2, 3, 1.6, 3.2], real: [2.6, 0.9, 7, 220] },
    scout: { name: 'Lancers', cat: 'veh', hp: 150, armor: 'light', w: ['lance'], ammo: 0, cost: { c: 260, f: 4 }, time: 8, mc: 'foot', horse: 1, ab: { detect: 1 }, form: [2, 3, 1.6, 3.2], real: [2.6, 0.9, 7, 280] },
    apc: { name: 'Troop wagon', cat: 'veh', hp: 200, armor: 'light', w: [], ammo: 0, cost: { c: 300, f: 3 }, time: 7, mc: 'wheel', ab: { carry: 4, carryInf: 1 }, real: [9, 2.2, 4, 120] },
    ifv: { name: 'Dragoons', cat: 'veh', hp: 170, armor: 'light', w: ['carbine', 'sabre'], ammo: 30, cost: { c: 320, f: 5 }, time: 9, mc: 'foot', horse: 1, form: [2, 3, 1.6, 3.2], real: [2.6, 0.9, 6, 200] },
    mbt: { name: 'Cuirassiers', cat: 'veh', hp: 300, armor: 'light', w: ['heavysabre'], ammo: 0, cost: { c: 480, m: 15, f: 6 }, time: 12, mc: 'foot', horse: 2, form: [2, 3, 1.7, 3.3], real: [2.7, 1.0, 5.5, 180] },
    heavy: { name: 'Horse Guards (carabiniers)', cat: 'veh', hp: 380, armor: 'light', w: ['heavysabre', 'carbine'], ammo: 20, cost: { c: 620, m: 20, f: 8 }, time: 15, mc: 'foot', horse: 2, tech: 'heavyarmor', form: [2, 4, 1.7, 3.3], real: [2.7, 1.0, 5.5, 180] },
    spg: { name: '12-pounder foot battery', cat: 'veh', hp: 160, armor: 'light', w: ['gun12', 'canister'], ammo: 30, cost: { c: 700, m: 30, s: 20 }, time: 14, mc: 'wheel', req: ['ammo'], gun: 12, real: [7, 2.6, 2.5, 160] },
    mlrs: { name: 'Congreve rocket troop', cat: 'veh', hp: 120, armor: 'light', w: ['congreve'], ammo: 6, cost: { c: 650, s: 30 }, time: 13, mc: 'wheel', tech: 'rockets', real: [5, 2.4, 3, 160] },
    aatruck: { name: 'Horse artillery (6-pdr)', cat: 'veh', hp: 140, armor: 'light', w: ['gun6', 'canister'], ammo: 30, cost: { c: 520, m: 20, s: 10 }, time: 11, mc: 'wheel', gun: 6, real: [6, 2.4, 5, 180] },
    engveh: { name: 'Pontoon train', cat: 'veh', hp: 250, armor: 'light', w: [], ammo: 0, cost: { c: 400 }, time: 10, mc: 'wheel', ab: { repair: 2.5, clear: 1 }, real: [10, 2.4, 3, 120] },
    supply: { name: 'Supply wagon', cat: 'veh', hp: 160, armor: 'light', w: [], ammo: 0, cost: { c: 300 }, time: 7, mc: 'wheel', ab: { resupply: 1, aid: 1 }, real: [8, 2.2, 4, 120] },
    mammoth: { name: 'Cossack host', cat: 'veh', hp: 170, armor: 'light', w: ['lance', 'carbine'], ammo: 20, cost: { c: 200, f: 3 }, time: 7, mc: 'foot', horse: 3, faction: 'russia', form: [2, 4, 2.2, 3.6], real: [2.5, 0.9, 8, 260] },
    robotank: { name: 'Death’s Head Hussars', cat: 'veh', hp: 210, armor: 'light', w: ['sabre', 'carbine'], ammo: 30, cost: { c: 330, f: 5 }, time: 9, mc: 'foot', horse: 4, faction: 'prussia', ab: { fearless: 1 }, form: [2, 4, 1.6, 3.2], real: [2.6, 0.9, 7.5, 240] },
    mech: { name: 'Kürassier regiment', cat: 'veh', hp: 380, armor: 'light', w: ['heavysabre'], ammo: 0, cost: { c: 560, m: 15, f: 6 }, time: 13, mc: 'foot', horse: 2, faction: 'austria', form: [2, 4, 1.7, 3.3], real: [2.7, 1.0, 5.5, 180] },
    patrol: { name: 'Privateer brig', cat: 'sea', hp: 420, armor: 'naval', w: ['swivel', 'marines'], ammo: 80, cost: { c: 500, m: 10 }, time: 10, mc: 'naval', ship: { masts: 2, hull: '#3a2a1e', sail: '#e9dfc4', stripe: null }, real: [30, 8, 5, 260] },
    corsair: { name: 'Pirate brigantine', cat: 'sea', hp: 560, armor: 'naval', w: ['broadsides', 'marines'], ammo: 60, cost: { c: 720, m: 15 }, time: 12, mc: 'naval', ship: { masts: 2, hull: '#221a14', sail: '#2a2622', stripe: '#8a2a1e', pirate: 1 }, real: [32, 8, 6, 260] },
    destroyer: { name: 'Frigate (36 guns)', cat: 'sea', hp: 1250, armor: 'naval', w: ['broadside', 'marines'], ammo: 60, cost: { c: 1600, m: 60 }, time: 22, mc: 'naval', ship: { masts: 3, hull: '#3d2c1e', sail: '#efe6cc', stripe: '#d4a840', ports: 13 }, real: [46, 12, 6, 300] },
    sub: { name: 'Ship of the line (74 guns)', cat: 'sea', hp: 2600, armor: 'naval', w: ['broadside2', 'marines'], ammo: 60, cost: { c: 3000, m: 120 }, time: 34, mc: 'naval', tech: 'silent', ab: {}, ship: { masts: 3, hull: '#2e2218', sail: '#f2ead2', stripe: '#d8ad48', ports: 18, decks: 2 }, real: [62, 16, 4.5, 320] },
    tship: { name: 'East Indiaman transport', cat: 'sea', hp: 700, armor: 'naval', w: ['swivel'], ammo: 40, cost: { c: 900, m: 30 }, time: 14, mc: 'naval', ab: { carry: 8 }, ship: { masts: 3, hull: '#4a3422', sail: '#e6dcc0', stripe: '#c4c0b0' }, real: [45, 12, 4, 220] },
    lcraft: { name: 'Ship’s longboats', cat: 'sea', hp: 200, armor: 'naval', w: [], ammo: 0, cost: { c: 300, m: 5 }, time: 7, mc: 'beach', ab: { carry: 4 }, ship: { boat: 1, hull: '#6a4a2c' }, real: [10, 3, 2.5, 160] },
    nsupply: { name: 'Store ship', cat: 'sea', hp: 520, armor: 'naval', w: [], ammo: 0, cost: { c: 700, m: 20 }, time: 12, mc: 'naval', ab: { resupply: 1, fix: 14 }, ship: { masts: 2, hull: '#4a3422', sail: '#e2d8bc' }, real: [40, 11, 4, 200] },
  },
  /* structures: def + [w, h, sight m] in 10 m tiles */
  blds: {
    hq: { name: 'Château headquarters', hp: 3200, pw: 15, cost: { c: 3000, mat: 200 }, time: 45, cat: 'base', req: ['factory'], up: { name: 'Fortified château', cost: { c: 2000, mat: 200 }, time: 30 }, real: [6, 5, 260] },
    power: { name: 'Windmill', hp: 500, pw: 60, cost: { c: 220, mat: 25 }, time: 8, cat: 'base', real: [2, 2, 100] },
    refinery: { name: 'Smelter & mint', hp: 1100, pw: -20, cost: { c: 1300, mat: 40 }, time: 16, cat: 'eco', req: ['power'], real: [5, 3, 120] },
    barracks: { name: 'Caserne (barracks)', hp: 900, pw: -10, cost: { c: 380, mat: 25 }, time: 10, cat: 'base', req: ['power'], prod: 'inf', up: { name: 'École militaire drill', cost: { c: 600, mat: 30 }, time: 18 }, real: [5, 4, 150] },
    factory: { name: 'Stables & gun park', hp: 1300, pw: -15, cost: { c: 1300, mat: 60 }, time: 18, cat: 'base', req: ['refinery'], prod: 'veh', up: { name: 'Remount depot', cost: { c: 900, mat: 50 }, time: 22 }, real: [6, 5, 150] },
    shipyard: { name: 'Naval dockyard', hp: 1500, pw: -10, cost: { c: 1400, mat: 80 }, time: 20, cat: 'base', req: ['barracks'], prod: 'sea', coast: true, real: [6, 5, 220] },
    radar: { name: 'Semaphore tower', hp: 600, pw: -5, cost: { c: 600, mat: 30 }, time: 12, cat: 'base', req: ['refinery'], real: [2, 2, 650] },
    lab: { name: 'Military academy', hp: 900, pw: -20, cost: { c: 1300, mat: 50 }, time: 20, cat: 'base', req: ['radar'], real: [4, 3, 120] },
    fueldepot: { name: 'Fodder barn', hp: 500, pw: 0, cost: { c: 450, mat: 25 }, time: 9, cat: 'eco', req: ['power'], store: { fuel: 1500 }, make: { fuel: 0.45 }, real: [3, 3, 100] },
    depot: { name: 'Supply magazine', hp: 800, pw: -5, cost: { c: 550, mat: 25 }, time: 10, cat: 'eco', req: ['barracks'], store: { supplies: 1000 }, make: { supplies: 0.7 }, eat: { food: 0.15, metal: 0.08 }, supplyR: 10, real: [4, 3, 120] },
    ammo: { name: 'Powder magazine', hp: 600, pw: 0, cost: { c: 450, mat: 20 }, time: 9, cat: 'eco', req: ['depot'], supplyR: 14, volatile: 220, real: [2, 2, 100] },
    repair: { name: 'Wheelwright & farrier', hp: 900, pw: -10, cost: { c: 800, mat: 40 }, time: 13, cat: 'base', req: ['factory'], fixR: 6, real: [4, 3, 120] },
    medical: { name: 'Field hospital', hp: 400, pw: 0, cost: { c: 350, mat: 10 }, time: 8, cat: 'base', req: ['barracks'], healR: 6, real: [3, 3, 120] },
    mine: { name: 'Iron mine', hp: 800, pw: -10, cost: { c: 700, mat: 30 }, time: 12, cat: 'eco', req: ['power'], make: { metal: 1.2 }, store: { metal: 400 }, needs: 'metal', real: [3, 3, 120] },
    farm: { name: 'Farm fields', hp: 400, pw: 0, cost: { c: 260, mat: 10 }, time: 8, cat: 'eco', req: ['power'], make: { food: 1.0 }, store: { food: 300 }, real: [8, 8, 100] },
    pump: { name: 'Well & cistern', hp: 400, pw: 0, cost: { c: 280, mat: 15 }, time: 7, cat: 'eco', req: ['power'], make: { water: 1.2 }, store: { water: 300 }, nearWater: true, real: [2, 2, 100] },
    logistics: { name: 'Wagon yard', hp: 900, pw: -10, cost: { c: 1000, mat: 30 }, time: 14, cat: 'eco', req: ['depot'], store: { materials: 1000 }, convert: 1, real: [5, 3, 120] },
    shelter: { name: 'Refugee camp', hp: 700, pw: 0, cost: { c: 450, mat: 30 }, time: 10, cat: 'eco', req: ['barracks'], refuge: 250, real: [5, 5, 120] },
    wall: { name: 'Stone wall', hp: 750, pw: 0, cost: { c: 30, mat: 5 }, time: 1.2, cat: 'def', req: ['barracks'], repeat: true, wall: true, real: [1, 1, 40] },
    trench: { name: 'Earthworks', hp: 400, pw: 0, cost: { c: 20, mat: 1 }, time: 1, cat: 'def', req: ['barracks'], repeat: true, walk: true, cover: 0.55, real: [1, 1, 60] },
    bunker: { name: 'Redoubt', hp: 1500, pw: 0, cost: { c: 600, mat: 50 }, time: 12, cat: 'def', req: ['barracks'], w_: ['redoubt'], real: [3, 3, 200] },
    tower: { name: 'Watchtower', hp: 450, pw: 0, cost: { c: 200, mat: 12 }, time: 6, cat: 'def', req: ['barracks'], w_: ['tmusket'], real: [1, 1, 350] },
    turret: { name: 'Gun battery', hp: 1100, pw: 0, cost: { c: 750, mat: 40 }, time: 12, cat: 'def', req: ['factory'], w_: ['fortgun'], up: { name: 'Bastion battery', cost: { c: 600, mat: 30 }, time: 14 }, real: [2, 2, 300] },
    coastal: { name: 'Coastal fort', hp: 1800, pw: 0, cost: { c: 1400, mat: 80 }, time: 18, cat: 'def', req: ['radar'], w_: ['fort32'], nearWater: true, real: [3, 3, 420] },
  },
  buildOrder: {
    base: ['power', 'barracks', 'refinery', 'factory', 'radar', 'shipyard', 'lab', 'repair', 'medical', 'hq'],
    eco: ['fueldepot', 'depot', 'ammo', 'mine', 'farm', 'pump', 'logistics', 'shelter'],
    def: ['wall', 'trench', 'bunker', 'tower', 'turret', 'coastal'],
  },
  tech: {
    composite: { name: 'Cuirass armour', desc: 'Cavalry, guns and wagons +20% durability.', cost: 1300, time: 40 },
    veteran: { name: 'Drill & discipline', desc: 'New infantry companies start at veteran rank.', cost: 1100, time: 38 },
    logistics2: { name: 'Corps supply system', desc: 'Resupply twice as fast; horses eat 30% less fodder.', cost: 900, time: 32 },
    heavyarmor: { name: 'Heavy cavalry reserve', desc: 'Unlocks the Horse Guards and your nation’s signature cavalry.', cost: 1700, time: 50 },
    silent: { name: 'Ships of the line', desc: 'Unlocks the 74-gun ship of the line.', cost: 1600, time: 45 },
    specops: { name: 'Guard & elite companies', desc: 'Unlocks your nation’s elite infantry.', cost: 1300, time: 40 },
    rifles: { name: 'Baker rifles', desc: 'Unlocks rifle companies: long-range marksmen in green.', cost: 800, time: 28 },
    rockets: { name: 'Congreve rockets', desc: 'Unlocks the rocket troop: terrifying, inaccurate barrages.', cost: 1200, time: 36 },
    civeng: { name: 'Civil engineering', desc: 'Sappers repair twice as fast; rebuilding towns earns more goodwill.', cost: 700, time: 30 },
  },
  aiPlan: (k) => ({ early: { france: 'factory', britain: 'shipyard', prussia: 'barracks', austria: 'factory', russia: 'barracks', spain: 'barracks' }[k], extra: k === 'britain' ? ['shipyard', 'coastal', 'turret'] : ['barracks', 'turret', 'bunker', 'tower'] }),
  aiCommon: ['power', 'refinery', 'barracks', 'power', 'factory', 'refinery', 'depot', 'farm', 'pump', 'radar', 'power', 'ammo', 'repair', 'medical', 'turret', 'lab', 'power', 'fueldepot', 'turret', 'mine', 'logistics', 'power', 'bunker', 'tower', 'turret', 'power'],
  aiMix: (k) => ({
    inf: Object.assign({ rifle: 6, mg: 2, recon: 2, sniper: 1 }, k === 'france' ? { spec: 2 } : k === 'britain' ? { exo: 2, sniper: 2 } : k === 'spain' ? { ghost: 2 } : {}),
    veh: Object.assign({ jeep: 2, scout: 1, ifv: 1, mbt: 2, spg: 2, aatruck: 2, heavy: 1, mlrs: k === 'britain' ? 2 : 0 }, k === 'russia' ? { mammoth: 3 } : k === 'prussia' ? { robotank: 2 } : k === 'austria' ? { mech: 2 } : {}),
    air: {}, sea: Object.assign({ patrol: 2, destroyer: 2, corsair: 1 }, k === 'britain' ? { sub: 2, destroyer: 3 } : { sub: 1 }),
  }),
  aiTech: (k) => k === 'britain' ? ['rifles', 'silent', 'rockets', 'specops', 'logistics2', 'veteran', 'composite', 'heavyarmor'] : ['veteran', 'specops', 'heavyarmor', 'composite', 'logistics2', 'rifles', 'rockets', 'silent', 'civeng'],
  resLabel: { credits: 'Gold', fuel: 'Fodder', materials: 'Timber', food: 'Food', water: 'Water', metal: 'Iron', supplies: 'Powder & shot', power: 'Mill power' },
  civNames: { shop: 'Shop', supermarket: 'Covered market', restaurant: 'Inn', market: 'Market hall', bank: 'Counting house', hospital: 'Hôtel-Dieu hospital', clinic: 'Apothecary', school: 'Parish school', university: 'University', police: 'Gendarmerie', fire: 'Fire brigade', cityhall: 'Town hall', farmhouse: 'Farmstead', factory: 'Manufactory', warehouse: 'Warehouse', construction: 'Building site', waterplant: 'Water mill', substation: 'Granary', powerstation: 'Ironworks', transit: 'Coaching inn', station: 'Post house', fuelstation: 'Tavern', commtower: 'Church', checkpoint: 'Toll gate', derrick: 'Saltpetre works', airport: 'Post house', port: 'Harbour quays', house: 'House', apartment: 'Town house', ruin: 'Ruin' },
  capInfo: { heal: 'Hospital: heals nearby troops of the controlling nation', power: 'Ironworks: +120 mill power', fuel: 'Tavern: +0.4 fodder/s', sight: 'Church steeple: lookouts reveal a wide area', oil: 'Saltpetre works: +1.5 fodder/s and +1 gold/s for powder', airport: 'Post house: +3 gold/s', port: 'Harbour: +2 gold/s trade', border: 'Toll gate: reveals the road and marks your border' },
};

/* ---------------- era switching ---------------- */
const Era = {
  key: 'modern', base: null, cur: null,
  snapshot() { if (!this.base) { const T = ERA_TABLES(); this.base = { tables: JSON.parse(JSON.stringify(T)), keys: FACTION_KEYS.slice() }; } },
  restoreTable(dst, src) { for (const k of Object.keys(dst)) delete dst[k]; Object.assign(dst, JSON.parse(JSON.stringify(src))); },
  apply(key) {
    key = key === 'napoleonic' ? 'napoleonic' : 'modern';
    this.snapshot();
    if (key === this.key && this.applied) return;
    G.running = false; // the last game's entities belong to the other era's tables: stop drawing them
    const T = ERA_TABLES(), B = this.base.tables;
    for (const n in T) this.restoreTable(T[n], B[n]);
    FACTION_KEYS.length = 0; FACTION_KEYS.push(...this.base.keys);
    if (!this.pal) this.pal = JSON.parse(JSON.stringify(PALETTES));
    for (const s in this.pal) PALETTES[s] = this.pal[s].slice();
    this.key = key; this.applied = true; this.cur = null; G.era = key;
    if (key === 'napoleonic') this.napoleonic();
    for (const k in UNITS) { UNITS[k].key = k; delete UNITS[k]._form; }
    for (const k in BLDS) BLDS[k].key = k;
    SPR.cache.clear();
    if (typeof Render !== 'undefined') { Render.wpat = null; Render.overview = null; }
    if (typeof document !== 'undefined') document.body.classList.toggle('era-nap', key === 'napoleonic');
  },
  napoleonic() {
    this.cur = NAP;
    const keepFac = NAP.factions;
    for (const k of Object.keys(FACTIONS)) delete FACTIONS[k];
    for (const k in keepFac) FACTIONS[k] = JSON.parse(JSON.stringify(keepFac[k]));
    FACTION_KEYS.length = 0; FACTION_KEYS.push(...Object.keys(keepFac));
    for (const k in keepFac) { const F = keepFac[k]; CAMO[k] = [F.coat, COL.shade(F.coat, -0.2), F.face, F.trou]; ARCH[k] = ARCH[F.arch]; }
    Object.assign(WH, NAP.wh);
    // weapons: whole new armoury
    for (const k of Object.keys(WEAPONS)) delete WEAPONS[k];
    const wReal = {};
    for (const k in NAP.weapons) { const w = Object.assign({}, NAP.weapons[k]); wReal[k] = w.r; delete w.r; WEAPONS[k] = w; }
    // units: everything not listed is gone from this era
    for (const k of Object.keys(UNITS)) delete UNITS[k];
    const uReal = {};
    for (const k in NAP.units) { const d = JSON.parse(JSON.stringify(NAP.units[k])); uReal[k] = d.real; delete d.real; d.sight = 0; d.spd = 0; d.r = 0; UNITS[k] = d; }
    PRODUCER.air = 'none';
    // structures
    for (const k of Object.keys(BLDS)) delete BLDS[k];
    const bReal = {};
    for (const k in NAP.blds) { const d = JSON.parse(JSON.stringify(NAP.blds[k])); bReal[k] = d.real; delete d.real; BLDS[k] = d; }
    Realism.convert(uReal, wReal, bReal, true);
    for (const k in BLDS) delete BLDS[k].sw;
    for (const c of ['base', 'eco', 'def']) BUILD_ORDER_UI[c] = NAP.buildOrder[c].slice();
    for (const k of Object.keys(TECH)) delete TECH[k];
    Object.assign(TECH, JSON.parse(JSON.stringify(NAP.tech)));
    for (const k of Object.keys(AI_PLAN)) delete AI_PLAN[k];
    AI_PLAN.common = NAP.aiCommon.slice();
    for (const k in keepFac) { AI_PLAN[k] = NAP.aiPlan(k); AI_MIX[k] = NAP.aiMix(k); AI_TECH[k] = NAP.aiTech(k); }
    Object.assign(RES_LABEL, NAP.resLabel);
    for (const k in NAP.civNames) if (CIVB[k]) CIVB[k].name = NAP.civNames[k];
    Object.assign(CAPTURE_INFO, NAP.capInfo);
    // warm, painterly ground: every season shifts toward ochre and umber
    for (const s in PALETTES) PALETTES[s] = PALETTES[s].map((c, i) => i < 2 ? COL.mix(c, '#3a6a6a', 0.25) : COL.mix(c, '#a4824e', 0.2));
  },
  label(k) { return k === 'napoleonic' ? 'Napoleonic · 1805' : 'Modern · 2020s'; },

  // Earth coordinates → fractional map position for the Europe theatre
  europeGeo: { lat: 48.5, lon: 12, span: 24, lspan: 48, preset: 'custom' },
  prepEurope(o) {
    o.era = 'napoleonic'; o.type = 'earth'; o.geo = Object.assign({}, this.europeGeo);
    if (!['large', 'huge', 'vast', 'colossal'].includes(o.size)) o.size = 'vast';
    if (!NAP.factions[o.player]) o.player = 'france';
    const used = new Set([o.player]);
    o.ais = (o.ais || []).map((a) => { let k = NAP.factions[a.key] && !used.has(a.key) ? a.key : Object.keys(NAP.factions).find((q) => !used.has(q)); used.add(k); return { key: k, diff: a.diff || 'normal' }; });
    if (typeof Earth === 'undefined') return o;
    Earth.decode();
    const rc = Earth.rect(o.geo), pos = (k) => { const c = NAP.capitals[k]; return { fx: (c[1] - rc.lon0) / (rc.lon1 - rc.lon0), fy: (rc.lat1 - c[0]) / (rc.lat1 - rc.lat0) }; };
    o.playerStart = pos(o.player); o.enemyStarts = o.ais.map((a) => pos(a.key));
    const cap = NAP.capitals[o.player]; o.homeCountry = Earth.country(cap[0], cap[1]) || 0;
    o.season = 'summer';
    return o;
  },
  // strip the industrial world from a generated map: no railways, airports, power grid or fuel stations
  periodMap(M) {
    if (G.era !== 'napoleonic') return M;
    M.rail.fill(0); M.railPath = null; M.poles = [];
    M.plan.bridges = M.plan.bridges.filter((b) => !b.rail);
    M.props = M.props.filter((p) => p.t !== 'runway');
    M.plan.civb = M.plan.civb.filter((p) => p.type !== 'airport' && p.type !== 'station' && p.type !== 'substation').map((p) => (p.type === 'fuelstation' ? Object.assign(p, { type: 'restaurant' }) : p.type === 'powerstation' ? Object.assign(p, { type: 'factory' }) : p));
    if (M.cinfo) for (const c of M.cinfo) if (NAP.oldCountries[c.name]) c.name = NAP.oldCountries[c.name];
    for (const t of M.towns) { t.airport = null; if (NAP.oldNames[t.name]) t.name = NAP.oldNames[t.name]; t.capital = NAP.capitals1805.includes(t.name); }
    return M;
  },
};
Era.snapshot();
MODES.europe = { name: 'Conquer Europe · 1805', desc: 'Napoleonic grand campaign on the real map of Europe. Lead a great power from its capital; take two thirds of Europe’s capitals or break every rival.', era: 'napoleonic' };
const ERA_MODES = { napoleonic: ['europe', 'skirmish', 'conquest', 'sandbox'] };

/* ---------------- period sprites ---------------- */
const NapArt = {
  // a single soldier (16 px frame, facing +x, 10 px = 1 m): shako, coat, white cross-belts, musket
  soldier(x, f, P, key) {
    const coat = P.cam[0], face = P.cam[2], trou = P.cam[3];
    const stride = f === 1 ? 1.4 : f === 2 ? -1.4 : 0;
    if (f !== 3) for (const [sy, o] of [[-1.3, stride], [1.3, -stride]]) fillRR(x, -1.2 + o, sy - 0.7, 2.6, 1.4, 0.6, trou, 'rgba(0,0,0,0.5)', 0.25);
    fillRR(x, -3.6, -2.0, 2.4, 4.0, 0.6, key === 'engineer' ? '#5a4632' : '#6a4a2c', 'rgba(0,0,0,0.5)', 0.25); // knapsack
    x.beginPath(); x.ellipse(0, 0, 2.2, 3.0, 0, 0, 6.283); x.fillStyle = lg(x, -2, -3, 2, 3, [COL.shade(coat, 0.25), coat, COL.shade(coat, -0.35)]); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 0.3; x.stroke();
    line(x, -1.6, -2.2, 1.4, 2.2, '#f2eee2', 0.55); line(x, -1.6, 2.2, 1.4, -2.2, '#f2eee2', 0.55); // cross-belts
    circ(x, 1.6, -2.4, 0.7, face); circ(x, 1.6, 2.4, 0.7, face); // epaulettes / facings
    if (key !== 'medic') { // musket at the shoulder, bayonet forward (presented when firing)
      const fire = f === 3; line(x, fire ? -1 : -2.2, fire ? 0.6 : 2.6, fire ? 8.6 : 5.4, fire ? 0.6 : 1.6, '#5a3a1e', 0.75);
      line(x, fire ? 8.6 : 5.4, fire ? 0.6 : 1.6, fire ? 10.4 : 7.0, fire ? 0.6 : 1.3, '#c8ccd0', 0.35);
    } else fillRR(x, 1.2, 0.8, 2.6, 2.0, 0.4, '#efe8d6', '#555', 0.3);
    const hat = key === 'spec' || key === 'mg' ? '#1a1612' : key === 'exo' ? '#1e1c1a' : key === 'ghost' ? '#5a4a36' : '#141414';
    circ(x, 0.4, 0, key === 'spec' || key === 'mg' ? 2.2 : 1.75, rg(x, 0, -0.6, 0.2, 2.2, [COL.shade(hat, 0.45), hat]), 'rgba(0,0,0,0.6)', 0.3); // shako / bearskin
    if (key !== 'ghost') circ(x, 1.6, 0, 0.55, key === 'spec' ? '#d22' : key === 'recon' ? '#e8d23a' : face); // plume / cockade
  },
  // horse and rider (16 px frame, facing +x, 10 px ≈ 2.6 m)
  rider(x, f, P, key, kind) {
    const coat = P.cam[0], face = P.cam[2], horse = ['#5a3a22', '#2a2018', '#7a5434', '#3a2a20', '#8a6a4a'][(kind * 2 + f) % 5];
    const g = f === 1 ? 0.9 : f === 2 ? -0.9 : 0;
    for (const [lx, ly, o] of [[3.2, -1.4, g], [3.2, 1.4, -g], [-3.2, -1.4, -g], [-3.2, 1.4, g]]) line(x, lx, ly, lx + o * 1.6, ly * 1.25, COL.shade(horse, -0.4), 0.7);
    x.beginPath(); x.ellipse(0, 0, 4.6, 1.75, 0, 0, 6.283); x.fillStyle = lg(x, 0, -1.8, 0, 1.8, [COL.shade(horse, 0.3), horse, COL.shade(horse, -0.4)]); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 0.3; x.stroke();
    x.beginPath(); x.ellipse(5.4, 0, 1.9, 0.8, 0, 0, 6.283); x.fillStyle = horse; x.fill(); // neck & head
    line(x, -4.6, 0, -6.4, Math.sin(f) * 0.6, COL.shade(horse, -0.5), 0.8); // tail
    fillRR(x, -1.6, -2.0, 3.2, 4.0, 0.6, kind === 2 ? '#c9ccd0' : coat, 'rgba(0,0,0,0.5)', 0.25); // rider (cuirass for heavy horse)
    if (kind !== 2) { line(x, -1.2, -1.6, 1.0, 1.6, '#f0ece0', 0.45); circ(x, 1.0, -1.8, 0.55, face); }
    const helm = kind === 2 ? '#d8dade' : kind === 3 ? '#5a3a24' : kind === 4 ? '#141414' : '#1a1a1a';
    circ(x, 0.2, 0, 1.25, rg(x, -0.2, -0.4, 0.1, 1.3, [COL.shade(helm, 0.5), helm]), 'rgba(0,0,0,0.6)', 0.25);
    if (kind === 4) { circ(x, 0.7, -0.3, 0.3, '#eee'); circ(x, 0.7, 0.3, 0.3, '#eee'); } // death's head
    if (key === 'scout' || kind === 3) { line(x, -3, 1.6, 9.5, 1.2, '#7a5a3a', 0.45); poly(x, [9.5, 1.2, 8, 0.4, 8, 1.6], face); } // lance & pennon
    else line(x, 0.6, 1.8, 4.6, 2.6, '#d8dce0', 0.45); // sword
  },
  infantry(key, P, d) {
    const S = 16, s = mk(S * 4, S);
    for (let f = 0; f < 4; f++) { const x = s.x; x.save(); x.translate(S * f + S / 2 - 1.5, S / 2); d.horse ? this.rider(x, f, P, key, d.horse) : this.soldier(x, f, P, key); x.restore(); }
    grit(s, 0.06);
    return { body: s.c, w: S, h: S, frames: 4, inf: true };
  },
  wheel(x, cx, cy, r) { circ(x, cx, cy, r, null, '#3a2814', 0.7); line(x, cx - r, cy, cx + r, cy, '#5a3a20', 0.35); },
  team(x, X, n, col) { // pairs of draught horses (or oxen) heading +x from X
    for (let i = 0; i < n; i++) for (const sy of [-1.3, 1.3]) { const hx = X + i * 5.5; x.beginPath(); x.ellipse(hx, sy, 2.4, 0.95, 0, 0, 6.283); x.fillStyle = lg(x, hx, sy - 1, hx, sy + 1, [COL.shade(col, 0.25), COL.shade(col, -0.3)]); x.fill(); circ(x, hx + 2.8, sy, 0.6, col); }
    line(x, X - 2.6, 0, X + n * 5.5 - 3, 0, '#4a3420', 0.4);
  },
  vehicle(key, P, d) {
    let L, W, s, t = null, tox = 0;
    const wood = '#7a5432', bronze = '#a9823e', iron = '#3a3a3c';
    const crew = (pts) => { for (const [cx, cy] of pts) { circ(s.x, cx, cy, 1.25, P.cam[0], 'rgba(0,0,0,0.5)', 0.25); circ(s.x, cx + 0.2, cy, 0.7, '#1a1a1a'); } };
    if (d.gun) { // field gun deployed: barrel forward, crew around, limber and ammunition chest behind
      L = d.gun === 12 ? 22 : 19; W = 9; s = centered(L, W);
      fillRR(s.x, -L / 2, -2.4, 6, 4.8, 0.8, lg(s.x, 0, -2.4, 0, 2.4, ['#8a6a44', '#5a4024']), '#2a1a0c', 0.4); this.wheel(s.x, -L / 2 + 3, -3.2, 1.8); this.wheel(s.x, -L / 2 + 3, 3.2, 1.8); // limber
      fillRR(s.x, -4, -1.2, 9, 2.4, 0.6, wood, '#2a1a0c', 0.4); this.wheel(s.x, 1.5, -3.6, 2.6); this.wheel(s.x, 1.5, 3.6, 2.6); // trail & wheels
      fillRR(s.x, 0, -1.0, d.gun === 12 ? 11 : 9, 2.0, 0.9, lg(s.x, 0, -1, 0, 1, [COL.shade(bronze, 0.4), bronze, COL.shade(bronze, -0.35)]), '#3a2a10', 0.35); // barrel
      crew([[-2, -4.6], [-2, 4.6], [4, -4.8], [-6, 0.2]]);
    } else if (key === 'mlrs') { // Congreve rocket frame on a light cart
      L = 16; W = 9; s = centered(L, W); fillRR(s.x, -6, -3, 9, 6, 0.6, wood, '#2a1a0c', 0.4); this.wheel(s.x, -2, -4, 2); this.wheel(s.x, -2, 4, 2);
      for (let i = -2; i <= 2; i++) { line(s.x, -4, i * 1.2, 7, i * 1.0, '#c8b890', 0.5); circ(s.x, 7, i * 1.0, 0.5, '#a33'); } crew([[-6, -4.5], [-6, 4.5], [3, 4.6]]);
    } else { // wagons: covered (supply/troops), ore (harvester) or pontoon (engineers)
      L = key === 'engveh' ? 30 : 26; W = 8; s = centered(L, W);
      const bodyX = -L / 2, bodyL = key === 'engveh' ? 13 : 11;
      this.team(s.x, bodyX + bodyL + 3, key === 'harvester' ? 2 : 2, key === 'harvester' ? '#8a7a64' : '#5a3a22');
      fillRR(s.x, bodyX, -3.2, bodyL, 6.4, 0.6, lg(s.x, 0, -3.2, 0, 3.2, ['#8a6440', '#5a3c22']), '#2a1a0c', 0.4);
      this.wheel(s.x, bodyX + 2, -3.8, 1.8); this.wheel(s.x, bodyX + 2, 3.8, 1.8); this.wheel(s.x, bodyX + bodyL - 2, -3.8, 1.8); this.wheel(s.x, bodyX + bodyL - 2, 3.8, 1.8);
      if (key === 'harvester') for (let i = 0; i < 6; i++) circ(s.x, bodyX + 2 + i * 1.6, (i % 3 - 1) * 1.4, 1.2, ['#c8a640', '#8a7a64', '#e2c050'][i % 3]);
      else if (key === 'engveh') { s.x.beginPath(); s.x.ellipse(bodyX + bodyL / 2, 0, bodyL / 2, 2.6, 0, 0, 6.283); s.x.fillStyle = '#6a4a2a'; s.x.fill(); s.x.strokeStyle = '#2a1a0c'; s.x.stroke(); }
      else { s.x.beginPath(); s.x.ellipse(bodyX + bodyL / 2, 0, bodyL / 2 - 0.3, 3.3, 0, 0, 6.283); s.x.fillStyle = lg(s.x, 0, -3.3, 0, 3.3, ['#f2ead2', '#cfc4a4']); s.x.fill(); for (let i = 1; i < 4; i++) line(s.x, bodyX + i * bodyL / 4, -3, bodyX + i * bodyL / 4, 3, 'rgba(90,70,40,0.35)', 0.4); if (key === 'supply') { circ(s.x, bodyX + bodyL / 2, 0, 1.2, P.fc); } }
    }
    grit(s, 0.08);
    return { body: s.c, w: s.w, h: s.h, tur: null, tw: 0, th: 0, tox };
  },
  ship(key, P, d) {
    const S = d.ship, boat = !!S.boat, L = boat ? 18 : key === 'sub' ? 60 : key === 'destroyer' || key === 'tship' ? 48 : 34, W = boat ? 6 : key === 'sub' ? 15 : key === 'destroyer' || key === 'tship' ? 12 : 9;
    const s = centered(L, W + 10, 4), x = s.x;
    if (boat) { for (const oy of [-1.8, 1.8]) { x.beginPath(); x.ellipse(0, oy, 8, 1.5, 0, 0, 6.283); x.fillStyle = S.hull; x.fill(); x.strokeStyle = '#2a1a0c'; x.lineWidth = 0.4; x.stroke(); for (let i = -6; i <= 6; i += 2) line(x, i, oy - 1, i - 1.2, oy - 2.6, '#c8b890', 0.3); } grit(s, 0.08); return { body: s.c, w: s.w, h: s.h, tur: null, tw: 0, th: 0, tox: 0 }; }
    const hull = [L / 2, 0, L / 2 - W * 0.9, -W / 2, -L / 2 + 1.5, -W / 2 + 0.6, -L / 2, -W / 2 + 1.4, -L / 2, W / 2 - 1.4, -L / 2 + 1.5, W / 2 - 0.6, L / 2 - W * 0.9, W / 2];
    poly(x, hull, lg(x, 0, -W / 2, 0, W / 2, [COL.shade(S.hull, 0.3), S.hull, COL.shade(S.hull, -0.3)]), '#140c06', 0.6);
    if (S.stripe) { x.save(); polyPath(x, hull); x.clip(); x.strokeStyle = S.stripe; x.lineWidth = 1.1; x.strokeRect(-L / 2 - 2, -W / 2 + 0.6, L + 4, W - 1.2); x.restore(); }
    if (S.ports) for (let i = 0; i < S.ports; i++) { const px = -L / 2 + 4 + i * ((L - W - 6) / S.ports); for (const sy of [-1, 1]) { fillRR(x, px, sy * (W / 2 - 0.9) - 0.4, 1.1, 0.8, 0.1, '#140c06'); if (S.decks === 2) fillRR(x, px + 0.5, sy * (W / 2 - 2.2) - 0.4, 1.1, 0.8, 0.1, '#140c06'); } }
    const deck = hull.map((v, i) => v * (i % 2 ? 0.74 : 0.92)); poly(x, deck, '#b08a5a');
    for (let i = -L / 2 + 2; i < L / 2 - W; i += 1.6) line(x, i, -W / 2 * 0.7, i, W / 2 * 0.7, 'rgba(60,40,20,0.18)', 0.3);
    const masts = S.masts || 2, span = L - W * 1.4;
    for (let m = 0; m < masts; m++) { // square-rigged yards across the beam, sails bellied forward
      const mx = -L / 2 + W * 0.6 + (m + 0.5) * (span / masts), sw = W * (m === Math.floor(masts / 2) ? 1.6 : 1.4);
      x.beginPath(); x.moveTo(mx, -sw / 2); x.quadraticCurveTo(mx + 3.2, 0, mx, sw / 2); x.lineTo(mx - 1.4, sw / 2 - 0.4); x.quadraticCurveTo(mx + 1.6, 0, mx - 1.4, -sw / 2 + 0.4); x.closePath();
      x.fillStyle = lg(x, mx - 1.4, 0, mx + 3, 0, [COL.shade(S.sail, -0.15), S.sail, COL.shade(S.sail, 0.12)]); x.fill(); x.strokeStyle = 'rgba(40,30,20,0.6)'; x.lineWidth = 0.35; x.stroke();
      circ(x, mx, 0, 0.8, '#3a2814');
      if (S.pirate && m === 0) { circ(x, mx + 1.2, 0, 1.2, '#e8e2d2'); circ(x, mx + 1.5, -0.4, 0.3, '#111'); circ(x, mx + 1.5, 0.4, 0.3, '#111'); }
    }
    line(x, L / 2, 0, L / 2 + 6, 0, '#5a3a20', 0.6); // bowsprit
    poly(x, [-L / 2 + 0.5, 0, -L / 2 - 4, -1.6, -L / 2 - 4, 1.6], S.pirate ? '#111' : P.fc, '#222', 0.3); // ensign
    grit(s, 0.08);
    return { body: s.c, w: s.w, h: s.h, tur: null, tw: 0, th: 0, tox: 0 };
  },
  unit(key, P, d) { return d.form ? this.infantry(key, P, d) : d.cat === 'sea' ? this.ship(key, P, d) : this.vehicle(key, P, d); },

  /* ---------- buildings (drawn at their true footprint: 32 px = 10 m) ---------- */
  roof(x, X, Y, W, H, col, horiz = true, h = 4) { // pitched roof from above with ridge, two lit halves and a cast shadow
    fillRR(x, X + h, Y + h, W, H, 1, 'rgba(30,18,8,0.35)');
    if (horiz) { fillRR(x, X, Y, W, H / 2, 0.5, COL.shade(col, 0.16)); fillRR(x, X, Y + H / 2, W, H / 2, 0.5, COL.shade(col, -0.18)); line(x, X + 1, Y + H / 2, X + W - 1, Y + H / 2, COL.shade(col, -0.45), 0.9); for (let i = 3; i < W; i += 3) { line(x, X + i, Y + 1, X + i, Y + H / 2 - 1, 'rgba(0,0,0,0.08)', 0.5); line(x, X + i, Y + H / 2 + 1, X + i, Y + H - 1, 'rgba(0,0,0,0.1)', 0.5); } }
    else { fillRR(x, X, Y, W / 2, H, 0.5, COL.shade(col, 0.16)); fillRR(x, X + W / 2, Y, W / 2, H, 0.5, COL.shade(col, -0.18)); line(x, X + W / 2, Y + 1, X + W / 2, Y + H - 1, COL.shade(col, -0.45), 0.9); for (let i = 3; i < H; i += 3) { line(x, X + 1, Y + i, X + W / 2 - 1, Y + i, 'rgba(0,0,0,0.08)', 0.5); line(x, X + W / 2 + 1, Y + i, X + W - 1, Y + i, 'rgba(0,0,0,0.1)', 0.5); } }
    x.strokeStyle = 'rgba(40,20,10,0.6)'; x.lineWidth = 0.7; x.strokeRect(X, Y, W, H);
  },
  ground(x, W, H, col = '#a08c62') { fillRR(x, 1, 1, W - 2, H - 2, 2, lg(x, 0, 0, W, H, [COL.shade(col, 0.1), COL.shade(col, -0.08)])); },
  flag(x, X, Y, col) { line(x, X, Y, X, Y - 14, '#ddd2b8', 0.9); poly(x, [X, Y - 14, X + 9, Y - 11.5, X, Y - 9], col, '#222', 0.3); },
  chimney(x, X, Y, r = 3) { circ(x, X + 2, Y + 2, r, 'rgba(0,0,0,0.3)'); circ(x, X, Y, r, '#8a4a32', '#3a1a10', 0.6); circ(x, X, Y, r * 0.55, '#1a1210'); },
  tent(x, X, Y, w, h, col = '#ece4cc') { fillRR(x, X + 2, Y + 2, w, h, 1, 'rgba(0,0,0,0.25)'); fillRR(x, X, Y, w / 2, h, 1, COL.shade(col, 0.06)); fillRR(x, X + w / 2, Y, w / 2, h, 1, COL.shade(col, -0.14)); line(x, X + w / 2, Y, X + w / 2, Y + h, 'rgba(80,60,30,0.6)', 0.6); },
  bld(x, key, F, W, H, lvl) {
    const fc = F.color, tile = '#a8553a', slate = '#5e6a78', stone = '#c8bc9e', thatch = '#b89a5a', wood = '#7a5634';
    switch (key) {
      case 'hq': { this.ground(x, W, H, '#b8a880'); for (let i = 8; i < W - 8; i += 10) { circ(x, i, H - 7, 3, '#4a6a32'); } // formal garden
        this.roof(x, 8, 8, W - 16, 22, slate); this.roof(x, 8, 26, 20, H - 46, slate, false); this.roof(x, W - 28, 26, 20, H - 46, slate, false); // corps de logis & wings
        fillRR(x, 30, 32, W - 60, H - 52, 1, '#d8ccb0'); circ(x, W / 2, 32 + (H - 52) / 2, 5, '#5a7a3a'); // courtyard & fountain
        this.flag(x, W / 2, 14, fc); if (lvl > 1) for (const [cx, cy] of [[4, 4], [W - 4, 4], [4, H - 4], [W - 4, H - 4]]) circ(x, cx, cy, 6, stone, '#5a4a30', 1); break; }
      case 'power': this.ground(x, W, H, '#9a8a5a'); circ(x, W / 2 + 3, H / 2 + 3, W * 0.32, 'rgba(0,0,0,0.3)'); circ(x, W / 2, H / 2, W * 0.32, rg(x, W / 2 - 4, H / 2 - 4, 2, W * 0.32, ['#e2d8c0', '#9a8a6c']), '#4a3a24', 1); circ(x, W / 2, H / 2, W * 0.16, '#7a5034'); break;
      case 'refinery': this.ground(x, W, H, '#8a7a5a'); this.roof(x, 6, 6, W * 0.6, H - 14, tile); this.chimney(x, W - 22, 18, 6); this.chimney(x, W - 22, H - 18, 4); for (let i = 0; i < 5; i++) circ(x, W * 0.7 + (i % 3) * 8, H - 10 - (i > 2 ? 8 : 0), 3, '#c8a640'); break;
      case 'barracks': this.ground(x, W, H, '#c4b088'); this.roof(x, 6, 6, W - 12, 26, tile); this.roof(x, 6, H - 34, W - 12, 26, tile); for (let i = 16; i < W - 16; i += 12) circ(x, i, H / 2, 1.2, '#6a5a3a'); this.flag(x, W - 14, H / 2 + 6, fc); break;
      case 'factory': this.ground(x, W, H, '#b0a070'); this.roof(x, 6, 6, W - 12, 28, thatch); this.roof(x, 6, 34, 26, H - 42, thatch, false); // stables L
        x.strokeStyle = '#6a4a2a'; x.lineWidth = 1.2; x.strokeRect(40, 42, W - 50, H - 52); for (let i = 0; i < 3; i++) { const gx = 52 + i * 26, gy = H - 22; fillRR(x, gx, gy - 1.5, 16, 3, 1, '#a9823e', '#3a2a10', 0.5); circ(x, gx + 4, gy - 4, 3, null, '#3a2814', 1); circ(x, gx + 4, gy + 4, 3, null, '#3a2814', 1); } this.flag(x, 14, H - 10, fc); break;
      case 'shipyard': this.ground(x, W, H, '#9a8a6a'); fillRR(x, 6, H / 2 - 12, W - 12, 24, 2, '#6a5a44'); for (let i = 0; i < 9; i++) line(x, 20 + i * 15, H / 2 - 10, 20 + i * 15, H / 2 + 10, '#c8a878', 1.6); line(x, 14, H / 2, W - 10, H / 2, '#c8a878', 2.2); // keel & ribs on the slipway
        this.roof(x, 6, 6, 50, 24, tile); for (let i = 0; i < 4; i++) fillRR(x, W - 60 + i * 12, 10, 9, 18, 1, '#8a6a44', '#3a2a14', 0.5); this.flag(x, 10, H - 8, fc); break;
      case 'radar': this.ground(x, W, H, '#a49470'); fillRR(x, 12, 12, W - 24, H - 24, 1, lg(x, 12, 12, W - 12, H - 12, ['#d8ccb0', '#8a7c60']), '#4a3a24', 1); break;
      case 'lab': this.ground(x, W, H, '#b8a880'); this.roof(x, 6, 6, W - 12, H - 22, slate); circ(x, W / 2, H / 2 - 8, 13, rg(x, W / 2 - 4, H / 2 - 12, 2, 13, ['#c8d4c8', '#6a8a78']), '#3a4a40', 1); for (let i = 0; i < 6; i++) circ(x, W / 2 - 25 + i * 10, H - 11, 2.2, '#ece4cc', '#8a7a5a', 0.5); this.flag(x, W / 2, H / 2 - 22, fc); break;
      case 'fueldepot': this.ground(x, W, H, '#a49460'); this.roof(x, 6, 6, W - 12, 34, '#8a6a3c'); for (let i = 0; i < 4; i++) circ(x, 14 + i * 20, H - 18, 8, rg(x, 12 + i * 20, H - 20, 1, 8, ['#e8cc78', '#a88a3a']), '#7a5a20', 0.6); break;
      case 'depot': this.ground(x, W, H, '#a49470'); this.roof(x, 6, 6, W - 12, 40, tile); for (let i = 0; i < 8; i++) { const bx = 10 + (i % 4) * 26, by = 56 + ((i / 4) | 0) * 16; fillRR(x, bx, by, 10, 10, 1, '#8a6440', '#3a2814', 0.5); circ(x, bx + 17, by + 5, 4, '#6a4a2a', '#2a1a0a', 0.5); } break;
      case 'ammo': this.ground(x, W, H, '#7a8a4a'); fillRR(x, 6, 6, W - 12, H - 12, 6, '#6a7a3e'); this.roof(x, 16, 16, W - 32, H - 32, stone); this.flag(x, W - 12, 14, '#c22'); break;
      case 'repair': this.ground(x, W, H, '#a49470'); this.roof(x, 6, 6, W - 12, 40, tile); for (let i = 0; i < 4; i++) this.wheel(x, 20 + i * 26, H - 22, 8); this.chimney(x, W - 16, H - 16, 4); break;
      case 'medical': this.ground(x, W, H, '#9aa070'); this.tent(x, 8, 8, 34, 26); this.tent(x, 50, 8, 34, 26); this.tent(x, 8, 46, 34, 26); this.tent(x, 50, 46, 34, 26); this.flag(x, W / 2, H / 2 + 4, '#e8c838'); break;
      case 'mine': this.ground(x, W, H, '#7a6a54'); circ(x, W * 0.66, H * 0.66, W * 0.26, rg(x, W * 0.66, H * 0.66, 2, W * 0.26, ['#3a3430', '#6a5a4a'])); for (const [a, b] of [[10, 10], [44, 10], [10, 44], [44, 44]]) line(x, a, b, 27, 27, '#5a3a20', 2.2); circ(x, 27, 27, 5, '#3a2814'); break;
      case 'farm': { const furrow = ['#9a7a44', '#b49a58', '#8a9a48', '#c4a85a']; for (let q = 0; q < 4; q++) { const qx = (q % 2) * W / 2, qy = ((q / 2) | 0) * H / 2; fillRR(x, qx + 2, qy + 2, W / 2 - 4, H / 2 - 4, 1, furrow[q]); for (let i = 6; i < W / 2 - 4; i += 5) line(x, qx + i, qy + 4, qx + i, qy + H / 2 - 4, 'rgba(60,40,20,0.22)', 1.2); } x.strokeStyle = '#5a4a2a'; x.lineWidth = 1.4; x.strokeRect(2, 2, W - 4, H - 4); this.roof(x, W / 2 - 18, H / 2 - 12, 36, 24, tile); break; }
      case 'pump': this.ground(x, W, H, '#9a9a70'); circ(x, W / 2, H / 2, 18, '#a8a090', '#4a4030', 1.2); circ(x, W / 2, H / 2, 11, rg(x, W / 2 - 3, H / 2 - 3, 1, 11, ['#6a9ab0', '#1a3a4a'])); line(x, W / 2 - 18, H / 2, W / 2 + 18, H / 2, wood, 2); break;
      case 'logistics': this.ground(x, W, H, '#a49470'); this.roof(x, 6, 6, 60, H - 12, thatch, false); for (let i = 0; i < 4; i++) { fillRR(x, 76 + (i % 2) * 34, 12 + ((i / 2) | 0) * 40, 26, 14, 1, '#7a5634', '#2a1a0c', 0.5); circ(x, 76 + (i % 2) * 34 + 13, 19 + ((i / 2) | 0) * 40, 5, '#efe6cc'); } break;
      case 'shelter': this.ground(x, W, H, '#9a9a6a'); for (let i = 0; i < 9; i++) this.tent(x, 10 + (i % 3) * 50, 10 + ((i / 3) | 0) * 50, 34, 30, ['#e8dcc0', '#d8ccb0', '#c8bc9e'][i % 3]); break;
      case 'wall': fillRR(x, 1, 1, W - 2, H - 2, 1, lg(x, 0, 0, W, H, ['#c4b898', '#8a7e64']), '#4a4030', 1); for (let i = 0; i < 4; i++) line(x, 2, 6 + i * 7, W - 2, 6 + i * 7, 'rgba(60,50,30,0.35)', 0.6); break;
      case 'trench': fillRR(x, 1, 1, W - 2, H - 2, 4, lg(x, 0, 0, W, H, ['#8a6e44', '#5a4428']), 'rgba(40,30,15,0.6)', 0.8); fillRR(x, 6, 10, W - 12, H - 20, 2, '#3a2c18'); break;
      case 'bunker': { poly(x, [W / 2, 2, W - 2, H / 2, W / 2, H - 2, 2, H / 2], lg(x, 0, 0, W, H, ['#8a7a4a', '#5a4a2a']), '#3a2a14', 1.2); poly(x, [W / 2, 14, W - 14, H / 2, W / 2, H - 14, 14, H / 2], '#6a6a3a'); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; circ(x, W / 2 + Math.cos(a) * (W / 2 - 20), H / 2 + Math.sin(a) * (H / 2 - 20), 2.6, '#8a6a3a', '#3a2814', 0.5); } this.flag(x, W / 2, H / 2, fc); break; }
      case 'tower': circ(x, W / 2 + 3, H / 2 + 3, 12, 'rgba(0,0,0,0.3)'); fillRR(x, 5, 5, W - 10, H - 10, 1, lg(x, 0, 0, W, H, ['#a07a4a', '#5a3a1e']), '#2a1a0a', 1); line(x, 5, 5, W - 5, H - 5, '#3a2410', 1); line(x, W - 5, 5, 5, H - 5, '#3a2410', 1); this.flag(x, W / 2, H / 2, fc); break;
      case 'turret': fillRR(x, 2, 2, W - 4, H - 4, 8, lg(x, 0, 0, W, H, ['#8e7e50', '#5e4e2c']), '#3a2a14', 1.2); fillRR(x, 10, 10, W - 20, H - 20, 5, '#a8946a'); break;
      case 'coastal': fillRR(x, 2, 2, W - 4, H - 4, W / 2, lg(x, 0, 0, W, H, ['#d0c4a4', '#8a7e64']), '#4a4030', 1.5); circ(x, W / 2, H / 2, W / 2 - 14, '#b0a484', '#5a4a34', 1); this.flag(x, 14, 18, fc); break;
      default: this.ground(x, W, H); this.roof(x, 4, 4, W - 8, H - 8, tile);
    }
  },
  turret(key, P, lvl) {
    let s = null;
    if (key === 'turret' || key === 'coastal') { const big = key === 'coastal' || lvl > 1; s = centered(big ? 34 : 28, 14, 2); fillRR(s.x, -6, -4, 10, 8, 1, '#6a4a2a', '#2a1a0a', 0.5); fillRR(s.x, -2, -1.6, big ? 18 : 14, 3.2, 1.4, lg(s.x, 0, -1.6, 0, 1.6, ['#5a5a5c', '#2a2a2c']), '#111', 0.4); }
    else if (key === 'power') { s = centered(40, 40, 2); for (let i = 0; i < 4; i++) { s.x.save(); s.x.rotate(i * Math.PI / 2); fillRR(s.x, 1.5, -2.2, 18, 4.4, 0.6, '#ece2c8', '#5a4024', 0.5); for (let k = 4; k < 18; k += 3) line(s.x, 1.5 + k, -2.2, 1.5 + k, 2.2, 'rgba(90,64,36,0.5)', 0.4); s.x.restore(); } circ(s.x, 0, 0, 2.5, '#5a4024'); }
    else if (key === 'radar') { s = centered(30, 30, 2); line(s.x, -12, 0, 12, 0, '#3a2814', 1.6); line(s.x, 0, -12, 0, 12, '#3a2814', 1.2); fillRR(s.x, 8, -3, 5, 6, 0.6, '#1a1a1a'); fillRR(s.x, -3, 8, 6, 5, 0.6, '#1a1a1a'); }
    if (s) grit(s, 0.06);
    return s ? { img: s.c, w: s.w, h: s.h } : null;
  },
  /* ---------- period town ---------- */
  civ(x, key, W, H, v) {
    const roofs = ['#a8553a', '#9a4a32', '#b0623e', '#7a5a4a', '#5e6a78', '#8a5038'], roof = roofs[v % roofs.length], stone = '#cfc2a2';
    const yard = (c = '#8a8a4e') => fillRR(x, 1, 1, W - 2, H - 2, 1, lg(x, 0, 0, W, H, [COL.shade(c, 0.06), COL.shade(c, -0.08)]));
    switch (key) {
      case 'house': case 'ruin': yard(); this.roof(x, 4, 5, W - 10, H - 12, key === 'ruin' ? '#6a5a4a' : roof, v % 2 === 0, 3); if (v % 3 === 0) this.chimney(x, W - 9, 8, 1.6); break;
      case 'farmhouse': yard('#9a8a4a'); this.roof(x, 4, 4, W - 12, H - 14, '#b89a5a', true, 3); circ(x, W - 6, H - 6, 3.4, '#d8b860'); break;
      case 'commtower': yard('#8a8a5a'); this.roof(x, 3, 6, W - 6, H - 12, '#6a6a72', false, 3); fillRR(x, W / 2 - 5, 2, 10, 10, 1, stone, '#4a4030', 0.8); poly(x, [W / 2, 0, W / 2 + 5, 6, W / 2 - 5, 6], '#5e6a78'); break; // church & steeple
      case 'cityhall': yard('#b8a880'); this.roof(x, 5, 5, W - 10, H - 10, '#5e6a78'); fillRR(x, W / 2 - 7, H / 2 - 7, 14, 14, 1, stone, '#4a4030', 1); circ(x, W / 2, H / 2, 4, '#f2ecd8', '#333', 0.6); line(x, W / 2, H / 2, W / 2, H / 2 - 3, '#222', 0.6); break;
      case 'factory': case 'powerstation': yard('#8a7a5a'); this.roof(x, 4, 4, W - 18, H - 10, '#8a4a32'); this.chimney(x, W - 10, 12, 4); this.chimney(x, W - 10, H - 12, 3); break;
      case 'port': yard('#8a7a5a'); fillRR(x, 2, H * 0.55, W - 4, H * 0.4, 1, '#a49a84'); this.roof(x, 4, 4, W * 0.45, H * 0.45, roof); for (let i = 0; i < 5; i++) fillRR(x, W * 0.55 + i * 8, 8, 6, 6, 1, '#7a5634'); break;
      case 'market': case 'supermarket': yard('#c4b088'); for (let i = 0; i < Math.max(2, (W / 14) | 0); i++) this.tent(x, 4 + i * 14, 6, 11, H - 14, i % 2 ? '#c84a32' : '#ece4cc'); break;
      case 'university': case 'hospital': case 'school': yard('#b8a880'); this.roof(x, 4, 4, W - 8, 16, roof); this.roof(x, 4, H - 20, W - 8, 16, roof); this.roof(x, 4, 20, 14, H - 40, roof, false); this.roof(x, W - 18, 20, 14, H - 40, roof, false); fillRR(x, 22, 24, W - 44, H - 48, 1, '#7a9a4a'); break;
      case 'checkpoint': yard('#9a8a5a'); this.roof(x, 3, 3, W / 2, H / 2, roof, true, 2); line(x, 4, H - 6, W - 4, H - 6, '#e8e2d2', 2); line(x, 4, H - 6, W - 4, H - 6, '#c22', 2); break;
      case 'derrick': yard('#8a7a5a'); for (let i = 0; i < 3; i++) fillRR(x, 4, 4 + i * 9, W - 8, 6, 1, '#e8e2d2', '#8a8070', 0.6); break;
      case 'construction': yard('#a49470'); x.strokeStyle = '#7a5634'; x.lineWidth = 1; for (let i = 6; i < W - 4; i += 7) { line(x, i, 4, i, H - 4, '#7a5634', 1); line(x, 4, i, W - 4, i, '#7a5634', 0.6); } break;
      case 'waterplant': yard('#7a8a5a'); fillRR(x, 2, H / 2 - 5, W - 4, 10, 2, '#4a7a8a'); this.roof(x, 6, 4, W / 2, H / 2 - 8, roof); circ(x, W / 2 + 14, H / 2, 9, null, '#5a3a20', 2); break;
      default: { yard('#a09468'); const n = W > 70 ? 3 : W > 40 ? 2 : 1; for (let i = 0; i < n; i++) this.roof(x, 4 + i * (W - 8) / n, 4, (W - 8) / n - 2, H - 10, roofs[(v + i) % roofs.length], H < W, 3); if (W > 40) this.chimney(x, W - 10, 8, 2); }
    }
  },
  agent(type, v) { // horse-drawn traffic instead of motor cars
    const s = centered(type === 'bus' || type === 'fire' || type === 'truck' ? 22 : 16, 7, 2), x = s.x, L = s.w - 4;
    const col = { bus: '#2a3a5a', ambulance: '#ece4cc', police: '#1e2a4a', fire: '#a82a1e', tractor: '#7a5634', truck: '#6a4a2a' }[type] || ['#3a2a1e', '#5a2a22', '#2a3a2a', '#4a3a2a'][v % 4];
    this.team(x, L / 2 - 8, 1, '#5a3a22');
    fillRR(x, -L / 2, -3, L - 10, 6, 1, lg(x, 0, -3, 0, 3, [COL.shade(col, 0.25), COL.shade(col, -0.3)]), '#140c06', 0.4);
    this.wheel(x, -L / 2 + 2, -3.4, 1.6); this.wheel(x, -L / 2 + 2, 3.4, 1.6);
    grit(s, 0.06);
    return { img: s.c, w: s.w, h: s.h };
  },
};
