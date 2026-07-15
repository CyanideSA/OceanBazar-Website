# Run OceanBazar Without Docker Desktop

Docker Desktop needs **CPU virtualization** (Intel VT-x / AMD-V). If you see *"Virtualization support not detected"*, you can still run the full stack natively on Windows.

## One-time setup (recommended)

Open **PowerShell as Administrator** in the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-native-windows.ps1
```

This installs (via winget): Node.js LTS, OpenJDK 17, Maven, PostgreSQL 16; creates `backend/.env`; starts portable Redis on port **6399**; runs `npm install` and Prisma migrations.

**Close and reopen the terminal** after winget installs so `node`, `npm`, `java`, and `mvn` are on your PATH.

### PostgreSQL password wrong or forgotten?

Run **Administrator** PowerShell:

```powershell
cd "D:\Desktop\Antigravity\OCEANBAZAR Website"
powershell -ExecutionPolicy Bypass -File .\scripts\reset-postgres-password-windows.ps1
```

Default new password: `oceanbazar_admin_2026` (change with `-NewPassword "..."`).

Then create the app database (use `-h 127.0.0.1` so Windows does not use IPv6 `::1`):

```powershell
$env:PGPASSWORD='oceanbazar_admin_2026'
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -U postgres -f scripts\sql\create_oceanbazar_local.sql
```

### PostgreSQL password (normal install)

The PostgreSQL installer asks for a **postgres** superuser password. Then create the app database:

```powershell
cd "D:\Desktop\Antigravity\OCEANBAZAR Website"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -f scripts\sql\create_oceanbazar_local.sql
```

## Daily start

```powershell
cd "D:\Desktop\Antigravity\OCEANBAZAR Website"
npm.cmd run stack:start
```

Or double-click **`start-stack.cmd`**.

> Use **`npm.cmd`** not `npm` if PowerShell blocks script execution.

Or keep services running / respawn missing ones:

```powershell
npm.cmd run stack:keep
```

## URLs

| Service | URL |
|---------|-----|
| Storefront | http://localhost:3000 |
| Admin CRM | http://localhost:5173 |
| Node BFF | http://localhost:4000 |
| Spring Boot API | http://localhost:8000 |

**Admin:** `rjsuvosa` / `rjsuvosa420` (after `prisma db seed`)

## Optional: fix Docker later

1. Reboot → enter BIOS/UEFI → enable **Intel Virtualization Technology** or **AMD SVM**
2. Windows: **Settings → System → Optional features** → enable **Virtual Machine Platform** and **Windows Subsystem for Linux**
3. Reboot → start Docker Desktop

Until then, use the native scripts above; `application-dockerless` profile runs Spring Boot without Redis if Redis is down.

## Troubleshooting

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-stack-windows.ps1 -SkipDocker
```

- **npm not found** — install [Node.js LTS](https://nodejs.org/), new terminal
- **P1000 / DB auth** — run `scripts\sql\create_oceanbazar_local.sql` as `postgres`
- **Wrong Postgres port** — Docker uses **5433**, native install uses **5432**; match `backend\.env`
