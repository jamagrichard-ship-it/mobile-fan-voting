# Mobile Fan Vote (starter)

A mobile-first voting dashboard with TikTok LIVE event connector. Viewer comments exact housemate name, then sends configured gift within selection window. The server credits matching gift events to that viewer's latest selection.

## Deploy

This needs a Node.js host (not just a static website host). Upload this folder to a Node host, set start command `npm start`, and ensure it uses Node 20+. Open the hosted URL from your phone.

## Setup
1. Add housemate names in the dashboard.
2. Enter the TikTok username (no @), gift name (default Rose), vote value, and selection time window.
3. Connect LIVE while the creator is live.
4. Viewers comment an exact housemate name and then send the gift.

This uses an unofficial reverse-engineered TikTok connector; connection reliability and event delivery are not guaranteed and TikTok may change its protocol. Keep the host running during LIVE. No TikTok passwords/session cookies are requested by this app.
