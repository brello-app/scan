# Brello Scan

Brello is exported as a static Next.js site for Cloudflare Pages. pnpm build creates the deployable files in out/. CSV parsing and scan results run in the visitor's browser.

## Local development

Run the UI with pnpm dev.

Next.js dev mode does not run Cloudflare Pages Functions. To test the waitlist endpoint locally, create an untracked .dev.vars file with the WAITLIST_URL value, then run pnpm build followed by pnpm dlx wrangler pages dev out.

## Cloudflare Pages deployment

Configure the project with:

- Framework preset: Next.js (Static HTML Export)
- Build command: pnpm build
- Build output directory: out

The waitlist form posts to /api/waitlist, handled by functions/api/waitlist.ts. Add WAITLIST_URL as a Pages Function secret for both Production and Preview. It must point to the HTTPS Google Apps Script web app URL.

The browser sends the form to the same Brello origin. The Pages Function forwards it to Apps Script, so the browser does not make a cross-origin request.