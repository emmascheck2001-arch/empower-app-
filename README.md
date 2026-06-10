# Em~power — Repository Guide

## The active app is in `empower-react/`

Everything you need to work on is inside `empower-react/`. Start there.

```
empower-react/    ← React + Vite SPA — the real app
  src/
    pages/        ← one .jsx file per screen
    lib/          ← hormoneSync.js (algorithm), supabase.js (DB client)
    components/   ← shared UI components
  public/         ← static assets, PWA manifest, Netlify _redirects
  README.md       ← developer documentation
```

**Developer documentation:** [empower-react/README.md](empower-react/README.md)

---

## Everything else in this directory — ignore it

These files are legacy from before the React migration. They are **not deployed** and should not be touched:

| Item | What it is |
|---|---|
| `*.html` (dashboard.html, log.html, etc.) | Legacy HTML prototype screens — not deployed |
| `www/` | Capacitor sync output — auto-generated, not the source |
| `ios/` | iOS Capacitor project — inactive |
| `algorithm_v3.js`, `hormoneSync.js`, `supabase.js` (root) | Legacy copies — the real files live in `empower-react/src/lib/` |
| `style.css`, `sw.js`, `manifest.json` (root) | Legacy CSS and PWA files from the HTML prototype |
| `node_modules/` | Legacy package install — the React app has its own in `empower-react/node_modules/` |

---

## Quick start

```bash
cd empower-react
npm install
npm run dev
```

## Deploy

```bash
cd empower-react
npm run build
netlify deploy --dir dist --site 11d125ac-cd81-4060-8dc1-2b6b580265ed --prod
```

Production: https://empowerhealth.netlify.app

---

## AI assistant instructions

`CLAUDE.md` contains instructions for the Claude Code AI assistant. It is not developer documentation. For developer docs, see [empower-react/README.md](empower-react/README.md).
