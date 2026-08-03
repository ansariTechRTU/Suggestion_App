# Dependencies

Everything the project installs, and why it is there. Nothing here needs to be
installed by hand — `pnpm install` at the repo root does all of it. This file
exists so you can review the surface area before running it, and so nobody has
to guess later why a package is present.

---

## 1. Install on the machine first

| Tool               | Version         | Verify      | Where from                                                           |
| ------------------ | --------------- | ----------- | -------------------------------------------------------------------- |
| **Node.js**        | 22 LTS or newer | `node -v`   | [nodejs.org](https://nodejs.org) · or `nvm install 22 && nvm use 22` |
| **pnpm**           | 9 or newer      | `pnpm -v`   | `npm install -g pnpm`                                                |
| **Docker Desktop** | current         | `docker -v` | [docker.com](https://www.docker.com/products/docker-desktop)         |
| **Git**            | any             | `git -v`    | [git-scm.com](https://git-scm.com)                                   |

**Optional**

| Tool                       | Why                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `psql` (PostgreSQL client) | Not required. `pnpm db:raw` runs `raw.sql` through Prisma, so nothing beyond Node is needed |
| Your own PostgreSQL 16     | Alternative to Docker — skip `pnpm db:up` and point `DATABASE_URL` at it                    |

Docker supplies PostgreSQL, so you do **not** need Postgres installed locally.

### VS Code extensions (optional, recommended)

| Extension                 | Id                          |
| ------------------------- | --------------------------- |
| Prisma                    | `Prisma.prisma`             |
| Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss` |
| ESLint                    | `dbaeumer.vscode-eslint`    |
| Prettier                  | `esbenp.prettier-vscode`    |

---

## 2. External accounts

| Service                          | Needed for                                                   | When                                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[Google Cloud](https://console.cloud.google.com)** | Google Workspace sign-in | **Not needed for the demo.** Required for a real rollout — an OAuth 2.0 client ID takes about fifteen minutes to create. Free |
| **[Resend](https://resend.com)** | All outbound email: sign-in links, reminders, status updates | **Not needed for the demo.** `MAIL_DRY_RUN=true` prints mail to the console, and demo mode skips email sign-in entirely. Required before a real launch, along with domain verification (SPF, DKIM, DMARC) |
| **[Render](https://render.com)** | Hosting                                                      | Free plan is enough for the demo. `render.yaml` provisions the database and service                                                                                                                       |

No Redis and no separate queue server — pg-boss runs the schedule inside
PostgreSQL. Google is the only identity provider, and it is optional: without it
the magic-link flow still enforces the same domain allowlist.

---

## 3. `apps/api` — runtime

| Package                              | Version                    | Role                                                                                                                                                                                  |
| ------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `express`                            | ^4.21.1                    | HTTP server                                                                                                                                                                           |
| `@prisma/client`                     | ^5.22.0                    | Typed database client                                                                                                                                                                 |
| `pg-boss`                            | ^10.1.5                    | Job scheduling for the Friday/Monday/open/close cycle, backed by Postgres                                                                                                             |
| `luxon`                              | ^3.5.0                     | ISO week and timezone maths in `Europe/Riga` — the core of the weekly cycle                                                                                                           |
| `resend`                             | ^4.0.1                     | Email delivery                                                                                                                                                                        |
| `svix`                               | ^1.42.0                    | Verifies Resend webhook signatures                                                                                                                                                    |
| `zod`                                | ^3.23.8                    | Request validation, shared with the frontend                                                                                                                                          |
| `helmet`                             | ^8.0.0                     | Security headers                                                                                                                                                                      |
| `cors`                               | ^2.8.5                     | Cross-origin policy for the web app                                                                                                                                                   |
| `cookie-parser`                      | ^1.4.7                     | Reads the session cookie                                                                                                                                                              |
| `express-rate-limit`                 | ^7.4.1                     | Throttles sign-in requests and the API                                                                                                                                                |
| `pino` / `pino-http` / `pino-pretty` | ^9.5.0 / ^10.3.0 / ^13.0.0 | Structured request and application logging; `pino-pretty` renders it readably in development                                                                                          |
| `multer`                             | ^1.4.5-lts.1               | Attachment uploads — installed, route not yet wired                                                                                                                                   |
| `dotenv`                             | ^16.4.5                    | Loads `.env`                                                                                                                                                                          |
| `tsx`                                | ^4.19.2                    | Runs the API in **both** dev and production. A runtime dependency on purpose: `packages/*` export TypeScript sources, so a compiled build would emit import paths Node cannot resolve |
| `@nk/shared`, `@nk/emails`           | workspace                  | Local packages                                                                                                                                                                        |

### `apps/api` — development

| Package             | Role                                              |
| ------------------- | ------------------------------------------------- |
| `prisma` ^5.22.0    | Migrations, `db push`, `generate`, Studio         |
| `typescript` ^5.6.3 | Typechecking                                      |
| `@types/*`          | express, node, cors, cookie-parser, luxon, multer |

---

## 4. `apps/web` — runtime

| Package                     | Version            | Role                                |
| --------------------------- | ------------------ | ----------------------------------- |
| `react` / `react-dom`       | ^18.3.1            | UI                                  |
| `react-router-dom`          | ^6.28.0            | Routing                             |
| `@tanstack/react-query`     | ^5.59.16           | Server state, caching, invalidation |
| `react-hook-form`           | ^7.53.2            | Form state                          |
| `i18next` / `react-i18next` | ^23.16.4 / ^15.1.0 | EN, LV, RU translations             |
| `lucide-react`              | ^0.454.0           | Icons                               |
| `zod`                       | ^3.23.8            | Shared validation schemas           |
| `@nk/shared`                | workspace          | Enums, schemas, the scoring formula |

### `apps/web` — development

| Package                                           | Role                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `vite` ^5.4.10                                    | Dev server and build                                                                        |
| `@vitejs/plugin-react` ^4.3.3                     | React support                                                                               |
| `tailwindcss` ^4.0.0 + `@tailwindcss/vite` ^4.0.0 | Styling. v4 is CSS-first — tokens live in `src/index.css`, there is no `tailwind.config.js` |
| `typescript`, `@types/react`, `@types/react-dom`  | Types                                                                                       |

---

## 5. Workspace packages

| Package           | Depends on   | Purpose                                                                                                                 |
| ----------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `packages/shared` | `zod`        | Enums, Zod schemas, settings defaults, the scoring formula. Imported by **both** apps so a rule exists in one place     |
| `packages/emails` | `@nk/shared` | Localised HTML email templates. Plain HTML by design — no JSX build in the API process, no render dependency at runtime |

## 6. Root

| Package             | Role                    |
| ------------------- | ----------------------- |
| `typescript` ^5.6.3 | Shared compiler version |
| `prettier` ^3.3.3   | Formatting              |

---

## 7. Deliberately not included

| Not used                 | Instead                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Redis / BullMQ           | `pg-boss` — the database is already there                                          |
| `react-email`            | Plain HTML templates in `packages/emails`                                          |
| bcrypt / argon2          | No passwords at all: sign-in is a magic link to an org email                       |
| Redux / Zustand          | TanStack Query for server state, `useState` for local                              |
| An ORM other than Prisma | Prisma's typed client and readable migration history matter for the ISO 9001 trail |
| `tailwind.config.js`     | Tailwind v4 defines tokens in CSS                                                  |

---

## 8. Verifying the install

```bash
pnpm setup            # install, database, schema, raw.sql, demo seed — one command
pnpm typecheck        # all four packages must pass
pnpm dev              # API :4000, web :5173
```

Step by step, if you prefer:

```bash
pnpm install          # every workspace, then `prisma generate` via postinstall
pnpm db:up            # Postgres 16 container on :5432
pnpm db:push          # schema straight from schema.prisma
pnpm db:raw           # tsvector column, quota index, vote trigger
pnpm demo:seed        # 24 staff, 11 cycles, 172 suggestions
```

`pnpm-lock.yaml` is committed, so `pnpm install` reproduces exact versions. Use
`pnpm install --frozen-lockfile` in CI.
