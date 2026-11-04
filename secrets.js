// secrets.js — values that must not sit in chrome.storage.local, which content scripts
// (running in web pages' processes) can read. They're kept in the extension's own
// IndexedDB instead, which web pages and content scripts can't reach.
// Extension storage isn't encrypted, so this limits exposure; it doesn't protect a
// secret from someone who controls the computer.
const DB_NAME = "gg-secrets";
const STORE = "secrets";

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no IndexedDB"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function op(mode, fn) {
  const db = await open();
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

export const secretGet = key => op("readonly", s => s.get(key));
export const secretSet = (key, value) => op("readwrite", s => (value ? s.put(value, key) : s.delete(key)));
