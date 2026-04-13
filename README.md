## WattWhere Next.js App

Self-contained Next.js app with:

- Dashboard frontend (single page)
- API routes for users/sessions/recommendations
- Postgres access through Supabase

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env.local` and fill values:

- `SUPABASE_DB_URL` (use Supabase session pooler URI, usually port `6543`)

## API Endpoints

- `GET /api/users`
- `GET /api/users/{userId}`
- `GET /api/users/{userId}/sessions`
- `GET /api/users/{userId}/recommendations`

## Deploy

Deploy directly on Vercel as a standard Next.js project.
Set the same env vars in Vercel Project Settings.
