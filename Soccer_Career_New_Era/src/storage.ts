import {ensureDevelopment} from './development';
import {isKnownTrait,npcTraits,normalizeTraits,TRAIT_LIMIT} from './traits';
export const SAVE_VERSION=5;
const traitsValid=(t:unknown)=>Array.isArray(t)&&t.length<=TRAIT_LIMIT&&t.every(x=>typeof x==='string');
/** v4 → v5: single trait → trait list (the existing trait is kept), NPC traits added deterministically. */
function migrateV4(c:Career){
  const d=c.development as unknown as {trait?:unknown,traits?:unknown,rival:{trait?:unknown,traits?:unknown}};
  d.traits=Array.isArray(d.traits)?normalizeTraits(d.traits):isKnownTrait(d.trait)?[d.trait]:[];delete d.trait;
  d.rival.traits=Array.isArray(d.rival.traits)?normalizeTraits(d.rival.traits):isKnownTrait(d.rival.trait)?[d.rival.trait]:[];delete d.rival.trait;
  for(const club of c.world.clubs)for(const p of club.roster)p.traits??=p.id===c.development.rival.id?[...(d.rival.traits as string[])]:npcTraits(c.world.seed,p.id);
  (c as {version:number}).version=5;
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
  if ((c as { version: number }).version === 1) {
    (c as {version:number}).version = 2;
    c.growth ??= [{ week: c.week, overall: 45 }];
    c.feed ??= [];
  }
  if ((c as {version:number}).version === 2) {(c as {version:number}).version=3;c.world=newWorld(c.seed,c.school,c.week);c.world.year=2026+Math.floor(c.week/52);}
  if((c as {version:number}).version===3){(c as {version:number}).version=4;ensureDevelopment(c);}
  if((c as {version:number}).version===4&&c.development&&c.world?.clubs)migrateV4(c);
  if (c.version !== SAVE_VERSION) throw Error("지원되지 않는 저장 버전입니다.");
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
  if (Object.keys(c.player.a).length !== 13)
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
  if(!c.world || !Array.isArray(c.world.clubs) || c.world.clubs.length!==24 || !c.world.clubs.some(club=>club.id===c.world.clubId) || !Array.isArray(c.world.fixtures) || !Array.isArray(c.world.tables))throw Error('축구 세계 저장이 손상되었습니다.');
  if(!c.development || c.development.plan.length!==7 || !traitsValid(c.development.traits) || !traitsValid(c.development.rival?.traits) || c.world.clubs.some(club=>club.roster.some(p=>p.traits!==undefined&&!traitsValid(p.traits))) || (c.schoolRef!==undefined&&(typeof c.schoolRef?.id!=='string'||typeof c.schoolRef?.name!=='string')) ||!Number.isFinite(c.development.wallet) || c.development.wallet<0 || !c.development.rival?.player)throw Error('육성 저장 데이터가 손상되었습니다.');
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
export async function slots() {
  return Promise.all(
    [1, 2, 3].map(async (slot) => {
      try {
        const c = await load(slot);
        return { slot, name: c?.player.name, week: c?.week, broken: false };
      } catch {
        return { slot, name: "손상된 저장", week: 0, broken: true };
      }
    }),
  );
}

export async function activeSlot() {
  const n = await get("activeSlot");
  return [1, 2, 3].includes(Number(n)) ? Number(n) : 1;
}
