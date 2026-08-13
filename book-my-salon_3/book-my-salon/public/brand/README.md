# Brand assets

`src/components/Logo.tsx` currently draws the wordmark as inline SVG so the
app never depends on an image file existing. Drop your real exported files
here and swap them into `Logo.tsx` / `app/layout.tsx` metadata when you want
pixel-exact artwork instead of the SVG approximation:

- `logo-dark.svg` / `.png` — primary logo (light backgrounds)
- `logo-light.svg` / `.png` — alternate logo (dark backgrounds)
- `app-icon.png` — 512×512 app icon
- `favicon.ico` / `icon.png` — browser tab icon (Next.js picks up
  `src/app/icon.png` automatically)
