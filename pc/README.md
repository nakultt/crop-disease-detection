# PlantGuard — web app

The full documentation lives in the [project README](../README.md): features,
architecture, API, configuration, deployment, security and testing.

Quick reference:

```bash
# Needs MongoDB on localhost:27017; no .env file required.
npm install
npm run dev                    # http://localhost:3000

npm run lint && npm run typecheck && npm test
npm run build && npm run test:e2e
npm run admin:grant -- you@example.com

docker compose up -d --build   # app + MongoDB + Mailpit, no config

# Optional settings: copy .env.example to .env.local
```
