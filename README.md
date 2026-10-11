# CampusMate

A local-first student notice board built with React, Vite, and JavaScript. Add campus notices, search and filter them, track relevant dates and priority, and view locally extracted key points.

## Run locally

1. Install Node.js (version 18 or newer).
2. In PowerShell, open this project folder and install dependencies:

   ```bash
   npm.cmd install
   ```

3. Start the development server:

   ```bash
   npm.cmd run dev
   ```

4. Open the local URL printed by Vite (normally `http://localhost:5173`).

To verify and preview the production build, run:

```bash
npm.cmd run build
npm.cmd run preview
```

The `.cmd` form avoids PowerShell script-execution-policy errors on Windows.

## Features

- Add and delete notices with title, details, relevant date, and High / Medium / Low priority.
- Search notices, filter by priority or upcoming date, and change sort order.
- See **Upcoming Deadline Reminders** for dated saved notices within the next 7 local calendar days; deadlines today through 3 days away are highlighted.
- Extract and save up to three useful key points with a small, local rule-based summarizer.
- Ask CampusMate about dates, deadlines, tasks, and summaries found in saved notices. This is a local, rule-based Q&A prototype; answers show their notice sources and say when information is unavailable.
- Persist notices, summaries, and refresh timestamp in this browser's local storage.
- Installable PWA shell with a service worker that caches the production app and same-origin static resources.
- Online/offline indicator, manual local-cache refresh, loading feedback, empty states, and visible storage/refresh errors.
- Demo controls for simulated disconnection, a one-time refresh failure, and aging the saved cache beyond 30 minutes.

## Offline and freshness behaviour

Notices and summaries remain in local storage and can be opened without an internet connection in the same browser profile. The service worker is enabled for the production build, not the Vite development server. For PWA/offline testing, run `npm.cmd run build` and `npm.cmd run preview`, open the preview URL online once so the service worker can cache the app, then switch the browser to offline mode. Browser storage can be cleared by the user or browser, so it is not a permanent backup.

Freshness is calculated from the saved `lastSuccessfulRefresh` timestamp. Data within 30 minutes is marked within the cache window; after that it is marked stale and a warning says it may no longer be current. Failed refreshes do not change the timestamp or remove saved notices. The manual action checks and saves the local cache only.

**No college notice feed or AI service is configured.** An online indicator only means the browser reports a network connection; it does not mean notices were checked against the college. “Fresh” describes the age of the local snapshot, not whether a notice is still valid. Summaries are explicitly rule-based and run in the browser; no API key or backend is included.

The Notice Assistant is also rule-based and only reads notices saved in this browser. Its conversation is temporary and is not stored. Notices are not shared between students: a shared cloud database remains future work.

Upcoming Deadline Reminders are calculated from dates already saved with notices on this device. They show a local in-app reminder only; CampusMate does not send push notifications or provide automatic alerts when the app is closed.

## Demo checklist

1. Run the production preview (`npm.cmd run build`, then `npm.cmd run preview`) and open its URL online once.
2. Add a notice with a deadline, date, or required action; check that its local key points, priority, and saved timestamp appear.
3. Search for a word in the notice, filter High priority / Upcoming, and delete the notice.
4. Open **Demo controls** and choose **Simulate offline**. The offline indicator and saved notices remain visible. Try **Refresh cache** to see the failure message and confirm the notice remains saved.
5. Restore the demo connection. Choose **Fail next refresh**, then **Refresh cache**; confirm the failed request does not change the saved data.
6. Choose **Age cache past 30 min**; confirm the stale warning is shown. Refresh while connected to return the local cache timestamp to the fresh window.
7. Reload the browser to confirm local data persists. For an actual offline check, use the browser's install option or developer tools' offline mode after step 1.
8. Ask CampusMate for upcoming deadlines, important dates, a notice summary, and a topic that is not saved. Check that answers show their source notice and unavailable information is stated clearly.
9. Add notices dated today, within 3 days, within 7 days, and beyond 7 days. Confirm only the first three appear (with the within-3-day notices highlighted); remove or update those dates and confirm the empty state appears when none remain.

## Adapting this project

The notice UI and local rule-based summary are separate (`src/App.jsx` and `src/summary.js`). A future live integration should add a trusted backend endpoint, handle authentication and errors there, and update the refresh timestamp only after that source returns successfully. Never put private AI/API secrets in frontend code.
