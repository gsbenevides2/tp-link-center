# TP-Link Center

Admin dashboard to manage TP-Link routers, monitor connected devices, and track uptime history.

## Features

- **Device Management** — Register and manage network devices with multiple interfaces (MAC + IP)
- **Live Status Detection** — Scrapes the TP-Link router web interface via Lightpanda (headless browser via CDP) to detect online/offline devices
- **Uptime Tracking** — Automatic online checks every 5 minutes with 24-hour connection history per device
- **Unregistered Device Discovery** — Identify devices connected to the router that aren't yet registered, link or register them directly
- **MAC Vendor Lookup** — Resolves MAC addresses to vendor names (e.g., TP-Link, Apple)
- **OpenAPI Documentation** — Full API docs with Scalar UI at `/api`

## Tech Stack

- **Runtime:** Bun
- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + DaisyUI
- **Backend:** Elysia (API framework, proxied via Next.js catch-all route)
- **Database:** PostgreSQL + Drizzle ORM
- **Browser:** Chrome CDP: headless browser via CDP
- **API Client:** Elysia Eden (type-safe)

## Getting Started

### Prerequisites

- Bun
- PostgreSQL
- TP-Link router with web admin interface

### Environment Variables

Create `.env` and fill in:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `ROUTER_ENPOINT` | TP-Link router web admin URL |
| `ROUTER_PASSWORD` | TP-Link router login password |
| `BROWSER_URL` | Chrome CDP endpoint (e.g. `http://127.0.0.1:9222`) |

### Install & Run

#### With Docker Compose (recommended)

```bash
docker compose up -d
```

This starts both the app and Lightpanda browser. The app will be available at `http://localhost:3000`.

#### Manual setup

Start Chrome CDP:

```bash
chromium --remote-debugging-port=9222
```

Install and run the app:

```bash
bun install
bun run db:sync    # Push schema to database
bun run dev        # Start dev server at http://localhost:3000
```

### Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Build for production |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run db:sync` | Push Drizzle schema to database |
| `bun run db:studio` | Open Drizzle Studio |

## Project Structure

```
.
├── app/                        # Next.js frontend
│   ├── api/                    # Elysia API proxy + typed clients
│   ├── components/             # React components (UI)
│   │   ├── Header/
│   │   ├── RegisteredDevicesSection/
│   │   ├── UnregisteredDevicesSection/
│   │   ├── DeviceDrawer/
│   │   ├── AddDeviceModal/
│   │   └── AddInterfaceModal/
│   └── page.tsx                # Main page
├── server/                     # Elysia backend
│   ├── modules/
│   │   ├── devices/            # Device CRUD (routes, service, model)
│   │   ├── router/             # TP-Link router scraping service
│   │   └── checks/             # Online check logic
│   ├── db/                     # Drizzle schema + connection
│   ├── utils/                  # Helpers
│   ├── cron.ts                 # Periodic online check job
│   └── index.ts                # Elysia app entry
└── instrumentation.ts          # Next.js instrumentation (cron registration)
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/devices/` | List all devices with interfaces |
| `POST` | `/api/devices/` | Create a device |
| `PUT` | `/api/devices/:id` | Update a device |
| `DELETE` | `/api/devices/:id` | Delete a device and its interfaces |
| `POST` | `/api/devices/:id/interface` | Add a network interface to a device |
| `PUT` | `/api/devices/:id/interface/:interfaceId` | Update a network interface |
| `DELETE` | `/api/devices/:id/interface/:interfaceId` | Delete a network interface |
| `GET` | `/api/devices/:id/history?from=&to=` | Get connection history for a time range |
| `GET` | `/api/router/connected-devices` | Scrape router for currently connected devices |
| `GET` | `/api/checks/latest` | Get the latest online check snapshot |

## License

MIT
