# HPE Brahma Document Creator

Professional document generation application with Proposal PPTX, Statement of Work DOCX/PDF support.

## Quick Start (5 minutes)

### 1. Prerequisites
- **Node.js 18+**: [Download here](https://nodejs.org)
- **Windows 10+** or WSL2

### 2. Build Production (.exe)

**Option A: Automated (Recommended)**
```bash
# Just run this from the root folder
build.bat
# or in PowerShell:
.\build.ps1
```

**Option B: Manual Step-by-Step**
```bash
# Install all dependencies
npm install && cd frontend && npm install && cd ..

# Build frontend
npm run build:frontend

# Build Windows installer
npm run build:electron
```

### 3. Output
Look for: `dist/HPE Brahma Document Creator Setup 1.0.0.exe`

Send this (.exe) file to users. They double-click → app installs automatically ✅

---

## For Users Installing the App

### First Time Setup

**In PowerShell/Command Prompt:**
```bash
# 1. Navigate to the backend folder
cd backend

# 2. Install dependencies (one-time)
npm install

# 3. Start the backend server
npm start
# You'll see: "Server running on port 5000"
```

**Keep that terminal open** and don't close it!

### Running the App

- Double-click desktop shortcut created during installation
- Or find "HPE Brahma Document Creator" in Windows Start Menu
- App opens with all features ready

---

## Development Setup

```bash
# Terminal 1: Start backend
cd backend
npm start

# Terminal 2: Start frontend + Electron preview (auto-reload on code changes)
npm run dev
```

Opens at `http://localhost:3000` with hot-reload ✅

---

## Project Structure

```
backup-doc-app/
├── main.js ..................... Electron entry point
├── preload.js .................. IPC handlers (Word COM, email)
├── build.bat, build.ps1 ........ Build scripts
├── BUILD.md .................... Detailed build guide
│
├── frontend/ ................... React/Next.js UI
│   ├── app/ .................... Pages & components
│   ├── next.config.ts .......... Config (exports static)
│   └── out/ .................... Built static files (generated)
│
├── backend/ .................... Express API server
│   ├── src/
│   │   ├── controllers/ ........ API logic
│   │   ├── models/ ............ Database
│   │   ├── routes/ ............ API endpoints
│   │   └── scripts/fill_proposal.py ... PPTX generator
│   ├── server.js .............. HTTP server
│   └── package.json
│
└── dist/ ....................... Build output (generated)
    └── HPE Brahma Document Creator Setup 1.0.0.exe
```

---

## Build Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development with hot-reload |
| `npm run build:frontend` | Build frontend only |
| `npm run build:electron` | Create .exe installer |
| `npm run build:electron:portable` | Create single .exe (no installer) |
| `npm run build:electron:dir` | Build package only (debug) |

---

## Features

✅ Document Generation  
✅ PPTX Proposals  
✅ DOCX/PDF Statements of Work  
✅ Auto-Save to Database  
✅ Version History  
✅ Email with Attachments  
✅ Word TOC Auto-Generation  
✅ Multi-SoW Type Versioning  

---

## Troubleshooting

**Q: "Cannot find backend"**  
A: Backend not running. In PowerShell: `cd backend && npm start`

**Q: "Email doesn't open"**  
A: Missing Outlook. Falls back to `mailto:` (default mail client)

**Q: "Installer is 100+ MB"**  
A: Normal for Electron (includes runtime). This is expected.

**Q: "White screen after install"**  
A: Backend crashed. Check `cd backend && npm start` logs

For more: See [BUILD.md](BUILD.md)

---

## File Size Info

- **Frontend Build**: ~2-5 MB (static HTML/CSS/JS)
- **Installer (.exe)**: ~30-50 MB
- **Installed App**: ~200-300 MB (includes Node.js runtime)

---

## Configuration

### Backend Port
Default: `5000` (can be changed in `backend/.env`)

### API Endpoint
Frontend: `http://localhost:5000` (configured in `frontend/lib/api.ts`)

### Database
See `backend/src/config/config.json`

---

## License

© 2026 HPE. All rights reserved.

---

**Questions?** Check [BUILD.md](BUILD.md) for detailed setup instructions.
