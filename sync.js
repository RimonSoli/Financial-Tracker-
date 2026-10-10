// Sync between phones through Firebase Realtime Database.
//
// Roles, decided once per phone:
//   - The first phone to open the app claims /meta/editor and becomes the EDITOR.
//   - Every later phone writes a request to /requests/{id}. When the editor taps Allow,
//     it is added to /viewers/{id} and becomes a read-only VIEWER.
// Only the editor ever writes /state, so there is nothing to merge between phones.
// The database rules (database.rules.json) enforce all of this on the server.
//
// Data layout:
//   /meta/editor        uid of the editor phone
//   /state              { json: "<whole app data as a JSON string>", rev: <ms timestamp> }
//   /requests/{uid}     { name, at }   phones asking to view
//   /viewers/{uid}      { name, at }   phones allowed to view

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, get, set, remove, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const APP = window.APP;
const cfg = window.FIREBASE_CONFIG;

function deviceName() {
  const ua = navigator.userAgent;
  const kind = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android phone" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows computer" : "Device";
  return kind + " (" + new Date().toLocaleDateString("en-CA", { month: "short", day: "numeric" }) + ")";
}

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
      let editor = (await get(ref(db, "meta/editor"))).val();
      if (!editor) {
        // First phone ever: try to claim the editor role. The rules only allow this while it is empty,
        // so if two phones race, exactly one wins and the other reads the winner.
        try { await set(ref(db, "meta/editor"), uid); editor = uid; }
        catch (e) { editor = (await get(ref(db, "meta/editor"))).val(); }
      }
      if (editor === uid) runEditor(db, uid); else runViewer(db, uid);
    } catch (e) {
      APP.setRole("error", friendly(e));
    }
  });

  signInAnonymously(auth).catch((e) => APP.setRole("error", friendly(e)));
}

function runEditor(db, uid) {
  window.cloudSave = (json, rev) => set(ref(db, "state"), { json, rev: rev || Date.now() }).catch(() => {});
  window.cloudApprove = (id, name) => set(ref(db, "viewers/" + id), { name: name || "Phone", at: Date.now() }).then(() => remove(ref(db, "requests/" + id))).catch(() => {});
  window.cloudDeny = (id) => remove(ref(db, "requests/" + id)).catch(() => {});
  window.cloudRemoveViewer = (id) => remove(ref(db, "viewers/" + id)).catch(() => {});

  let first = true;
  onValue(ref(db, "state"), (snap) => {
    if (!first) return;            // the editor is the only writer, so after start-up it never needs to pull
    first = false;
    const v = snap.val();
    const localRev = APP.localRev();
    if (v && v.json && (v.rev || 0) >= localRev) {
      APP.setState(v.json);        // the cloud copy is newer (or this phone has no data yet)
    } else {
      window.cloudSave(APP.cloudJSON(), localRev || Date.now());   // push this phone's newer or first data up
    }
    APP.setRole("editor");
  }, (e) => APP.setRole("error", friendly(e)));

  onValue(ref(db, "requests"), (s) => APP.setDevices("requests", s.val()));
  onValue(ref(db, "viewers"), (s) => APP.setDevices("viewers", s.val()));
}

function runViewer(db, uid) {
  let stopState = null;
  onValue(ref(db, "viewers/" + uid), (s) => {
    if (s.exists()) {
      if (!stopState) {
        stopState = onValue(ref(db, "state"), (snap) => {
          const v = snap.val();
          if (v && v.json) APP.setState(v.json);
          APP.setRole("viewer");
        }, () => {});
      }
    } else {
      if (stopState) { stopState(); stopState = null; }
      APP.setRole("pending");
      set(ref(db, "requests/" + uid), { name: deviceName(), at: Date.now() }).catch(() => {});
    }
  }, (e) => APP.setRole("error", friendly(e)));
}

function friendly(e) {
  const m = String((e && (e.code || e.message)) || e);
  if (/admin-restricted-operation|operation-not-allowed/.test(m)) return "Anonymous sign-in is turned off in Firebase. Turn it on under Authentication → Sign-in method → Anonymous.";
  if (/permission[_-]denied/i.test(m)) return "Firebase refused access. Check that the database rules from database.rules.json are published.";
  if (/network/i.test(m)) return "No internet connection. Connect and try again.";
  return "Firebase error: " + m;
}
