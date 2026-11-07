'use strict';
/* SPEARHEAD // data — weapons, unit types, loadouts, missions, field manual.
   Ranges are game-scaled (compressed) so a firefight fits on a phone screen. */

const WPN = {
  rifle:   { n: 'M4 Carbine',      dmg: 26, rof: 6,  burst: 3, rest: .75, rng: 42, acc: .62, sup: 6,  snd: 'rifle' },
  lmg:     { n: 'M249 SAW',        dmg: 20, rof: 13, burst: 8, rest: .55, rng: 52, acc: .40, sup: 15, snd: 'lmg' },
  dmr:     { n: 'Mk 14 DMR',       dmg: 72, rof: 1.4,burst: 1, rest: 1.1, rng: 72, acc: .86, sup: 10, snd: 'dmr' },
  shotgun: { n: 'M1014 Shotgun',   dmg: 58, rof: 2,  burst: 1, rest: .65, rng: 14, acc: .92, sup: 8,  snd: 'shotgun' },
  medrifle:{ n: 'M4 Carbine',      dmg: 24, rof: 5,  burst: 2, rest: .9,  rng: 38, acc: .52, sup: 5,  snd: 'rifle' },
  ak:      { n: 'AK-pattern rifle',dmg: 20, rof: 5,  burst: 3, rest: .95, rng: 40, acc: .44, sup: 7,  snd: 'ak' },
  pkm:     { n: 'PK machine gun',  dmg: 16, rof: 11, burst: 9, rest: .8,  rng: 56, acc: .30, sup: 17, snd: 'lmg' },
  svd:     { n: 'Sniper rifle',    dmg: 82, rof: .5, burst: 1, rest: 3,   rng: 88, acc: .80, sup: 14, snd: 'dmr', aim: 1.6 },
  smg:     { n: 'Submachine gun',  dmg: 17, rof: 10, burst: 5, rest: .6,  rng: 24, acc: .48, sup: 5,  snd: 'smg' },
  hmg:     { n: 'Mounted HMG',     dmg: 30, rof: 7,  burst: 8, rest: 1.0, rng: 66, acc: .30, sup: 24, snd: 'hmg' },
  rpg:     { n: 'RPG launcher',    dmg: 95, rof: 1,  burst: 1, rest: 9,   rng: 48, acc: .62, sup: 45, snd: 'rpg', proj: 1, aoe: 3.6 }
};

/* friendly roles: pts = squad-builder cost */
const FR = {
  TL:  { n: 'Team Leader',         ab: 'TL',  hp: 100, spd: 4.2, w: 'rifle',   col: '#38bdf8', pts: 0, kit: { smoke: 2, flare: 0, tq: 1 }, d: 'Directs the fight. Nearby troops shake off suppression faster.' },
  RFL: { n: 'Rifleman',            ab: 'RFL', hp: 100, spd: 4.2, w: 'rifle',   col: '#7dd3fc', pts: 2, kit: { frag: 2, smoke: 1, tq: 1 }, d: 'Flexible. Carries frag grenades.' },
  AR:  { n: 'Automatic Rifleman',  ab: 'AR',  hp: 110, spd: 3.6, w: 'lmg',     col: '#fbbf24', pts: 3, kit: { tq: 1 }, d: 'Belt-fed machine gun. Pins enemies down so others can move.' },
  GRN: { n: 'Grenadier',           ab: 'GRN', hp: 100, spd: 4.0, w: 'rifle',   col: '#fb923c', pts: 3, kit: { gl: 4, tq: 1 }, d: '40mm launcher: blast damage over cover.' },
  DM:  { n: 'Designated Marksman', ab: 'DM',  hp: 90,  spd: 3.9, w: 'dmr',     col: '#a78bfa', pts: 3, kit: { tq: 1 }, sight: 1.25, d: 'Long range precision. Sees further.' },
  MED: { n: 'Combat Medic',        ab: 'MED', hp: 95,  spd: 4.3, w: 'medrifle',col: '#34d399', pts: 2, kit: { tq: 4, kits: 3, smoke: 1 }, med: 2, d: 'Treats casualties twice as fast. Carries the aid bag.' },
  BRC: { n: 'Breacher',            ab: 'BRC', hp: 110, spd: 4.0, w: 'shotgun', col: '#f472b6', pts: 2, kit: { breach: 2, frag: 1, tq: 1 }, d: 'Shotgun and breaching charges for locked doors.' }
};
/* enemy types */
const EN = {
  rfl: { n: 'Rifleman',      hp: 80,  spd: 3.8, w: 'ak',  col: '#f43f5e', pts: 1 },
  mg:  { n: 'Machine Gunner',hp: 110, spd: 2.8, w: 'pkm', col: '#e11d48', pts: 2 },
  rpg: { n: 'RPG Gunner',    hp: 85,  spd: 3.6, w: 'rpg', col: '#fb7185', pts: 2 },
  snp: { n: 'Sniper',        hp: 70,  spd: 3.5, w: 'svd', col: '#be123c', pts: 2, sight: 1.4 },
  flk: { n: 'Flanker',       hp: 70,  spd: 5.0, w: 'smg', col: '#fda4af', pts: 1 },
  tec: { n: 'Technical',     hp: 520, spd: 6.0, w: 'hmg', col: '#9f1239', pts: 4, veh: 1 }
};
const LOAD = {
  armor: { light: { n: 'Light carrier', spd: 1.08, dmg: 1.12 }, plate: { n: 'Plate carrier', spd: 1, dmg: 1 }, heavy: { n: 'Heavy armor', spd: .86, dmg: .74 } },
  optic: { iron: { n: 'Iron sights', near: 1, far: 1 }, reddot: { n: 'Red dot', near: 1.12, far: .97 }, lpvo: { n: 'Variable optic', near: .95, far: 1.14 } },
  extra: { none: { n: 'Nothing extra' }, frag: { n: '+1 Frag' }, smoke: { n: '+1 Smoke' }, ifak: { n: '+1 Tourniquet' } }
};
const DIFF = { recruit: { n: 'Recruit', acc: .68, dmg: .75, think: 1.3 }, regular: { n: 'Regular', acc: 1, dmg: 1, think: 1 }, veteran: { n: 'Veteran', acc: 1.18, dmg: 1.12, think: .75 } };

