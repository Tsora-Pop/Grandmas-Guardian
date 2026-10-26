// content.js — hides blocks of text that contain scam phrases.
// Runs at document_start in every frame. It never removes or replaces page
// elements: it marks them hidden and puts a small notice in front of them, so
// pages built with React/Angular/etc. keep working and "Show anyway" restores
// the original element exactly as it was.
(() => {
  if (window.__grandmasGuardian) return;
  window.__grandmasGuardian = true;

  const HIDDEN = "data-gg-hidden";
  const REVEALED = "data-gg-revealed";
  const BANNER_TAG = "gg-notice";
  const SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TEXTAREA", "INPUT", "SELECT",
    "OPTION", "CODE", "PRE", "SVG", "MATH", "CANVAS", "IFRAME", "OBJECT",
    "HEAD", "TITLE", "META", "LINK", BANNER_TAG.toUpperCase()
  ]);
  const NEVER_HIDE = new Set(["HTML", "BODY", "MAIN", "HEAD"]);
  const BLOCK_DISPLAYS = new Set(["block", "flex", "grid", "table", "list-item", "table-row", "flow-root"]);
  // Inline tags scammers use to split a phrase into pieces ("gi<b>ft</b> cards").
  const INLINE_TAGS = new Set([
    "A", "SPAN", "B", "I", "EM", "STRONG", "U", "S", "FONT", "MARK", "SMALL", "SUB", "SUP",
    "BIG", "ABBR", "CITE", "Q", "BDI", "BDO", "DEL", "INS", "TIME", "DATA", "TT", "WBR", "LABEL"
  ]);
  const MAX_HIDE_TEXT = 2500;   // don't hide containers bigger than this many characters
  const MAX_JOINED_TEXT = 600;  // largest container whose joined text is checked
  const BATCH_LIMIT = 4000;     // text nodes per slice before yielding to the page

  let matcher = null;
  let enabled = false;
  const observers = new Map(); // root -> MutationObserver
  const hiddenTerm = new WeakMap(); // hidden element -> matched phrase
  let pending = [];
  let flushScheduled = false;

  // ---------------------------------------------------------------------------
  // De-obfuscation: undo the common tricks used to slip past word filters
  // ---------------------------------------------------------------------------
  // Invisible characters inserted between letters (zero-width space, soft hyphen, …)
  const INVISIBLE = /[­͏؜ᅟᅠ឴឵᠋-᠏​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ]/g;
  const NON_ASCII = /[^\x00-\x7F]/;
  // Letters from other alphabets that look like Latin ones ("Мiсrоsоft" with Cyrillic М, с, о).
  const LOOKALIKE_PAIRS =
    "аaвbеeёeкkмmнhоoпnрpсcтtуyхxѕsіiїiјjһhԁdԛqԝwӏlүyɡgɑaıiАaВbЕeКkМmНhОoРpСcТtХxУyЅsІiЈj" +
    "αaβbεeιiκkνvοoρpτtυuχxωwΑaΒbΕeΖzΗhΙiΚkΜmΝnΟoΡpΤtΥyΧx";
  const LOOKALIKE = {};
  for (let i = 0; i < LOOKALIKE_PAIRS.length; i += 2) LOOKALIKE[LOOKALIKE_PAIRS[i]] = LOOKALIKE_PAIRS[i + 1];
  const LOOKALIKE_RE = new RegExp(`[${Object.keys(LOOKALIKE).join("")}]`, "g");
  // Letters spaced or dotted out: "g i f t   c a r d", "G.I.F.T", "g-i-f-t"
  const SPACED = /(?<![\p{L}\p{N}])(?:[\p{L}\p{N}$@!|+][ .\-_*·•~ ]{1,3}){2,}[\p{L}\p{N}$@!|+](?![\p{L}\p{N}])/gu;
  const SPACED_SEP = /[ .\-_*·•~ ]+/g;
  // Number/symbol swaps: "g1ft c4rd", "B1tc0in", "$end"
  const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", 8: "b", 9: "g", "@": "a", $: "s", "!": "i", "|": "i", "+": "t" };
  const LEET_CHARS = /[0-9@$!|+]/g;
  const LEET_HINT = /[a-z][0-9@$!|+]|[0-9@$!|+][a-z]/i;

  function deobfuscate(text) {
    let t = text;
    if (NON_ASCII.test(t)) {
      // NFKD turns fullwidth, bold/italic "math" letters and ligatures into plain
      // letters; removing combining marks undoes accents and "Zalgo" text.
      t = t.normalize("NFKD").replace(/\p{M}+/gu, "").replace(INVISIBLE, "");
      if (NON_ASCII.test(t)) t = t.replace(LOOKALIKE_RE, c => LOOKALIKE[c]);
    }
    return t.replace(SPACED, m => m.replace(SPACED_SEP, ""));
  }

  // ---------------------------------------------------------------------------
  // Matching: one combined pattern built as a prefix tree, so the browser
  // checks each position once instead of once per phrase.
  // ---------------------------------------------------------------------------
  const B = "[\\p{L}\\p{N}_]";
  const WORD_SEP = "[\\s\\-_*~·•]*"; // zero or more: "gift card", "giftcard", "gift-card"

  function termUnits(term) {
    const units = [];
    for (const ch of term) {
      if (ch === " ") units.push(WORD_SEP);
      else if (ch === "'") units.push("['‘’ʼ`´]?");
      else if (ch === '"') units.push("[\"“”]?");
      else if (ch === "-") units.push("[\\s\\-‐-―_]*");
      else if (/[\\^$.*+?()[\]{}|/]/.test(ch)) units.push(`\\${ch}`);
      else units.push(ch);
    }
    // collapse repeated separators produced by "- " etc.
    return units.filter((u, i) => !(u === WORD_SEP && units[i - 1] === WORD_SEP));
  }

  function trieToPattern(node) {
    const alts = Object.keys(node.c).map(k => k + trieToPattern(node.c[k]));
    if (!alts.length) return "";
    const group = alts.length === 1 ? alts[0] : `(?:${alts.join("|")})`;
    return node.end ? `(?:${group})?` : group;
  }

  function compile(list) {
    if (!list.length) return null;
    const units = list.map(termUnits);
    const root = { c: {} };
    for (const u of units) {
      let n = root;
      for (const x of u) n = n.c[x] || (n.c[x] = { c: {} });
      n.end = true;
    }
    const re = new RegExp(`(?<!${B})(?:${trieToPattern(root)})(?!${B})`, "iu");
    const single = [];
    return {
      re,
      // Which phrase matched? Only runs on a hit, which is rare.
      which(s) {
        for (let i = 0; i < units.length; i++) {
          single[i] = single[i] || new RegExp(`^(?:${units[i].join("")})$`, "iu");
          if (single[i].test(s)) return list[i];
        }
        return s;
      }
    };
  }

  function buildMatcher(terms) {
    const list = [...new Set((terms || []).filter(t => typeof t === "string" && t.length >= 3))];
    if (!list.length) return null;
    const plain = compile(list);
    // Phrases without digits/symbols are also checked against a copy of the text
    // where numbers and symbols are turned back into letters.
    const leet = compile(list.filter(t => !/[0-9@$!|+]/.test(t)));
    return {
      find(text) {
        const t = deobfuscate(text);
        let m = plain.re.exec(t);
        if (m) return plain.which(m[0]);
        if (leet && LEET_HINT.test(t)) {
          m = leet.re.exec(t.replace(LEET_CHARS, c => LEET[c]));
          if (m) return leet.which(m[0]);
        }
        return null;
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Logging (sent to the background in small batches)
  // ---------------------------------------------------------------------------
  let logQueue = [];
  let logTimer = null;
  function excerptOf(el) {
    return (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200);
  }
  function send(msg) {
    try {
      chrome.runtime.sendMessage(msg).catch(() => {});
    } catch {
      // extension was updated or removed; nothing to do
    }
  }
  function logHidden(term, el) {
    logQueue.push({ term, excerpt: excerptOf(el) });
    if (logTimer) return;
    logTimer = setTimeout(() => {
      logTimer = null;
      const items = logQueue.splice(0, 50);
      logQueue = [];
      if (items.length) send({ type: "scamHidden", items });
    }, 1500);
  }

  // ---------------------------------------------------------------------------
  // Hiding
  // ---------------------------------------------------------------------------
  const styledRoots = new WeakSet();
  function injectStyle(root) {
    // root is the document or a shadow root; each needs its own copy of the rule.
    if (styledRoots.has(root)) return;
    const style = document.createElement("style");
    style.textContent = `[${HIDDEN}]{display:none !important}`;
    if (root instanceof ShadowRoot) root.appendChild(style);
    else (document.head || document.documentElement).appendChild(style);
    styledRoots.add(root);
  }

  function isBlock(el) {
    try {
      return BLOCK_DISPLAYS.has(getComputedStyle(el).display);
    } catch {
      return false;
    }
  }

  // Find a sensible element to hide for a matching text node: the nearest
  // block-level ancestor, but never the page itself and never something huge.
  function pickTarget(textNode) {
    const parent = textNode.parentElement;
    if (!parent) return null;
    let el = parent;
    while (el && !NEVER_HIDE.has(el.tagName) && !isBlock(el)) {
      if (!el.parentElement || NEVER_HIDE.has(el.parentElement.tagName)) break;
      el = el.parentElement;
    }
    if (!el || NEVER_HIDE.has(el.tagName) || (el.textContent || "").length > MAX_HIDE_TEXT) {
      el = NEVER_HIDE.has(parent.tagName) ? null : parent;
    }
    if (!el || (el.textContent || "").length > MAX_HIDE_TEXT) {
      // Text sits directly in <body> or in a very large element: wrap just this text.
      const span = document.createElement("span");
      textNode.replaceWith(span);
      span.appendChild(textNode);
      el = span;
    }
    return el;
  }

  function makeNotice(target) {
    const host = document.createElement(BANNER_TAG);
    host.style.cssText = "display:block !important;margin:4px 0 !important;";
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>
        .box{font:14px/1.4 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;background:#fff4e5;
             color:#663c00;border:1px solid #f0b46c;border-radius:8px;padding:6px 10px;
             display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        button{font:inherit;font-size:13px;border:1px solid #c77700;background:#fff;color:#663c00;
               border-radius:6px;padding:2px 10px;cursor:pointer}
        button:focus-visible{outline:2px solid #1565c0;outline-offset:2px}
      </style>
      <div class="box" role="note">
        <span>🛡️ Hidden by Grandma's Guardian: this may be a scam.</span>
        <button type="button">Show anyway</button>
      </div>`;
    shadow.querySelector("button").addEventListener("click", e => {
      if (!e.isTrusted) return; // only a real click by the person counts
      target.removeAttribute(HIDDEN);
      target.setAttribute(REVEALED, "");
      host.remove();
      send({ type: "scamRevealed", term: hiddenTerm.get(target) || "", excerpt: excerptOf(target) });
    });
    return host;
  }

  function hideElement(target, term) {
    if (!target || target.hasAttribute(HIDDEN) || target.closest(`[${REVEALED}]`)) return;
    injectStyle(target.getRootNode());
    target.setAttribute(HIDDEN, "");
    hiddenTerm.set(target, term);
    target.before(makeNotice(target));
    logHidden(term, target);
  }

  // ---------------------------------------------------------------------------
  // Scanning
  // ---------------------------------------------------------------------------
  const walkerFilter = {
    acceptNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.data.length >= 1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
      if (SKIP_TAGS.has(node.tagName) || node.hasAttribute(HIDDEN) || node.hasAttribute(REVEALED) ||
          node.isContentEditable) {
        return NodeFilter.FILTER_REJECT; // skip the whole subtree
      }
      if (node.shadowRoot) watchRoot(node.shadowRoot);
      return NodeFilter.FILTER_SKIP;
    }
  };

  function isInsideSkipped(node) {
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!el) return false;
    return !!el.closest(`[${HIDDEN}],[${REVEALED}],${BANNER_TAG},script,style,noscript,textarea,template,[contenteditable=""],[contenteditable="true"]`);
  }

  function collectText(root, out) {
    if (root.nodeType === Node.TEXT_NODE) {
      if (root.data.length >= 1) out.push(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE &&
        root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE && walkerFilter.acceptNode(root) === NodeFilter.FILTER_REJECT) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, walkerFilter);
    let n;
    while ((n = walker.nextNode())) out.push(n);
  }

  // The element that holds a run of inline text: a phrase split across <span>s
  // or <b>s is only visible when the pieces are read together.
  function joinedContainer(textNode) {
    let el = textNode.parentElement;
    let split = false;
    while (el && INLINE_TAGS.has(el.tagName)) { split = true; el = el.parentElement; }
    if (!el || NEVER_HIDE.has(el.tagName) || SKIP_TAGS.has(el.tagName)) return null;
    if (!split && el.childNodes.length < 2) return null; // nothing to join
    return el;
  }

  // Scammers also hide junk letters inside a phrase ("gi<span style=display:none>x</span>ft").
  const HIDDEN_JUNK = '[hidden],[aria-hidden="true"],[style*="none"],[style*="font-size:0"],[style*="font-size: 0"],[style*="opacity:0"],[style*="opacity: 0"],[style*="visibility"]';
  function readableText(el) {
    if (el.querySelector(HIDDEN_JUNK)) {
      try { return el.innerText; } catch { /* fall through */ }
    }
    return el.textContent || "";
  }

  function processNodes(nodes) {
    if (!matcher) return;
    const texts = [];
    for (const node of nodes) {
      if (!node.isConnected || isInsideSkipped(node)) continue;
      collectText(node, texts);
    }
    const containers = new Set();
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      if (i === BATCH_LIMIT) {
        // Very large insert: finish the rest shortly so the page stays responsive.
        queue(texts.slice(i));
        break;
      }
      if (!t.isConnected || isInsideSkipped(t)) continue;
      const term = t.data.length >= 3 ? matcher.find(t.data) : null;
      if (term) {
        hideElement(pickTarget(t), term);
      } else {
        const c = joinedContainer(t);
        if (c) containers.add(c);
      }
    }
    for (const c of containers) {
      if (!c.isConnected || isInsideSkipped(c)) continue;
      const text = c.textContent || "";
      if (text.length < 3 || text.length > MAX_JOINED_TEXT) continue;
      const term = matcher.find(readableText(c));
      if (term) hideElement(c, term);
    }
  }

  function queue(nodes) {
    pending.push(...nodes);
    if (flushScheduled) return;
    flushScheduled = true;
    setTimeout(() => {
      flushScheduled = false;
      const batch = pending;
      pending = [];
      processNodes(batch);
    }, 50);
  }

  function onMutations(mutations) {
    if (!enabled) return;
    const nodes = [];
    for (const m of mutations) {
      if (m.type === "characterData") nodes.push(m.target);
      else for (const n of m.addedNodes) nodes.push(n);
    }
    // Handle new content right away (mutation callbacks run before the next
    // paint), so hidden text doesn't flash on screen first.
    if (nodes.length) processNodes(nodes);
  }

  function watchRoot(root) {
    if (observers.has(root)) return;
    const obs = new MutationObserver(onMutations);
    obs.observe(root, { childList: true, subtree: true, characterData: true });
    observers.set(root, obs);
    if (root !== document) queue([root]);
  }

  // ---------------------------------------------------------------------------
  // Start / stop
  // ---------------------------------------------------------------------------
  function stop() {
    enabled = false;
    for (const obs of observers.values()) obs.disconnect();
    observers.clear();
    pending = [];
    document.querySelectorAll(BANNER_TAG).forEach(n => n.remove());
    document.querySelectorAll(`[${HIDDEN}]`).forEach(n => n.removeAttribute(HIDDEN));
  }

  // After loading: (1) attach to shadow roots that were added without a mutation
  // being reported, (2) un-hide anything that was hidden while small and then
  // grew into a large section, and re-check it so only the smaller part is hidden.
  function afterLoad() {
    if (!enabled) return;
    const all = document.getElementsByTagName("*");
    for (let i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) watchRoot(all[i].shadowRoot);
    }
    const tooBig = [];
    document.querySelectorAll(`[${HIDDEN}]`).forEach(el => {
      if ((el.textContent || "").length > MAX_HIDE_TEXT * 2) tooBig.push(el);
    });
    for (const el of tooBig) {
      const notice = el.previousElementSibling;
      if (notice && notice.tagName === BANNER_TAG.toUpperCase()) notice.remove();
      el.removeAttribute(HIDDEN);
    }
    if (tooBig.length) processNodes(tooBig);
  }

  function start(terms) {
    matcher = buildMatcher(terms);
    if (!matcher) return;
    enabled = true;
    watchRoot(document);
    if (document.documentElement) processNodes([document.documentElement]);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", afterLoad, { once: true });
    }
    window.addEventListener("load", afterLoad, { once: true });
  }

  async function init() {
    let data;
    try {
      data = await chrome.storage.local.get(["filteringEnabled", "effectiveScamTerms"]);
    } catch {
      return; // extension was reloaded or removed
    }
    stop();
    if (data.filteringEnabled !== false) start(data.effectiveScamTerms);
  }

  init();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.effectiveScamTerms || changes.filteringEnabled)) init();
  });
})();
