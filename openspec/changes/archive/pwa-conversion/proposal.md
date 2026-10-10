# Proposal: PWA Conversion

## Scoping Gate

- **Tool type:** Frontend
- **Audience/maturity:** Proof-of-concept / experiment
- **Scale:** A handful of users

## Why

The app is a static quiz tool with all data bundled at build time and state stored in
localStorage. Converting to a PWA makes it installable and fully offline-capable — useful
for studying without a connection. Since there are no API calls, the conversion is
minimal: add a manifest, generate a service worker that precaches the build output, and
provide icons.

## Scope

- Add `vite-plugin-pwa` with a precache-all strategy
- Configure a web app manifest (name, icons, theme color, display mode)
- Add PWA icons to `public/`
- Update `index.html` meta tags (theme-color) and CSP for service worker support
- No changes to React components, routing, or state management