/* ---------- map building helpers ---------- */
const O = (t, x, y, w, h, extra) => Object.assign({ t, x, y, w, h }, extra || {});
/* building: perimeter walls with door gaps. doors: [side, offset(m from left/top), kind 'open'|'locked'] */
function building(x, y, w, h, doors = [], inner = []) {
  const T = .5, G = 1.8, out = [{ t: 'floor', x, y, w, h }];
  const side = (s, ax, ay, len, horiz) => {
    const gaps = doors.filter(d => d[0] === s).map(d => d[1]).sort((a, b) => a - b);
    let p = 0;
    for (const g of [...gaps, len + G / 2 + 99]) {
      const a = p, b = Math.min(len, g - G / 2);
      if (b > a) out.push(horiz ? O('wall', ax + a, ay, b - a, T) : O('wall', ax, ay + a, T, b - a));
      if (g <= len) { const d = doors.find(q => q[0] === s && q[1] === g); if (d[2] === 'locked') out.push(horiz ? O('door', ax + g - G / 2, ay, G, T) : O('door', ax, ay + g - G / 2, T, G)); }
      p = g + G / 2;
    }
  };
  side('n', x, y, w, 1); side('s', x, y + h - T, w, 1); side('w', x, y, h, 0); side('e', x + w - T, y, h, 0);
  for (const s of inner) out.push(O('wall', ...s));
  return out;
}
const B = (...a) => building(...a);

