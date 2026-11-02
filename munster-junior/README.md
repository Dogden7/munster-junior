# Munster Junior Rugby

## Install on your phone

This app is now a PWA: it includes a web app manifest, Android and iPhone icons, an install button where the browser supports one, and an offline service worker. Your favourite club and saved results remain available offline after your first successful visit. Offline data is labelled; live updates resume when connected and the app is open.

Phone installation requires serving the complete app from an HTTPS website. The in-chat file preview cannot install the app or provide live data. Sites hosting is currently blocked because its required publishing helpers are absent in this environment.

Once hosted:

- Android: open the HTTPS link in Chrome and tap **Install app**, or use the browser menu to install it.
- iPhone: open the HTTPS link in Safari, tap **Share**, then **Add to Home Screen**.

Keep the Node server running behind the HTTPS website. Static hosting alone will show the saved snapshot but cannot fetch live results. The service worker works on localhost for development, but a phone's localhost refers to the phone itself.

The PWA does not include background checks or push alerts. Installing it does not change that.

Run with Node 24 or later:

```sh
npm start
```

Open http://localhost:3000. Run parser checks with `npm test`.

For the in-chat file preview, open `public/index.html`. It embeds its styles, scripts and a saved data snapshot, so the club filter and all tabs work without the server. It explicitly labels the data as saved when the live API is unavailable. Live updates require the running Node server. Rebuild this preview after changes with `node build-preview.mjs`; edit `page-template.html` for page markup.

Use the league dropdown at the top to choose Junior League Division 1 or South - Junior 2 League. Both competitions use the same results, fixtures, standings, club filtering and team sheet views. Club preferences, saved data and team sheets are stored separately for each league.

Reads the 2026–2027 competitions from SportLoMo. Results, fixtures and league standings come from the source; cup matches are excluded. The server caches successful checks for one minute; the browser checks every five minutes while visible and on return to the tab. A manual Refresh checks immediately subject to the server cache.

Favourite club and detected changes are stored in the browser. The server keeps the last successful data in snapshot.json (Division 1) or snapshot-south-junior-2.json (South Junior 2) and labels it stale if the source cannot be reached. This file is a fallback, not live data. A season rollover requires updating the competition URL in divisions.mjs and season label in data.mjs.

This version does not send background push notifications or run unattended checks. Hosting and a notification service are needed for that functionality. Sites publishing was blocked because its required source and packaging helpers are absent in the workspace.
