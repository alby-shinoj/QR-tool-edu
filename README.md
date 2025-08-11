

## Features
- Delayed alarm with 120 second wait and 120 second siren.
- Events stored in SQLite and streamed via Socket.IO.
- Admin dashboard with basic auth, live event table and stats.
- QR code generator endpoint for easy printing.

## Setup
```bash
npm install
node server.js
```
The site runs on [http://localhost:3000](http://localhost:3000). Set environment variables `PORT`, `PUBLIC_URL`, `ADMIN_USER`, `ADMIN_PASS`, and `BEHIND_PROXY` as needed.

## Docker
```bash
docker compose up --build
```
The database `events.db` is stored on a volume and the `public` folder is bind mounted for easy customization.

## Printing a QR Code
Generate a PNG that links to `PUBLIC_URL` (defaults to `http://localhost:3000`):
```bash
curl "http://localhost:3000/qr" -o qr.png
```
Adjust the `text` and `size` query parameters if neeeded 

## Files
- `server.js` – Express application
- `public/index.html` – landing page with delayed alarm
- `public/admin.html` – live admin dashboard
- `public/siren.mp3` – placeholder audio file
- `docker-compose.yml`, `Dockerfile` – container setup

