# Edit History

Newest edits appear first.
If an edit is undone, its matching entry should be removed.

## 2026-03-15

- Created a timestamped backup archive with a matching description file summarizing the session’s frontend, admin dashboard, favicon, WebSocket, and visitor-tracking changes.
- Hardened frontend `main.js` navigation lifecycle handling for back/forward buttons and swipe gestures so tracking state and heartbeats resync correctly on history restores.
- Added a dedicated `/submitted` success page route and configured the main frontend form to redirect there after successful submission.
- Added per-visitor online/offline indicators in the admin visitors panel, backed by live Redis-derived visitor presence state.
- Broadcast live visitor list snapshots to the admin dashboard so new visitors appear immediately without a manual refresh.
- Added admin WebSocket reconnect logic with fresh token fetching so live submission updates recover automatically after socket drops.
- Renamed the frontend visitor localStorage key from `fastapi-base-visitor-id` to `sid` with one-time migration from the legacy key.
- Reworked the favicon set with a custom `M` mark and wired the frontend and admin templates to use the new favicon assets and web manifest.
- Removed missing Tabler source map references so `/static/vendor/tabler/*.map` requests stop producing 404 noise.

- Added a Telegram token input row inside the settings modal with an icon, divider, and API token placeholder.
- Added a stronger hover state to the Telegram icon so it dims and reads more clearly as a clickable button.
- Made submission rows span the full submissions panel width again and changed the Telegram icon to appear only on row hover.
- Updated the admin settings icon to a bold outlined gear style to better match the requested reference.
- Replaced the admin settings trigger with a cleaner native-style SVG icon and refined the button styling to feel more app-like.
- Added a settings icon to the admin dashboard header and wired it to an empty overlay modal scaffold for future settings work.
- Created this edit history file so every future code change in this workspace gets a short description recorded in newest-first order.
