# Vercel Team DB Manager

A minimal, dark-themed Postgres database management tool built with Next.js 14 (App Router) and Tailwind CSS. Connects to [Neon DB](https://neon.tech) (or any Postgres instance) via a `DATABASE_URL` environment variable.

## Features

- **Table Browser** — view, inline-edit, add, and delete rows across all tables
- **SQL Editor** — run raw queries with results displayed in a table; Ctrl+Enter shortcut
- **Schema Viewer** — column names, types, nullability, and defaults at a glance
- **Create / Drop Tables** — create tables with custom column definitions; drop with confirmation
- **Undo / Redo** — all destructive actions (edit, delete, create, drop) are tracked; Ctrl+Z to undo, Ctrl+Shift+Z / Ctrl+Y to redo
- **Dark Theme** — monochrome palette (`#0a0a0a` background, `#111` surfaces), monospace data font, no rounded corners
- **No authentication** — designed for local/internal use

## Tech Stack

| Layer        | Technology               |
| ------------ | ------------------------ |
| Framework    | Next.js 14 (App Router)  |
| Styling      | Tailwind CSS             |
| Database     | Postgres via `pg`        |
| Language     | TypeScript               |

## Getting Started

### Prerequisites

- Node.js 18+
- A Postgres database (e.g., [Neon](https://neon.tech), [Supabase](https://supabase.com), or local)

### Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/rishabrkb123-collab/vercel-team-db-manager.git
   cd vercel-team-db-manager
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment**

   Create `.env.local` in the project root:

   ```env
   DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
   ```

   > For Neon, use the connection string from your Neon dashboard (it already includes `sslmode=require`).

4. **Run the dev server**

   ```bash
   npm run dev
   # or double-click start.bat on Windows
   ```

   The app starts on `http://localhost:3000`. If port 3000 is busy, it auto-selects the next available port up to 3020.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── tables/route.ts    # GET (list), POST (create), DELETE (drop)
│   │   ├── rows/route.ts      # GET (list), POST (insert), PUT (update), DELETE (delete)
│   │   ├── query/route.ts     # POST (raw SQL)
│   │   └── schema/route.ts    # GET (column info)
│   ├── globals.css            # Dark theme styles
│   ├── layout.tsx             # Root layout with HistoryProvider
│   └── page.tsx               # Main layout — sidebar, tabs, undo/redo
├── components/
│   ├── Sidebar.tsx            # Left panel — table list with active highlight
│   ├── TableBrowser.tsx       # Data grid — inline edit, add/delete row, create/drop table modals
│   ├── SqlEditor.tsx          # Raw SQL textarea, run button, results table, error display
│   └── UndoBar.tsx            # Bottom bar — last 5 actions (grey = undone, white = applied)
└── lib/
    ├── db.ts                  # pg Pool from DATABASE_URL
    └── history.tsx            # React context — undo/redo state management
```

## API Routes

| Method | Endpoint         | Description                    |
| ------ | ---------------- | ------------------------------ |
| GET    | `/api/tables`    | List all public tables         |
| POST   | `/api/tables`    | Create a table                 |
| DELETE | `/api/tables`    | Drop a table                   |
| GET    | `/api/rows`      | List all rows in a table       |
| POST   | `/api/rows`      | Insert a row                   |
| PUT    | `/api/rows`      | Update a single cell           |
| DELETE | `/api/rows`      | Delete a row                   |
| GET    | `/api/schema`    | Get column info for a table    |
| POST   | `/api/query`     | Execute raw SQL                |

## Undo / Redo

Every mutating action (cell edit, row delete, row add, table create, table drop) is pushed to an in-memory history stack:

| Shortcut          | Action |
| ----------------- | ------ |
| `Ctrl + Z`        | Undo   |
| `Ctrl + Shift + Z` | Redo  |
| `Ctrl + Y`        | Redo   |

The history bar at the bottom of the screen shows the last 5 actions. Greyed-out pills indicate undone actions that can be redone. History is ephemeral — it clears on page refresh.

Raw SQL queries executed via the SQL Editor are **not** added to undo history.

## License

MIT