const MISSIONS = [
 { id: 1, name: 'Eyes Open', tag: 'COVER // CONCEALMENT // SECTORS', W: 50, H: 90, par: 150,
   lesson: 'Cover stops bullets. Concealment only hides you. Watch your sectors.',
   brief: ['Five hostiles hold the far side of this lot. Some are behind walls (cover), one is hiding in brush (concealment).', 'Drag from a soldier to draw their route. They will tuck into cover at the end of it.', 'Your shaded cones are what each soldier can see. Enemies outside every cone are invisible.'],
   obj: { type: 'kill' }, objText: 'Eliminate all hostiles',
   squad: { budget: 8, slots: 4, def: ['TL', 'AR', 'RFL', 'DM'], start: { x: 25, y: 84 } },
   map: [O('wall', 8, 62, 10, 1), O('wall', 32, 60, 10, 1), O('sand', 18, 50, 8, 1), O('brush', 30, 41, 9, 6), O('brush', 4, 26, 8, 8), O('wreck', 21, 34, 5, 2.4),
         O('sand', 35, 24, 8, 1), O('wall', 9, 15, 10, 1), O('sand', 25, 13, 9, 1), O('crate', 42, 44, 2, 2), O('crate', 6, 46, 2, 2)],
   hills: [{ x: 40, y: 72, r: 7 }],
   enemies: [{ t: 'rfl', x: 14, y: 13 }, { t: 'rfl', x: 29, y: 11 }, { t: 'rfl', x: 39, y: 22 }, { t: 'rfl', x: 23.5, y: 32 }, { t: 'rfl', x: 8, y: 30, hold: 1 }] },

 { id: 2, name: 'Suppress & Flank', tag: 'FIRE AND MANEUVER', W: 50, H: 90, par: 180,
   lesson: 'Pin them with fire from one direction. Move and kill from another.',
   brief: ['A machine gun nest covers the open field. Walking straight at it is suicide.', 'Put your Automatic Rifleman behind the sandbags and shoot at the nest: suppressed enemies shoot badly and stay down.', 'While they are pinned, send a team up the brush on the left or the wall on the right to hit them from the side.'],
   obj: { type: 'killreach', key: 'mg', zone: 'obj' }, objText: 'Kill the machine gunner, then take the nest',
   squad: { budget: 9, slots: 4, def: ['TL', 'AR', 'RFL', 'GRN'], start: { x: 25, y: 84 } },
   map: [O('sand', 20, 21, 10, 1), O('sand', 19, 15, 1, 7), O('sand', 30, 15, 1, 7), O('brush', 2, 22, 7, 44), O('wall', 41, 30, 1, 26), O('wall', 36, 24, 6, 1),
         O('sand', 14, 71, 22, 1), O('crate', 26, 46, 2, 2), O('wreck', 12, 40, 5, 2.4), O('wall', 4, 10, 8, 1), O('sand', 37, 12, 8, 1)],
   hills: [{ x: 25, y: 14, r: 9 }],
   zones: { obj: { x: 25, y: 17, r: 4, label: 'NEST' } },
   enemies: [{ t: 'mg', x: 25, y: 18.5, key: 'mg' }, { t: 'rfl', x: 22, y: 17 }, { t: 'rfl', x: 28, y: 17 }, { t: 'rfl', x: 8, y: 8.5 }, { t: 'rfl', x: 41, y: 10.5 }, { t: 'flk', x: 38, y: 21, hold: 1 }] },

 { id: 3, name: 'Breach & Clear', tag: 'FATAL FUNNEL // ROOM CLEARING', W: 50, H: 90, par: 100, timer: 150,
   lesson: 'Doorways are where people die. Do not linger in them, and never stack in one.',
   brief: ['Clear the compound before reinforcements arrive.', 'The west entrance is a locked steel door: your Breacher blows it open and stuns whoever is behind it.', 'Frag a room before you walk in. Anyone standing in a doorway takes fire from the whole room.'],
   obj: { type: 'kill' }, objText: 'Clear the compound',
   squad: { budget: 10, slots: 5, def: ['TL', 'BRC', 'RFL', 'AR', 'MED'], start: { x: 25, y: 84 } },
   map: [...B(10, 12, 30, 24, [['s', 6, 'locked'], ['s', 24, 'open']], [[22, 12, .5, 10], [22, 24, .5, 12], [22, 24, 7, .5], [32, 24, 8, .5]]),
         O('crate', 18, 47, 2.2, 2.2), O('crate', 30, 51, 2.2, 2.2), O('wall', 5, 58, 12, 1), O('wreck', 32, 62, 5, 2.4), O('sand', 39, 45, 7, 1), O('crate', 6, 43, 2, 2)],
   enemies: [{ t: 'rfl', x: 14, y: 18, hold: 1 }, { t: 'rfl', x: 18, y: 31, hold: 1 }, { t: 'flk', x: 30, y: 16, hold: 1 }, { t: 'rfl', x: 37, y: 20, hold: 1 }, { t: 'rfl', x: 26, y: 31, hold: 1 }, { t: 'mg', x: 37, y: 31, hold: 1 }, { t: 'rfl', x: 8, y: 41 }, { t: 'rfl', x: 42, y: 43 }] },

 { id: 4, name: 'Night Redoubt', tag: 'SECTORS OF FIRE // DEFENSE', W: 50, H: 90, par: 150, timer: 150, night: 1,
   lesson: 'In defense, every rifle owns a slice of the circle. No gaps, no overlaps.',
   brief: ['Hold the sandbag redoubt until the clock runs out. Attacks will come from every direction.', 'Press and hold the ground to make a soldier watch that direction: their sector of fire.', 'It is dark. Fire flares to light up an area. Muzzle flashes give enemy positions away.'],
   obj: { type: 'survive', min: 2 }, objText: 'Hold for 2:30 with 2+ fighting',
   squad: { budget: 10, slots: 5, def: ['TL', 'AR', 'RFL', 'DM', 'MED'], start: { x: 25, y: 60 }, kit: { flare: 3 } },
   map: [O('sand', 16, 51, 18, 1), O('sand', 16, 68, 7, 1), O('sand', 27, 68, 7, 1), O('sand', 16, 51, 1, 18), O('sand', 33, 51, 1, 18),
         O('brush', 4, 18, 9, 9), O('brush', 37, 23, 9, 9), O('wall', 11, 32, 8, 1), O('wall', 31, 33, 8, 1), O('wreck', 22, 22, 6, 2.4), O('crate', 6, 50, 2, 2), O('crate', 42, 48, 2, 2),
         O('brush', 2, 70, 7, 11), O('brush', 41, 72, 7, 11), O('wall', 20, 80, 10, 1)],
   waves: [{ t: 2, e: [['rfl', 15, 3], ['rfl', 25, 2], ['rfl', 35, 3]] }, { t: 24, e: [['flk', 1, 40], ['flk', 1, 46], ['rfl', 49, 42]] },
           { t: 50, e: [['mg', 25, 6], ['rfl', 18, 4], ['rfl', 32, 4]] }, { t: 78, e: [['rpg', 49, 30], ['rfl', 1, 30], ['rfl', 1, 36], ['rfl', 49, 36]] },
           { t: 106, e: [['rfl', 20, 2], ['rfl', 30, 2], ['flk', 1, 78], ['flk', 49, 78], ['snp', 25, 1]] }] },

 { id: 5, name: 'Care Under Fire', tag: 'TCCC // CUF → TFC → TACEVAC', W: 50, H: 90, par: 200,
   lesson: 'The best medicine under fire is fire superiority. Tourniquet, drag to cover, then MARCH.',
   brief: ['Sgt. Reyes is down in the open with a bleeding leg. Enemies on the ridge are covering him. He has about 2 minutes.', 'CARE UNDER FIRE: return fire and take cover first. The only treatment is a tourniquet, high and tight. Then drag him to cover.', 'TACTICAL FIELD CARE: once the shooting near you stops, the medic works through MARCH. Then carry him to the landing zone for CASEVAC.'],
   obj: { type: 'casevac', zone: 'lz' }, objText: 'Save Reyes: treat him and get him to the LZ',
   squad: { budget: 9, slots: 4, def: ['TL', 'AR', 'MED', 'RFL'], start: { x: 25, y: 82 } },
   preDown: { name: 'Sgt. Reyes', role: 'RFL', x: 24, y: 50, inj: 'limb', bleed: 120 },
   map: [O('wall', 9, 75, 32, 1), O('sand', 14, 58, 6, 1), O('wreck', 30, 59, 5, 2.4), O('brush', 2, 36, 8, 26), O('wall', 41, 40, 1, 16),
         O('sand', 20, 19, 10, 1), O('wall', 9, 16, 7, 1), O('sand', 35, 16, 7, 1), O('crate', 24, 40, 2, 2)],
   hills: [{ x: 25, y: 12, r: 12 }],
   zones: { lz: { x: 8, y: 85, r: 5, label: 'LZ' } },
   enemies: [{ t: 'mg', x: 25, y: 17.5 }, { t: 'rfl', x: 12.5, y: 14.5 }, { t: 'rfl', x: 38.5, y: 14.5 }, { t: 'snp', x: 44, y: 6 }, { t: 'flk', x: 46, y: 30, hold: 1 }] },

 { id: 6, name: 'Corridor Exfil', tag: 'URBAN MOVEMENT // SMOKE', W: 50, H: 100, par: 200,
   lesson: 'Smoke is concealment you carry. Cross open ground behind it, then bound cover to cover.',
   brief: ['Fight up the street to the exfil point. Bring everyone, including anyone hurt.', 'Smoke blocks sight, not bullets: throw it between you and the shooter, then move.', 'A technical with a heavy machine gun will come down the street. Your grenadier’s 40mm or frags will stop it.'],
   obj: { type: 'exfil', zone: 'exfil', min: 3 }, objText: 'Get 3+ operators (and all casualties) to EXFIL',
   squad: { budget: 11, slots: 5, def: ['TL', 'AR', 'GRN', 'RFL', 'MED'], start: { x: 25, y: 94 } },
   map: [O('bldg', 0, 10, 13, 22), O('bldg', 0, 38, 13, 24), O('bldg', 0, 68, 13, 22), O('bldg', 37, 16, 13, 20), O('bldg', 37, 42, 13, 22), O('bldg', 37, 70, 13, 24),
         O('wreck', 17, 72, 5, 2.4), O('wreck', 28, 52, 5, 2.4), O('wreck', 16, 33, 5, 2.4), O('sand', 20, 15, 10, 1), O('crate', 31, 80, 2, 2), O('crate', 15, 58, 2, 2), O('crate', 32, 26, 2, 2)],
   zones: { exfil: { x: 25, y: 5, r: 6, label: 'EXFIL' } },
   enemies: [{ t: 'mg', x: 25, y: 13.5 }, { t: 'rfl', x: 18, y: 31 }, { t: 'rfl', x: 30, y: 50.5 }, { t: 'rpg', x: 41, y: 39 }, { t: 'flk', x: 9, y: 65, hold: 1 }, { t: 'rfl', x: 33, y: 24.5 }, { t: 'snp', x: 44, y: 9 }],
   waves: [{ t: 40, e: [['tec', 25, 1]] }] }
];

