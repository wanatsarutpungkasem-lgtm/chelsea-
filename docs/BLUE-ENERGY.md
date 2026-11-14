# Blue Energy — local preview

React + React Three Fiber + Shader Gradient are integrated as a lazy-loaded island on index.html. Existing HTML routes and authentication are retained.

## Build

- Install pinned dependencies: `npm ci`
- Rebuild scene: `npm run build:energy`
- Verify site: `npm test`
- Preview: `PORT=4174 node scripts/preview.mjs`
- Open: http://127.0.0.1:4174/index.html#energy-title

Source: `src/blue-energy/`. Styles: `dist/assets/css/blue-energy.css`. Generated modules: `dist/assets/energy/`; keep boot and its hashed chunk together. Legal notices are included alongside the bundle. The build archives earlier generated modules in a timestamped /tmp directory.

The scene loads near the viewport, pauses when offscreen or the document is hidden, and follows reduced-motion settings. It has three color palettes and a pause/play control. Canvas pointer input is disabled so scrolling stays native. Render failures show a readable fallback.

Verified: 48 automated tests pass; desktop and 390px mobile render; color selection and pause/play state; no console errors during the browser check; no horizontal overflow in the mobile check. Actual low-power hardware and WebGL-disabled fallback still need device testing.

No deployment performed. This work does not complete the independent OAuth provider setup or change the database.


2026-11-13 visual revision: the crest and blue body now use a single sphere geometry and a custom GLSL material within ShaderGradientCanvas. The crest follows the same vertex deformation and mesh movement; the separate front-facing coin and orbit rings were removed. The motion is a gentle side-to-side turn to keep the crest readable. Desktop and 390px mobile render, pause, and palette changes were checked in-browser with no shader errors.
