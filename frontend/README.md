# Speedboat Deployment Wizard

Frontend for the Senior Full-Stack UI/UX take-home, focused on Path 3: Model Deployment Wizard.

## Run locally

From the repo root, start the mock:

```bash
cp .env.example .env
docker compose up
```

In another terminal:

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Configuration

- `PARASAIL_BASE_URL`: mock or real Parasail API base URL used by the Next.js proxy.
- `PARASAIL_API_KEY`: bearer token attached by the Next.js proxy.
- `NEXT_PUBLIC_SPEEDBOAT_API_BASE_PATH`: browser-facing API path, defaulting to `/api/parasail`.

The app uses a thin same-origin Next.js proxy so browser requests avoid CORS preflight issues and the bearer token stays server-side.
