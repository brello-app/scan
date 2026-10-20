# Brello Scan

Brello is exported as a static Next.js site for Cloudflare Pages. pnpm build creates the deployable files in out/. CSV parsing and scan results run in the visitor's browser.


## Local development

Set `NEXT_PUBLIC_WAITLIST_URL` in `.env.local` (or an untracked `.env`) to the deployed Google Apps Script web app URL, then run `pnpm dev`.

The URL is public and is embedded in the browser bundle at build time. The waitlist form sends JSON directly to Apps Script; no local or Pages Function proxy is used.

## Cloudflare Pages deployment

Configure the project with:

- Framework preset: Next.js (Static HTML Export)
- Build command: pnpm build
- Build output directory: out

Set `NEXT_PUBLIC_WAITLIST_URL` as a build environment variable for both Production and Preview. Because it starts with `NEXT_PUBLIC_`, Next.js embeds it in the static browser bundle at build time; treat it as public, not as a secret. Set the same value locally in `.env.local`. The Google Apps Script deployment must allow access to anyone.

The browser sends JSON to Apps Script as a `text/plain` POST to avoid a CORS preflight. The browser cannot read the cross-origin response, so the form can show network failures but cannot confirm application-level errors returned by the script.