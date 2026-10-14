// Sync between devices through Firebase Realtime Database.
//
// Who can do what:
//   - The first device to open the app claims /meta/editor and can always edit (the "main phone").
//   - Any other device that enters the editor passcode is added to /editors/{id} and can edit too.
//   - Every other device asks to view (/requests/{id}); once an editor taps Allow it is added to
//     /viewers/{id} and sees everything read-only.
// The database rules (database.rules.json) enforce all of this on the server, including checking the
// passcode, which no device can read.
//
// Data layout (current rules):
//   /data/{section}     one JSON string per top-level section of the app data (items, cards, accounts, ...)
//   /data/_rev          time of the last change
// Splitting by section means two editors changing different things at once (say, a bill on the phone
// and net worth on the computer) both keep their changes. If both change the same section at the same
// moment, the later save wins.
//
// Older rules (before multiple editors) only allow /state = { json, rev } and a single editor.
// The app detects that and keeps working the old way until the new rules are published.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, get, set, update, remove, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const APP = window.APP;
const cfg = window.FIREBASE_CONFIG;

function deviceName() {
  const ua = navigator.userAgent;
  const kind = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? (/Mobile/.test(ua) ? "Android phone" : "Android tablet") : /Macintosh/.test(ua) ? ("ontouchend" in document ? "iPad" : "Mac") : /Windows/.test(ua) ? "Windows computer" : "Device";
  return kind + " (" + new Date().toLocaleDateString("en-CA", { month: "short", day: "numeric" }) + ")";
}
const denied = (e) => /permission[_ -]?denied/i.test(String((e && (e.code || e.message)) || e));

if (APP && cfg && cfg.apiKey && !/^PASTE/.test(cfg.apiKey)) start();

function start() {
  const app = initializeApp(cfg);
  const auth = getAuth(app);
  const db = getDatabase(app);
  let started = false;

  onValue(ref(db, ".info/connected"), (s) => APP.setConn(s.val() === true));

  onAuthStateChanged(auth, async (user) => {
    if (!user || started) return;
    started = true;
    const uid = user.uid;
    try {
      // The current rules let any signed-in device read /meta/hasCode; the older rules don't.
      let legacy = false;
      try { await get(ref(db, "meta/hasCode")); } catch (e) { if (denied(e)) legacy = true; else throw e; }

      let owner = (await get(ref(db, "meta/editor"))).val();
      if (!owner) {
        // First device ever: claim the main editor spot. The rules only allow this while it is empty,
        // so if two devices race, exactly one wins and the other reads the winner.
        try { await set(ref(db, "meta/editor"), uid); owner = uid; }
        catch (e) { owner = (await get(ref(db, "meta/editor"))).val(); }
      }
      let isEditor = owner === uid;
      if (!isEditor && !legacy) {
        try { isEditor = (await get(ref(db, "editors/" + uid))).exists(); } catch (e) { /* not an editor */ }
      }
      APP.setInfo({ legacy, uid, owner: owner === uid });
      if (isEditor) (legacy ? runLegacyEditor : runEditor)(db, uid);
      else runViewer(db, uid, legacy);
    } catch (e) {
      APP.setRole("error", friendly(e));
    }
  });

  signInAnonymously(auth).catch((e) => APP.setRole("error", friendly(e)));
}

// Approving viewers, removing devices and the passcode: available on every editing device.
function deviceTools(db, legacy) {
  window.cloudApprove = (id, name) => set(ref(db, "viewers/" + id), { name: name || "Device", at: Date.now() }).then(() => remove(ref(db, "requests/" + id))).catch(() => {});
  window.cloudDeny = (id) => remove(ref(db, "requests/" + id)).catch(() => {});
  window.cloudRemoveViewer = (id) => remove(ref(db, "viewers/" + id)).catch(() => {});
  onValue(ref(db, "requests"), (s) => APP.setDevices("requests", s.val()), () => {});
  onValue(ref(db, "viewers"), (s) => APP.setDevices("viewers", s.val()), () => {});
  if (legacy) return;
  window.cloudSetCode = (code) => set(ref(db, "secret/editorCode"), String(code)).then(() => set(ref(db, "meta/hasCode"), true)).then(() => true, () => false);
  window.cloudRemoveCode = () => remove(ref(db, "secret/editorCode")).then(() => set(ref(db, "meta/hasCode"), false)).catch(() => {});
  window.cloudRemoveEditor = (id) => remove(ref(db, "editors/" + id)).catch(() => {});
  onValue(ref(db, "editors"), (s) => APP.setDevices("editors", s.val()), () => {});
  onValue(ref(db, "meta/hasCode"), (s) => APP.setInfo({ hasCode: !!s.val() }), () => {});
}

