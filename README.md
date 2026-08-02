# TP-Link Center

Admin dashboard to manage TP-Link routers, monitor connected devices, and track uptime history.

## Features

- **Device Management** — Register and manage network devices with multiple interfaces (MAC + IP)
- **Device Types** — Differentiate between routers (with controller/agent roles) and client devices
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
| `BROWSER_URL or BROWSER_WSENDPOINT` | Chrome CDP endpoint (e.g. `http://127.0.0.1:9222`) |
| `ROUTER_PASSWORD_SECRET` | Secret key for encrypting router passwords (AES-256) |

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

### Device Management

| Method | Endpoint | Description | Parameters |
|--------|----------|-------------|------------|
| `GET` | `/api/devices/` | List all devices with interfaces | - |
| `POST` | `/api/devices/` | Create a device | Body: `{ name: string }` |
| `PUT` | `/api/devices/:id` | Update device name/brand | Body: `{ name?: string, brand?: string }` |
| `DELETE` | `/api/devices/:id` | Delete a device and its interfaces | Path: `id` |

### Network Interfaces

| Method | Endpoint | Description | Parameters |
|--------|----------|-------------|------------|
| `POST` | `/api/devices/:id/interface` | Add a network interface to a device | Path: `id` • Body: `{ name: string, mac?: string }` |
| `PUT` | `/api/devices/:id/interface/:interfaceId` | Update a network interface | Path: `id, interfaceId` • Body: `{ name?: string, mac?: string }` |
| `DELETE` | `/api/devices/:id/interface/:interfaceId` | Delete a network interface | Path: `id, interfaceId` |

### Connection History

| Method | Endpoint | Description | Parameters |
|--------|----------|-------------|------------|
| `GET` | `/api/devices/:id/history` | Get device connection history | Path: `id` • Query: `startDate?, endDate?, limit?` |

### Router Control

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/router/sync` | Scrape router for connected devices |
| `POST` | `/api/router/restart-network` | Restart all routers (agents first, then controller) |
| `GET` | `/api/settings/latest-router-status` | Get router status (WAN IP, uptime, performance metrics) |

### Status Checks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/checks/latest` | Get the latest online check snapshot |

## License

MIT