/* ---------- field manual (shown in-game; kept short and accurate) ---------- */
const MANUAL = [
 ['Cover vs. Concealment', 'Cover stops bullets: walls, vehicles, sandbags. Concealment only hides you: brush, smoke, darkness. In the game, a shield icon shows how much cover a spot gives (full or half). Brush hides you but stops nothing.'],
 ['Sectors of Fire', 'Each rifle is responsible for a slice of the area around the team. Sectors should overlap slightly at the edges so nothing slips between them. Long-press the ground to set a soldier’s sector.'],
 ['Suppression & Fire Superiority', 'Accurate, sustained fire makes the enemy keep their heads down. Suppressed troops shoot less and worse. Winning the volume of fire is called fire superiority, and it is what lets anyone else move.'],
 ['Fire and Maneuver', 'One element shoots (the base of fire) while another moves to a better position, usually the enemy’s flank. A target can only face one way: hit it from the side and its cover stops helping.'],
 ['Bounding Overwatch', 'Never all move at once. One team watches and covers while the other moves to the next bit of cover, then they swap.'],
 ['The Fatal Funnel', 'A doorway is the one place every gun in the room is already aimed at. Get through it fast, never stop in it, and never bunch up behind it.'],
 ['TCCC: Three Phases', 'Tactical Combat Casualty Care splits battlefield care into Care Under Fire (CUF), Tactical Field Care (TFC) and Tactical Evacuation Care (TACEVAC). What you are allowed to do depends on whether you are still under effective fire.'],
 ['Care Under Fire', 'Return fire and take cover first. The only medical treatment is stopping life-threatening limb bleeding with a tourniquet, placed “high and tight,” then moving the casualty to cover. Airway care waits for Tactical Field Care.'],
 ['MARCH', 'In Tactical Field Care, treat in this order: Massive hemorrhage, Airway, Respiration (breathing), Circulation, Hypothermia & Head injury. Bleeding kills fastest, so it comes first. After MARCH, the rest of the assessment (often called PAWS: pain, antibiotics, wounds, splinting) follows.'],
 ['TACEVAC', 'Move the stabilized casualty to an evacuation point. CASEVAC uses whatever vehicle or aircraft is available, while MEDEVAC uses dedicated medical transport. Keep reassessing along the way.'],
 ['Smoke', 'Smoke blocks vision, not bullets. Throw it between you and the enemy, then move while it lasts. Enemies may still fire blindly into it.'],
 ['About this simulator', 'SPEARHEAD is a training game that simplifies tactics and medicine to teach decision-making. It is not a substitute for certified TCCC or tactics training. Medical content follows the published CoTCCC guidelines (January 2024 edition) at a summary level.']
];
const MARCH_STEPS = [
 { k: 'M', n: 'Massive bleeding', d: 'Check the tourniquet; pack and pressure any other bleeding.' },
 { k: 'A', n: 'Airway', d: 'Make sure the airway is open; position the casualty.' },
 { k: 'R', n: 'Respiration', d: 'Check breathing; seal any open chest wounds.' },
 { k: 'C', n: 'Circulation', d: 'Check for shock; reassess bleeding control.' },
 { k: 'H', n: 'Hypothermia / Head', d: 'Keep them warm; check for head injury.' }
];
