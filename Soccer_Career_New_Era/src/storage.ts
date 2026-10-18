import {expandWorld,migrateEconomy} from './world';
import {WORLD_CLUB_COUNT} from './leagues';
import {ensureDevelopment} from './development';
import {isKnownTrait,npcTraits,normalizeTraits,TRAIT_LIMIT} from './traits';
import {validScoutState,type ScoutState} from './scouting';
import {validEquipment} from './equipment';
import {emptyLegacy,recordRetirement,validLegacy,type Legacy} from './legacy';
import {ATTRS,type Attributes} from "./engine";
export const SAVE_VERSION=8;
const NEW_ATTRIBUTES={longShot:"shooting",finishing:"composure",curve:"shooting",longPassing:"passing",sliding:"defending",marking:"defending",anticipation:"decisions"} as const;
/** Recursively upgrade attribute snapshots, NPCs, live players, substitutes and insight bases. No RNG. */
function migrateV6(value:unknown){
 if(!value||typeof value!=="object")return;
 const v=value as Record<string,unknown>;
 if(typeof v.shooting==="number"&&typeof v.defending==="number"&&typeof v.passing==="number")for(const [k,old] of Object.entries(NEW_ATTRIBUTES))v[k]??=v[old];
 for(const child of Object.values(v))if(child&&typeof child==="object")migrateV6(child);
}
const traitsValid=(t:unknown)=>Array.isArray(t)&&t.length<=TRAIT_LIMIT&&t.every(x=>typeof x==='string');
/** v4 → v5: single trait → trait list (the existing trait is kept), NPC traits added deterministically. */
function migrateV4(c:Career){
  const d=c.development as unknown as {trait?:unknown,traits?:unknown,rival:{trait?:unknown,traits?:unknown}};
  d.traits=Array.isArray(d.traits)?normalizeTraits(d.traits):isKnownTrait(d.trait)?[d.trait]:[];delete d.trait;
  d.rival.traits=Array.isArray(d.rival.traits)?normalizeTraits(d.rival.traits):isKnownTrait(d.rival.trait)?[d.rival.trait]:[];delete d.rival.trait;
  for(const club of c.world.clubs)for(const p of club.roster)p.traits??=p.id===c.development.rival.id?[...(d.rival.traits as string[])]:npcTraits(c.world.seed,p.id);
  (c as {version:number}).version=5;
}
/**
 * v5 → v6 (0.5): a stable player id for the account-wide retirement record. It is derived from
 * data that never changes for a player, so every backup/archive copy of the same old save gets
 * the same id and can never be rewarded twice. Equipment and NPC injuries are optional fields.
 */
