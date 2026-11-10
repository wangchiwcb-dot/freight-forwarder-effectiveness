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
