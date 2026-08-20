# Next.js frontend

This directory contains the Next.js 16 App Router interface for Jal Jeevan
Swasthya.

## Development

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

The app runs at `http://localhost:3000`. Set `NEXT_PUBLIC_API_URL` to the
FastAPI origin, normally `http://localhost:8000` for local development.

## Checks

```powershell
npm run lint
npm run build
```

## Vercel

Create a Vercel project with this `frontend` directory as its root. Next.js is
auto-detected. Add `NEXT_PUBLIC_API_URL=https://your-api-project.vercel.app` to
the project environment and deploy.