function migrateV5(c:Career){
  // Only values fixed at creation (RNG states such as c.seed change while playing, so they are not used).
  const p=c.player,r=c.development?.rival;
  c.id??=`legacy-${checksum([p.name,p.pos,p.secondary,p.foot,p.height,p.weight,p.style,p.curve,p.learning,c.school,c.schoolRef?.id??'',r?.player?.name??'',r?.school??'',c.growth?.[0]?.overall??''].join('|'))}`;
  (c as {version:number}).version=6;
}
import {newWorld} from "./world";
import type { Career } from "./career";
const DB = "soccer-career-new-era";
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("saves");
    req.onsuccess = () => res(req.result);
    req.onerror = () => {
      database = undefined;
      rej(req.error);
    };
  }));
}
async function get(key: string) {
  const d = await db();
  return new Promise<unknown>((res, rej) => {
    const r = d.transaction("saves").objectStore("saves").get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function checksum(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}
export function validate(raw: unknown): Career {
  if (!raw || typeof raw !== "object")
    throw Error("저장 파일 형식이 올바르지 않습니다.");
  const c = structuredClone(raw) as Career;
  if(c.story!==undefined){const s=c.story;
    if(!s||typeof s.intro!=='string'||!Number.isFinite(s.startAge)||!Number.isFinite(s.startOverall)||!Array.isArray(s.ageRecords)||s.ageRecords.some(r=>!r||!Number.isFinite(r.age)||!Number.isFinite(r.overall))
      ||(s.headline!==undefined&&typeof s.headline!=='string')||(s.quote!==undefined&&typeof s.quote!=='string')||(s.chapters!==undefined&&(!Array.isArray(s.chapters)||s.chapters.some(x=>typeof x!=='string'))))throw Error('선수 이야기 데이터가 손상되었습니다.');
  }
  if ((c as { version: number }).version === 1) {
    (c as {version:number}).version = 2;
    c.growth ??= [{ week: c.week, overall: 45 }];
    c.feed ??= [];
  }
  if ((c as {version:number}).version === 2) {(c as {version:number}).version=3;c.world=newWorld(c.seed,c.school,c.week);c.world.year=2026+Math.floor(c.week/52);}
  if((c as {version:number}).version===3){(c as {version:number}).version=4;ensureDevelopment(c);}
  if((c as {version:number}).version===4&&c.development&&c.world?.clubs)migrateV4(c);
  if((c as {version:number}).version===5)migrateV5(c);
  if((c as {version:number}).version===6){migrateV6(c);(c as {version:number}).version=7;}
  if((c as {version:number}).version===7){expandWorld(c.world);(c as {version:number}).version=8;}
  if (c.version !== SAVE_VERSION) throw Error("지원되지 않는 저장 버전입니다.");
  // 0.14 realistic money: re-price older saves once (budgets, running contract, open offers); keeps save version 8.
  if(c.world?.clubs&&c.player?.a&&c.world.economy!==2)migrateEconomy(c.world,c.player);
  if (
    !c.player ||
    typeof c.player.name !== "string" ||
    c.player.name.length > 30 ||
    !Number.isInteger(c.week) ||
    c.week < 0 ||
    !Number.isInteger(c.school) ||
    c.school < 0 ||
    c.school > 2 ||
    !Array.isArray(c.history) ||
    !Array.isArray(c.feed) ||
    !Array.isArray(c.growth)
  )
    throw Error("저장 데이터 구조가 손상되었습니다.");
  for (const v of Object.values(c.player.a))
    if (!Number.isFinite(v) || v < 0 || v > 100)
      throw Error("능력치 데이터가 손상되었습니다.");
  if (ATTRS.some(k=>!Number.isFinite(c.player.a[k])))
    throw Error("능력치가 누락되었습니다.");
  for (const n of [
    c.seed,
    c.day,
    c.trainingCount,
    c.player.energy,
    c.player.potential,
  ])
    if (!Number.isFinite(n)) throw Error("숫자 데이터가 손상되었습니다.");
  if (
    c.match &&
    (!Array.isArray(c.match.players) ||
      c.match.players.length !== 22 ||
      !c.match.ball ||
      !Number.isFinite(c.match.clock) ||
      c.match.userId < 0 ||
      c.match.userId > 21)
  )
    throw Error("경기 데이터가 손상되었습니다.");
  if(!c.world || !Array.isArray(c.world.clubs) || c.world.clubs.length!==WORLD_CLUB_COUNT || !c.world.clubs.some(club=>club.id===c.world.clubId) || !Array.isArray(c.world.fixtures) || !Array.isArray(c.world.tables))throw Error('축구 세계 저장이 손상되었습니다.');
  if(!c.development || c.development.plan.length!==7 || !traitsValid(c.development.traits) || !traitsValid(c.development.rival?.traits) || [c.development.experienceBank,c.development.rival?.experienceBank].some(v=>v!==undefined&&!(Number.isFinite(v)&&v>=0)) || c.world.clubs.some(club=>club.roster.some(p=>p.traits!==undefined&&!traitsValid(p.traits))) || !validEquipment(c.development.equipment) || (c.id!==undefined&&(typeof c.id!=='string'||!c.id||c.id.length>80)) || (c.schoolRef!==undefined&&(typeof c.schoolRef?.id!=='string'||typeof c.schoolRef?.name!=='string')) ||!Number.isFinite(c.development.wallet) || c.development.wallet<0 || !c.development.rival?.player)throw Error('육성 저장 데이터가 손상되었습니다.');
  // 0.9.1: the agent planning panel (target club / priority) was removed; drop stale choices so they no longer steer offers.
  if (c.world) { delete c.world.targetClubId; delete c.world.priority; }
  return c;
}
export function encode(c: Career) {
  const payload = JSON.stringify(validate(c));
  return JSON.stringify({
    format: "SCNE",
    checksum: checksum(payload),
    payload,
  });
}
export function decode(s: string) {
  if (s.length > 10_000_000) throw Error("파일이 너무 큽니다.");
  const envelope = JSON.parse(s);
  if (
    envelope.format !== "SCNE" ||
    typeof envelope.payload !== "string" ||
    checksum(envelope.payload) !== envelope.checksum
  )
    throw Error("저장 파일 검증 실패: 파일이 손상되었습니다.");
  return validate(JSON.parse(envelope.payload));
}
/** True when a stored slot value can be read back as a valid career. */
export function isRestorableSave(raw: unknown) {
  if (typeof raw !== "string") return false;
  try {
    decode(raw);
    return true;
  } catch {
    return false;
  }
}
let queue = Promise.resolve();
export function save(slot: number, c: Career): Promise<void> {
  const data = encode(c);
  const task = queue
    .catch(() => {})
    .then(async () => {
      const d = await db();
      const old = await get("slot" + slot);
      // Unchanged state: only record the active slot, so the backup keeps the
      // last *different* save instead of being overwritten by an identical copy.
      const unchanged = old === data;
      // Never replace a good backup with an unreadable slot.
      const rotate = !unchanged && isRestorableSave(old);
      await new Promise<void>((res, rej) => {
        const t = d.transaction("saves", "readwrite");
        const store = t.objectStore("saves");
        if (rotate) store.put(old, "backup" + slot);
        if (!unchanged) store.put(data, "slot" + slot);
        store.put(slot, "activeSlot");
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      });
    });
  queue = task;
  return task;
}
export async function load(slot: number, backup = false) {
  const raw = await get((backup ? "backup" : "slot") + slot);
  return raw ? decode(String(raw)) : null;
}
/** Short, display-only description of a career for slot pickers. */
export function summarize(c: Career) {
  const club = c.world.clubs.find((x) => x.id === c.world.clubId);
  return {
    name: c.player.name, age: c.player.age, pos: c.player.pos, team: club?.name ?? "", year: c.world.year, week: c.week,
    school: c.schoolRef?.name, traits: [...c.development.traits], retired: c.world.phase === "retired",
  };
}
export type SlotInfo = Awaited<ReturnType<typeof slots>>[number];
export async function slots() {
  return Promise.all(
    [1, 2, 3].map(async (slot) => {
      try {
        const c = await load(slot);
        return { slot, name: c?.player.name, week: c?.week, broken: false, summary: c ? summarize(c) : undefined, archived: await archiveName(slot) };
      } catch {
        return { slot, name: "손상된 저장", week: 0, broken: true, summary: undefined, archived: await archiveName(slot) };
      }
    }),
  );
}

export async function activeSlot() {
  const n = await get("activeSlot");
  return [1, 2, 3].includes(Number(n)) ? Number(n) : 1;
}

/** Scouting progress lives outside the career slots so it can never overwrite a career. */
export async function loadScouting(): Promise<ScoutState | null> {
  const v = await get("scouting");
  return validScoutState(v) ? v : null;
}
export function saveScouting(s: ScoutState): Promise<void> {
  const task = queue
    .catch(() => {})
    .then(async () => {
      const d = await db();
      await new Promise<void>((res, rej) => {
        const t = d.transaction("saves", "readwrite");
        t.objectStore("saves").put(s, "scouting");
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      });
    });
  queue = task;
  return task;
}

/**
 * Before a new player replaces an occupied slot, keep the old career under
 * `archive{n}`. Autosaves never touch it, so it survives until the next replacement.
 */
export async function archiveSlot(slot: number): Promise<boolean> {
  const old = await get("slot" + slot);
  if (!isRestorableSave(old)) return false;
  const task = queue
    .catch(() => {})
    .then(async () => {
      const d = await db();
      await new Promise<void>((res, rej) => {
        const t = d.transaction("saves", "readwrite");
        t.objectStore("saves").put(old, "archive" + slot);
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      });
    });
  queue = task;
  await task;
  return true;
}
export async function loadArchive(slot: number) {
  const raw = await get("archive" + slot);
  return raw ? decode(String(raw)) : null;
}
export async function archiveName(slot: number): Promise<string | undefined> {
  try { return (await loadArchive(slot))?.player.name; } catch { return undefined; }
}
/** Swaps slot n and its archived player in one transaction, so neither career is lost. */
export async function swapArchive(slot: number): Promise<void> {
  const task = queue
    .catch(() => {})
    .then(async () => {
      const d = await db();
      const current = await get("slot" + slot), archived = await get("archive" + slot);
      if (!isRestorableSave(archived)) throw Error("복원할 교체 전 선수가 없습니다.");
      await new Promise<void>((res, rej) => {
        const t = d.transaction("saves", "readwrite"), store = t.objectStore("saves");
        store.put(archived, "slot" + slot);
        if (isRestorableSave(current)) store.put(current, "archive" + slot); else store.delete("archive" + slot);
        store.put(slot, "activeSlot");
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      });
    });
  queue = task;
  return task;
}

/** Account-wide progress (retirement record) shared by all slots; never stored inside a career. */
export async function loadLegacy(): Promise<Legacy> {
  const v = await get("legacy");
  return validLegacy(v) ? v : emptyLegacy();
}
/**
 * Records a retired career in the shared progress, at most once per career id. Read and write
 * happen in one IndexedDB transaction, so two slots/tabs claiming at once cannot both be rewarded.
 */
export function claimRetirement(c: Career): Promise<{ legacy: Legacy; rewarded: boolean }> {
  const task = queue
    .catch(() => {})
    .then(async () => {
      const d = await db();
      return new Promise<{ legacy: Legacy; rewarded: boolean }>((res, rej) => {
        const t = d.transaction("saves", "readwrite"), store = t.objectStore("saves");
        let out = { legacy: emptyLegacy(), rewarded: false };
        const r = store.get("legacy");
        r.onsuccess = () => {
          out = recordRetirement(validLegacy(r.result) ? r.result : emptyLegacy(), c);
          if (out.rewarded) store.put(out.legacy, "legacy");
        };
        t.oncomplete = () => res(out);
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      });
    });
  queue = task.then(() => {});
  return task;
}
/**
 * Deletes the player in slot n (and that slot's automatic backup). The archived "교체 전 선수"
 * is a different player and is kept; the shared retirement record is never touched.
 */
export async function deleteSlot(slot: number, opts: { archive?: boolean } = {}): Promise<void> {
  if (![1, 2, 3].includes(slot)) throw Error("잘못된 슬롯입니다.");
  const task = queue
    .catch(() => {})
    .then(async () => {
      const d = await db();
      await new Promise<void>((res, rej) => {
        const t = d.transaction("saves", "readwrite"), store = t.objectStore("saves");
        store.delete("slot" + slot);
        store.delete("backup" + slot);
        if (opts.archive) store.delete("archive" + slot);
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      });
    });
  queue = task;
  return task;
}
