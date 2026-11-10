# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Project decisions (2026-11-10)

- Required frontend stack: React + TypeScript + Ant Design. Use Recharts for charts.
- This folder is an independent Git repository. Do not include the parent workspace's business data or database credentials.
- The user explicitly approved building a clickable prototype directly and checking it with local Chrome because image generation and an in-app browser were unavailable. No selected image mock exists for fidelity comparison.
- Default to the previous calendar month. Keep all three perspectives: containers, shipping services, Amazon warehouses.
- Distinguish company channel (`channel`) from carrier service (`route` here). Container and service timing ends at devanning; Amazon timing ends at actual delivery.
- Use clearly labeled synthetic data until a production API is explicitly connected. Do not publish customer records or claim these metrics are live.
- The user will create the GitHub repository later; push only after the repository URL is supplied.

## Full-stack decisions (2026-11-10)

- User supplied and authorized pushing to https://github.com/wangchiwcb-dot/freight-forwarder-effectiveness. Aliyun deployment is explicitly a later decision.
- Repository root remains this historical `frontend/` folder; it now includes the backend in `server/`, shared types in `shared/`, and SQL in `database/`.
- Backend is Node.js + TypeScript + Fastify; production uses existing PostgreSQL views. Do not write to the live database or change publication flags while implementing read APIs.
- Frontend must fetch the API; never silently fall back to bundled fixtures when the backend fails.
- Synthetic data belongs only in the explicit server demo adapter. Different metrics have independent valid denominators; stacked stages use a common complete subset.
- Run production build before browser tests. Browser tests start the built application on 4175; keep 4173 available for user preview.

## Deployment decisions (2026-11-10)

- User explicitly authorized deployment to the existing Alibaba Cloud server under a subdomain of omfreight.vip. Server metadata confirms cn-hongkong. Use transit.omfreight.vip.
- Deploy with Nginx HTTPS, a dedicated unprivileged systemd service, and a read-only database login. Keep application and PostgreSQL listeners on loopback.
- Initial deployment preserved publication flags. The later explicit publication authorization below supersedes that initial restriction for the current records.
- Trust forwarding headers only from the local reverse proxy, which must overwrite X-Forwarded-For.

## Publication and future administration (2026-11-10)

- The user explicitly authorized publishing all 2,936 currently stored shipments. Back up first and preserve per-record publication timestamps, actor, and before/after audit entries. Keep source business fields unchanged.
- This is a one-time publication of existing data. Keep new records unpublished by default and retain the API's published/valid/active/sea filters. Cancelled, non-sea, or invalid metric samples do not become chart samples merely because their publication flag is true.
- The user plans a management system to edit data and explicitly confirm publication before it appears on this frontend, followed by login capabilities. Record this direction; do not implement that separate management/login scope until requested.