const sections = (o) => { const r = {}; for (const k in o || {}) if (k !== "_rev" && typeof o[k] === "string") r[k] = o[k]; return r; };

async function runEditor(db, uid) {
  deviceTools(db, false);
  let last = {};                 // what the cloud holds for each section, as far as this device knows
  const push = () => {
    const local = APP.keys(), upd = {};
    let n = 0;
    for (const k in local) if (local[k] !== last[k]) { upd[k] = local[k]; last[k] = local[k]; n++; }
    if (!n) return;
    upd._rev = APP.localRev() || Date.now();
    update(ref(db, "data"), upd).catch((e) => { if (denied(e)) location.reload(); });   // editing was taken away: reopen as a viewer
  };
  window.cloudSave = push;

  try {
    const remote = (await get(ref(db, "data"))).val();
    if (!remote) {
      // First run on the new layout: bring over the data saved the old way, if it's newer than this device's copy.
      const st = (await get(ref(db, "state"))).val();
      if (st && st.json && (st.rev || 0) >= APP.localRev()) APP.setState(st.json);
      last = {};
      push();
    } else {
      const r = sections(remote);
      if (APP.hadCache() && APP.localRev() > (remote._rev || 0)) {
        last = r;                // this device has newer changes (made offline): send them up
      } else {
        for (const k in r) APP.put(k, r[k]);
        APP.refresh();
        last = r;
      }
      push();
    }
  } catch (e) {
    APP.setRole("error", friendly(e));
    return;
  }

  // Live changes from other editors. Sections this device has changed but not yet sent keep the local version.
  onValue(ref(db, "data"), (snap) => {
    const r = sections(snap.val()), local = APP.keys();
    let changed = false, dirty = false;
    for (const k in r) {
      if (r[k] === last[k]) continue;
      if (local[k] !== undefined && last[k] !== undefined && local[k] !== last[k]) { last[k] = r[k]; dirty = true; continue; }
      APP.put(k, r[k]); last[k] = r[k]; changed = true;
    }
    if (changed) APP.refresh();
    if (changed || dirty) push();
  }, () => {});

  APP.setRole("editor");
}

// Older rules: one editor writing the whole state to /state.
function runLegacyEditor(db, uid) {
  deviceTools(db, true);
  window.cloudSave = () => set(ref(db, "state"), { json: APP.cloudJSON(), rev: APP.localRev() || Date.now() }).catch(() => {});
  let first = true;
  onValue(ref(db, "state"), (snap) => {
    if (!first) return;
    first = false;
    const v = snap.val();
    if (v && v.json && (v.rev || 0) >= APP.localRev()) APP.setState(v.json);
    else window.cloudSave();
    APP.setRole("editor");
  }, (e) => APP.setRole("error", friendly(e)));
}

function runViewer(db, uid, legacy) {
  if (!legacy) {
    onValue(ref(db, "meta/hasCode"), (s) => APP.setInfo({ hasCode: !!s.val() }), () => {});
    window.cloudJoin = async (code) => {
      try {
        await set(ref(db, "editors/" + uid), { code: String(code), name: deviceName(), at: Date.now() });
      } catch (e) { return false; }
      await remove(ref(db, "requests/" + uid)).catch(() => {});
      await remove(ref(db, "viewers/" + uid)).catch(() => {});
      return true;
    };
  }
  let stop = null;
  onValue(ref(db, "viewers/" + uid), (s) => {
    if (s.exists()) {
      if (stop) return;
      if (legacy) {
        stop = onValue(ref(db, "state"), (snap) => { const v = snap.val(); if (v && v.json) APP.setState(v.json); APP.setRole("viewer"); }, () => {});
      } else {
        stop = onValue(ref(db, "data"), (snap) => {
          const r = sections(snap.val());
          if (Object.keys(r).length) { for (const k in r) APP.put(k, r[k]); APP.refresh(); APP.setRole("viewer"); }
          else get(ref(db, "state")).then((v) => { v = v.val(); if (v && v.json) APP.setState(v.json); }).catch(() => {}).finally(() => APP.setRole("viewer"));
        }, () => {});
      }
    } else {
      if (stop) { stop(); stop = null; }
      APP.setRole("pending");
      set(ref(db, "requests/" + uid), { name: deviceName(), at: Date.now() }).catch(() => {});
    }
  }, (e) => APP.setRole("error", friendly(e)));
}

function friendly(e) {
  const m = String((e && (e.code || e.message)) || e);
  if (/admin-restricted-operation|operation-not-allowed/.test(m)) return "Anonymous sign-in is turned off in Firebase. Turn it on under Authentication → Sign-in method → Anonymous.";
  if (denied(e)) return "Firebase refused access. Check that the database rules from database.rules.json are published.";
  if (/network/i.test(m)) return "No internet connection. Connect and try again.";
  return "Firebase error: " + m;
}
