# SHERRY X LINKS ZONE

A Node.js/Express WhatsApp group-link submission website with manual admin review.

## Features
- Public group submission form
- Validates WhatsApp invite URLs
- Blocks duplicate invite links
- Limits each connection to one submission per 24 hours (hashed address, not raw IP)
- Admin login, approve/reject/delete, and copy invite link
- Manual posting to your WhatsApp Channel
- Data stored under `/data` on FadeHost so it survives deploys

## Required environment variables
- `ADMIN_PASSWORD`: unique password, at least 12 characters
- `SESSION_SECRET`: random secret, at least 32 characters
- `CHANNEL_URL`: `https://whatsapp.com/channel/0029Vb8ys0B6mYPRbzIBiA0f` (your channel link; shown on the website)
- `DATA_DIR=/data/sherry-x-links-zone`

Do not commit `.env`, passwords, or secrets to GitHub.

## Local run
1. Install Node.js 20+.
2. Run `npm install`.
3. Set the environment variables above.
4. Run `npm start`.
5. Open `http://localhost:8080` and `/admin.html`.

## FadeHost deploy
1. Upload this project to a GitHub repository.
2. FadeHost → Apps → Host an app → Web app or API → your repository.
3. Leave Build command blank. Set Start command to `npm start` if not auto-detected.
4. Add the environment variables above in FadeHost.
5. Deploy and open the generated `https://...fadehost.app` address.
6. Admin page: append `/admin.html`.

FadeHost supplies `PORT`; this server listens on `0.0.0.0` and stores persistent data in `/data`.

## Manual publishing
1. Open `/admin.html` and log in.
2. Review pending submissions.
3. Approve appropriate submissions.
4. Use “Copy invite link”.
5. Create a channel post yourself and paste the link.
6. Do not post suspicious, private, misleading, or abusive links.

## Important
This is a starter project. It uses Express's in-memory session store, so admin sessions end when the app restarts. Submissions are stored in a JSON file under the persistent data directory. For a high-volume public service, use a managed database and stronger abuse controls. The 24-hour limit is per network connection, so people sharing a network may share that limit.
