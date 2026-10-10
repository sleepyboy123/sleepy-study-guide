# PWA Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the `implementing` skill to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Sleepy Study Guide into an installable, offline-capable Progressive Web App.

**System Architecture:** Purely additive — a Vite build plugin generates a service worker and manifest at build time. No changes to React components, routing, or state management. All quiz data is already bundled statically, so precaching the build output gives complete offline support.

**Tech Stack:** Vite 8, React 19, vite-plugin-pwa (Workbox-based)

## Global Constraints

- Proof-of-concept maturity — keep configuration minimal, no advanced caching strategies
- No component code changes — this is config and assets only
- Existing CSP meta tag in index.html must be preserved and extended, not replaced
- Icons can be simple placeholders for now

---

### Task 1: Install and configure vite-plugin-pwa

**Files:**
- Modify: `package.json` (add devDependency)
- Modify: `vite.config.js` (add VitePWA plugin with manifest config)
- Modify: `index.html` (add theme-color meta, add worker-src to CSP)
- Create: `public/pwa-192x192.png` (PWA icon — 192x192)
- Create: `public/pwa-512x512.png` (PWA icon — 512x512)

**Interfaces:**
- Consumes: nothing (first and only task)
- Produces: a working PWA — installable via browser, fully offline-capable

- [x] **Step 1: Install vite-plugin-pwa**

Run:
```bash
npm install -D vite-plugin-pwa
```

- [x] **Step 2: Configure VitePWA in vite.config.js**

Update `vite.config.js` to import and add the VitePWA plugin:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,png,svg,ico,woff,woff2}'],
      },
      manifest: {
        name: 'Sleepy Study Guide',
        short_name: 'StudyGuide',
        description: 'Quiz app for AWS certification exam prep',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
```

Key choices:
- `registerType: 'autoUpdate'` — service worker updates silently without prompting the user
- `globPatterns` — precache all static assets including JSON question data and screenshot PNGs
- `theme_color: '#0f172a'` — Tailwind's slate-900, matches the app's dark aesthetic
- `display: 'standalone'` — opens without browser chrome for an app-like feel

- [x] **Step 3: Update index.html**

Add a `<meta name="theme-color">` tag and extend the existing CSP with `worker-src 'self'`.

The CSP line currently reads:
```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;
```

Update it to:
```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; worker-src 'self';
```

Add this line after the viewport meta tag:
```html
<meta name="theme-color" content="#0f172a" />
```

Note: `vite-plugin-pwa` auto-injects the `<link rel="manifest">` tag at build time — do NOT add it manually.

- [x] **Step 4: Create placeholder PWA icons**

Generate two minimal placeholder PNG icons using a Node script (no external tooling needed). The icons should be a solid colored square with "SSG" text — enough to pass PWA installability checks.

Since this is a PoC, create minimal valid PNG icons programmatically. Write a small Node script (`scripts/generate-icons.js`) that produces solid-colored squares at 192x192 and 512x512 using raw PNG binary construction (no dependencies needed — use the minimal PNG spec: IHDR + IDAT with uncompressed deflate + IEND). Use background color `#0f172a` (slate-900) to match the theme.

Alternatively, if programmatic PNG generation proves fiddly, create simple icons using Python's Pillow (`pip install Pillow`) or any image tool already on the machine. The only hard requirement: two valid PNG files at `public/pwa-192x192.png` (192x192) and `public/pwa-512x512.png` (512x512).

After generating, verify the files are valid PNGs and the correct dimensions.

- [x] **Step 5: Build and verify manifest generation**

Run:
```bash
npm run build
```

After the build, verify these files exist in `dist/`:
- `manifest.webmanifest` — the generated web app manifest
- `sw.js` — the generated Workbox service worker
- `registerSW.js` — the service worker registration script

Check the manifest content:
```bash
cat dist/manifest.webmanifest
```

Verify it contains the correct `name`, `icons`, `theme_color`, and `display` fields.

- [x] **Step 6: Test PWA in browser**

Run:
```bash
npm run preview
```

Open Chrome at `http://localhost:4173` (Vite preview's default port) and verify:

1. **DevTools → Application → Manifest**: manifest loads with correct name and icons
2. **DevTools → Application → Service Workers**: service worker is registered and active
3. **Install prompt**: Chrome shows the install icon in the address bar (or the "Install app" option in the menu)
4. **Offline test**: In DevTools → Network, check "Offline", then reload — the app should still render and function (quiz navigation, answering questions, viewing dashboard)
5. **localStorage persistence**: After going offline, quiz state (answers, settings) should persist across page reloads — this already works via localStorage but confirm it's not broken by the service worker
