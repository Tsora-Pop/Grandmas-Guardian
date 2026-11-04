// support.js — connection to a Guardian Support server (optional).
// The computer gets its own signing key (ECDSA P-256). The private key is created
// non-extractable and kept in IndexedDB: it can sign, but can't be read or copied out.
// Every call to the server is signed, so a leaked device ID is useless on its own.

import { CONSENT_ERROR, SUPPORT_DATA, hasDataConsent } from "./platform.js";

const DB_NAME = "gg-support";
const STORE = "keys";

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbOp(mode, fn) {
  const db = await idb();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const r = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(r?.result);
      t.onerror = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}
const keyGet = () => idbOp("readonly", s => s.get("device"));
const keyPut = v => idbOp("readwrite", s => s.put(v, "device"));
const keyDelete = () => idbOp("readwrite", s => s.delete("device"));

/** Server address: https only, except this computer itself (for testing). */
export function normalizeServerUrl(input) {
  let u;
  try {
    u = new URL(String(input || "").trim().replace(/\/+$/, ""));
  } catch {
    return null;
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null;
  if (u.username || u.password) return null;
  return `${u.protocol}//${u.host}`;
}

async function sha256Hex(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function b64url(buf) {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function nonce() {
  return b64url(crypto.getRandomValues(new Uint8Array(18)));
}

async function timedFetch(url, opts, ms = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, credentials: "omit", cache: "no-store", redirect: "error" });
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(res) {
  try { return await res.json(); } catch { return null; }
}

/** Enroll this computer with a one-time connection code. */
export async function enroll({ serverUrl, code, name, personName, version, account }) {
  const base = normalizeServerUrl(serverUrl);
  if (!base) return { ok: false, error: "Enter the server address, starting with https://" };
  if (!(await hasDataConsent(SUPPORT_DATA))) return { ok: false, error: CONSENT_ERROR };
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  let res;
  try {
    res = await timedFetch(`${base}/api/device/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, publicKey: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }, name, personName, version, account })
    });
  } catch {
    return { ok: false, error: "Couldn't reach that server. Check the address and the internet connection." };
  }
  const json = await readJson(res);
  if (!res.ok || !json?.ok) return { ok: false, error: json?.error || `The server answered ${res.status}.` };
  await keyPut({ privateKey: keys.privateKey, deviceId: json.deviceId, server: base });
  return { ok: true, server: base, deviceId: json.deviceId, orgName: json.orgName, serverName: json.serverName };
}

/** Make a signed call. Returns { ok, status, json } (never throws for HTTP errors). */
export async function signedCall(method, path, body, version) {
  const k = await keyGet();
  if (!k?.privateKey) return { ok: false, status: 0, json: { error: "Not connected." } };
  if (!(await hasDataConsent(SUPPORT_DATA))) return { ok: false, status: 0, json: { error: CONSENT_ERROR } };
  const raw = body === undefined ? "" : JSON.stringify(body);
  const t = Date.now();
  const n = nonce();
  const data = `GG1\n${method}\n${path}\n${t}\n${n}\n${await sha256Hex(raw)}`;
  const sig = b64url(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k.privateKey, new TextEncoder().encode(data)));
  let res;
  try {
    res = await timedFetch(`${k.server}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        "X-GG-Device": k.deviceId, "X-GG-Time": String(t), "X-GG-Nonce": n, "X-GG-Signature": sig, "X-GG-Version": version || ""
      },
      body: body === undefined ? undefined : raw
    });
  } catch {
    return { ok: false, status: 0, json: { error: "Couldn't reach the support server." } };
  }
  const json = await readJson(res);
  return { ok: res.ok && json?.ok !== false, status: res.status, json };
}

export async function forgetKey() {
  try { await keyDelete(); } catch {}
}

export async function hasKey() {
  try { return !!(await keyGet())?.privateKey; } catch { return false; }
}
