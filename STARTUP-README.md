# OceanBazar Quick Start Guide

## No Docker? (Virtualization not detected)

If Docker Desktop will not start, use the **native Windows** path instead of Docker:

```powershell
# Once (Admin PowerShell recommended):
powershell -ExecutionPolicy Bypass -File .\scripts\setup-native-windows.ps1

# Then daily:
npm run stack:start
```

Full details: **[NO-DOCKER-WINDOWS.md](./NO-DOCKER-WINDOWS.md)**

---

## Fast Startup Scripts (Use These!)

### 1. Quick Start (Recommended for daily use)
```powershell
.\quick-start.ps1
```
**Features:**
- Clears port conflicts automatically
- Clears Next.js cache for clean builds
- Waits for backend to be ready before showing success
- Auto-cleanup on exit (press Enter to stop all)

**Start specific services only:**
```powershell
.\quick-start.ps1 -Only backend,storefront
.\quick-start.ps1 -Only admin
.\quick-start.ps1 -Only backend
```

### 2. Windows Batch (Double-click friendly)
```
Double-click: start.bat
```

### 3. Full Startup Manager (With health checks)
```powershell
.\start-oceanbazar.ps1
```

## One-Time Setup (Already Done!)
The following has already been completed:
- ✅ Maven dependencies cached
- ✅ NPM dependencies installed
- ✅ Backend pre-compiled

**To re-run if needed:**
```powershell
.\setup-dependencies.ps1
```

## Diagnostics
If something isn't working:
```powershell
.\diagnose.ps1
```
This checks:
- Java, Maven, Node.js versions
- PostgreSQL and Redis availability
- Port conflicts
- Disk space

## Common Issues & Solutions

### Issue: "Port already in use"
**Solution:** The scripts automatically clear ports. If manual intervention needed:
```powershell
Get-NetTCPConnection -LocalPort 8001,3000,5173 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Issue: Backend takes too long to start
**Solution:** Already fixed! Dependencies are cached. First startup after `setup-dependencies.ps1` should take ~30 seconds.

### Issue: Storefront shows old errors
**Solution:** The scripts automatically clear `.next` cache on each start.

### Issue: CORS errors in Admin CRM
**Solution:** Fixed in `application.properties` - ports 3000, 5173 are whitelisted with HTTPS.

## Service URLs After Startup

| Service | URL | Purpose |
|---------|-----|---------|
| Backend API | https://localhost:8000 | Core Spring Boot API |
| Storefront | https://localhost:3000 | Next.js customer site |
| Admin CRM | https://localhost:5173 | React Vite admin panel |

**Note:** All services use HTTPS for secure communication.

## Password Reset (Dev Only)

If you need to reset the password for `rjsuvo.00000@gmail.com`:
```powershell
Invoke-RestMethod -Uri "https://localhost:8000/api/auth/dev-reset-password" -Method POST -ContentType "application/json" -Body '{"email":"rjsuvo.00000@gmail.com","newPassword":"rjsuvosa420"}'
```

## Manual Start (If Scripts Fail)

**Terminal 1 - Backend:**
```powershell
cd backend-java
mvn spring-boot:run
```

**Terminal 2 - Storefront:**
```powershell
cd frontend
npm run dev
```

**Terminal 3 - Admin:**
```powershell
cd admin-frontend-react
npm run dev
```

## Performance Tips

1. **Keep dependencies cached** - Don't delete `node_modules` or `.m2`
2. **Use SSD** - The project performs best on SSD storage
3. **Close unnecessary apps** - Free up RAM for Java/Node processes
4. **Use quick-start.ps1** - It's optimized for speed

## Need Help?

Run diagnostics and share output:
```powershell
.\diagnose.ps1 | Out-File "diagnostic-log.txt"
```
