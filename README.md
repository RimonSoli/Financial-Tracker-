# Family Cashflow

A home-screen app for forecasting the family's bank balances years ahead: recurring bills, monthly estimates, credit card billing delays, several checking and savings accounts, net worth and alerts.

The main phone and any device with the **editor passcode** can change everything. Other devices are **view only** and see the same numbers live.

Live app: https://rimonsoli.github.io/Financial-Tracker-/

## Who can edit and who can view

1. The **first** device to open the app becomes the main editor (the Android phone). It can always edit.
2. To edit from a computer or tablet too: on the main phone, go to **Settings → Devices → Editor passcode** and set a passcode (at least 6 characters). On the computer or tablet, open the app and enter the passcode. It can edit straight away.
3. Any other device that opens the app shows **Waiting for approval**. On an editing device, tap **Allow** on the bell notification, or go to Settings → Devices. That device becomes view only.

Editors can remove other editors and view-only devices at any time from Settings → Devices. Changing the passcode doesn't remove devices that already joined; remove them in that list.

If two editors change the same part of the app (say, both edit bills) at the same moment, the later save wins. Changes to different parts (bills on one device, net worth on another) are both kept.

## Install on Android

1. Open the live app link in **Chrome**.
2. Tap **Install app** when Chrome offers it, or the ⋮ menu → **Add to Home screen** → **Install**.
3. Open it from the home screen icon.

## Install on iPhone or iPad

1. Open the live app link in **Safari** (it has to be Safari).
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Open it from the home screen icon.

On a computer, just open the link in any browser and bookmark it.

## Firebase setup

The data lives in the Firebase project `financial-tracker-747dd`.

- **Authentication → Sign-in method → Anonymous** must be turned on. It gives each device a hidden ID; nobody logs in.
- **Realtime Database → Rules**: replace the rules with the contents of [`database.rules.json`](database.rules.json) and click **Publish**. These rules make sure only editing devices can change data, only approved devices can read it, and the editor passcode can't be read by anyone. Publish them again whenever this file changes.

Until the current rules are published, the app keeps working with one editor only, and Settings → Devices shows a reminder.

## If the main phone is lost or reset

The main editor role is tied to the app's storage on that phone. If it's replaced or the app is deleted, any other editing device keeps working. To make a new main phone:

1. In the Firebase console, open **Realtime Database → Data**.
2. Delete the `meta` → `editor` entry.
3. Open the app on the new main phone first. Your data in `data` is kept, so nothing is lost.

## Erasing and undo

**Start blank** and **Replace with example data** (Settings → Data) ask you to type ERASE first. A full copy of the data is kept, and a banner at the top offers **Undo** until you choose **Keep it this way**.

## Files

- `index.html` – page layout and styles
- `app.js` – screens and the forecast engine
- `sync.js` – Firebase sync, editors, passcode and view-only devices
- `firebase-config.js` – which Firebase project to use (not a secret)
- `database.rules.json` – server rules to paste into Firebase
- `manifest.webmanifest`, `sw.js`, `icons/` – home-screen install and offline support

Without a Firebase config the app still runs, saving data only on that one device.
