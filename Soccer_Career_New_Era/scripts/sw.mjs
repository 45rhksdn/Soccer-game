import { readdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const assets = readdirSync("dist/assets").map((x) => "./assets/" + x);
const version = createHash("sha256")
  .update(readFileSync("dist/index.html"))
  .digest("hex")
  .slice(0, 12);
writeFileSync(
  "dist/sw.js",
  `const CACHE='scne-${version}';const ASSETS=${JSON.stringify(["./", "./index.html", "./manifest.webmanifest", "./icon.png", "./icon-512.png", ...readdirSync("dist/fonts").map((x) => "./fonts/" + x), ...assets])};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('scne-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;e.respondWith(caches.match(e.request,{ignoreVary:true}).then(c=>c||fetch(e.request).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):Response.error())))});`,
);
