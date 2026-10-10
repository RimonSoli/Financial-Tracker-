# Family Cashflow

A home-screen app for forecasting the family's bank balance across the year: recurring bills, monthly estimates, credit card billing delays, savings, net worth and alerts.

One phone is the **editor** and can change everything. Other phones are **view only** and see the same numbers live.

Live app: https://rimonsoli.github.io/Financial-Tracker-/

## How phones get their role

1. The **first** phone or computer to open the app becomes the editor. Open it on the editor's Android phone first.
2. Any phone that opens it after that shows **Waiting for approval**.
3. On the editor's phone, the bell shows a notification for the new phone. Tap **Allow**, or go to Settings → Phones. The other phone becomes view only right away.

The editor can remove a view-only phone at any time from Settings → Phones.

## Install on Android (editor)

1. Open the live app link in **Chrome**.
2. Tap **Install app** when Chrome offers it, or the ⋮ menu → **Add to Home screen** → **Install**.
3. Open it from the home screen icon.

## Install on iPhone (view only)

1. Open the live app link in **Safari** (it has to be Safari).
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Open it from the home screen icon. It will ask the editor for approval.

## Firebase setup (one time)

The data lives in the Firebase project `financial-tracker-747dd`.

- **Authentication → Sign-in method → Anonymous** must be turned on. It gives each phone a hidden ID; nobody logs in.
- **Realtime Database → Rules**: replace the rules with the contents of [`database.rules.json`](database.rules.json) and click **Publish**. These rules make sure only the editor can change data and only approved phones can read it. Do this before the database's test-mode period ends, and before sharing the app.

## If the editor phone is lost or reset

The editor role is tied to the app's storage on that phone. If the phone is replaced or the app is deleted:

1. In the Firebase console, open **Realtime Database → Data**.
2. Delete the `meta` → `editor` entry (and optionally `viewers`).
3. Open the app on the new editor phone first. Your data in `state` is kept, so nothing is lost.

## Files

- `index.html` – the whole app (screens, forecast engine, styles)
- `sync.js` – Firebase sync and editor/viewer roles
- `firebase-config.js` – which Firebase project to use (not a secret)
- `database.rules.json` – server rules to paste into Firebase
- `manifest.webmanifest`, `sw.js`, `icons/` – home-screen install and offline support

Without a Firebase config the app still runs, saving data only on that one device.
