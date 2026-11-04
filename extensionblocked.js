// extensionblocked.js — explains why a browser extension was turned off (or, in
// Firefox without policy install, couldn't be) and lets the person ask for it.
// Opened by the background only; this page is not web-accessible.
(async () => {
  const $ = id => document.getElementById(id);
  const id = new URLSearchParams(location.search).get("id") || "";
  const { helperName = "", helperPhone = "", supportServer = null } =
    await chrome.storage.local.get(["helperName", "helperPhone", "supportServer"]);

  const who = helperName || "your helper";
  const Who = who[0].toUpperCase() + who.slice(1);
  const team = supportServer && supportServer.status === "connected" ? supportServer : null;
  const teamName = team?.orgName || "your support team";
  const asker = team ? (team.orgName || "my support team") : (helperName || "my helper");

  if (helperName || helperPhone) {
    $("helperBox").hidden = false;
    $("helperName").textContent = helperName || "your helper";
    if (helperPhone) {
      $("helperPhone").textContent = helperPhone;
      $("helperPhone").href = `tel:${helperPhone.replace(/[^\d+]/g, "")}`;
    } else {
      $("helperPhoneWrap").hidden = true;
    }
  }

  let shown = false;
  async function render() {
    const r = await chrome.runtime.sendMessage({ type: "checkExtension", id }).catch(() => null);
    if (!r?.ok) {
      $("reason").textContent = "The details of this extension are no longer available.";
      document.querySelector(".file-box").hidden = true;
      $("requestBtn").hidden = true;
      return;
    }
    const e = r.extension;
    $("extName").textContent = e.name;
    $("extSource").textContent = e.source || "Unknown";
    $("extVersion").textContent = e.version || "";
    $("extId").textContent = e.id;
    $("extPerms").replaceChildren(...(r.perms.length ? r.perms : [{ text: "Nothing special", level: "info" }]).map(p => {
      const li = document.createElement("li");
      li.className = `perm ${p.level}`;
      li.textContent = p.text;
      return li;
    }));

    if (r.decision === "allow" || r.decision === "policy") {
      document.querySelector(".block-card").classList.add("allowed");
      $("title").textContent = "This extension is now allowed";
      $("reason").className = "allowed-note";
      $("reason").textContent = r.enabled ? "It's switched on again." : "It can be switched on again.";
      $("warning").hidden = true;
      $("requestBtn").hidden = true;
      $("removeBtn").hidden = true;
      $("helperBox").hidden = true;
      $("requestStatus").textContent = "";
      return;
    }
    if (r.decision === "removed") {
      $("title").textContent = "This extension was removed";
      $("reason").textContent = "It's no longer in the browser.";
      $("requestBtn").hidden = true;
      $("removeBtn").hidden = true;
      return;
    }

    const stillOn = r.installed && r.enabled;
    $("title").textContent = stillOn ? "This extension isn't allowed" : "This extension was turned off";
    $("reason").textContent = r.decision === "deny"
      ? "It's on the always-blocked list."
      : "It isn't on your list of allowed extensions.";

    const danger = r.flags.filter(f => f.level === "danger");
    const warnings = [];
    if (r.decision === "deny") {
      warnings.push("Extensions like this one are used by scammers to take over the browser. If someone on the phone or in a pop-up told you to install it, it is a scam: hang up.");
    } else if (danger.length) {
      warnings.push(...danger.map(f => f.text));
    }
    if (stillOn) {
      warnings.push(chrome.management?.uninstall
        ? "This browser doesn't let Grandma's Guardian turn it off. Remove it below unless " + who + " says it's needed."
        : "This browser doesn't let Grandma's Guardian turn it off. Unless " + who + " says it's needed, remove it: menu ☰ → Add-ons and themes → find it → ⋯ → Remove.");
    }
    $("warning").hidden = !warnings.length;
    $("warning").textContent = warnings.join(" ");

    // Removing is always the person's choice; the browser asks to confirm.
    $("removeBtn").hidden = !r.installed || !chrome.management?.uninstall;

    if (r.decision === "deny" && !team) {
      $("requestBtn").hidden = true;
    } else {
      $("requestBtn").textContent = r.decision === "deny" ? `Ask ${asker} to review this extension` : `Ask ${asker} to allow this extension`;
    }
    const d = r.teamDecision;
    if (d && d.status === "denied") {
      $("requestBtn").hidden = true;
      $("requestStatus").textContent = `${teamName} said no` + (d.note ? `: “${d.note}”` : ".");
    } else if ((r.pending || r.teamPending) && !shown) {
      $("requestBtn").disabled = true;
      $("requestStatus").textContent = `Waiting for ${team ? teamName : who} to approve this.`;
    }
    shown = true;
  }

  $("requestBtn").addEventListener("click", async () => {
    $("requestBtn").disabled = true;
    const res = await chrome.runtime.sendMessage({ type: "requestExtension", id });
    if (res?.ok && res.nowAllowed) { render(); return; }
    $("requestStatus").textContent = !res?.ok
      ? (res?.error || "Sorry, that request couldn't be saved.")
      : res.sentToTeam
        ? `Request sent to ${res.teamName || teamName}. Leave this page open: it will tell you when they answer.`
        : team
          ? "Request saved. It will be sent to your support team as soon as the computer can reach them."
          : res.alreadyRequested
            ? `This has already been requested. ${Who} can approve it in Grandma's Guardian.`
            : `Request saved. ${Who} can approve it in Grandma's Guardian.`;
    if (!res?.ok) $("requestBtn").disabled = false;
  });

  $("removeBtn").addEventListener("click", async () => {
    try {
      await chrome.management.uninstall(id, { showConfirmDialog: true });
      $("requestStatus").textContent = "Removed.";
      render();
    } catch {
      $("requestStatus").textContent = "It wasn't removed.";
    }
  });

  $("closeBtn").addEventListener("click", async () => {
    const tab = await chrome.tabs.getCurrent();
    if (tab) chrome.tabs.remove(tab.id);
    else window.close();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.allowedExtensions || changes.serverExtAllow || changes.serverDecisions || changes.serverPending ||
      changes.extensionLog || changes.pendingExtRequests)) render();
  });
  render();
})();
