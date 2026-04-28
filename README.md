## WattWhere Next.js App

Next.js dashboard + API backed by MySQL (Cloud SQL on GCP).

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env.local` for local development.

- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_SOCKET_PATH`
- `DB_CONNECTION_LIMIT` (optional)
- `DB_SSL` (set `true` for local TCP to Cloud SQL when SSL-only is enabled)

## API Endpoints

- `GET /api/users`
- `GET /api/users/{userId}`
- `GET /api/users/{userId}/sessions`
- `GET /api/users/{userId}/recommendations`

## DB Management UI

Use the in-app page `http://localhost:3000/db` to manage database state with confirmation modal prompts:

- `Create DB + Schema`
- `Seed Data`
- `Drop Database`
- `Reset Database` (drop -> create -> seed)

Implementation files:

- DB admin API route: `src/app/api/admin/db/route.js`
- DB admin logic: `src/lib/dbAdmin.js`
- Schema SQL source: `data/sql/schema.sql`
- Seed JSON source: `data/generated/*.json`

Optional:

- set `DB_SEED_DIR` in env to load seed JSON from a different folder.

## Deploy

Using Cloud SQL instance `cs411-team14:us-central1:cs411-014`.

One-time setup:

```bash
gcloud config set project cs411-team14
```

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com
```

First deploy:

```bash
gcloud run deploy wattwhere-next \
  --project cs411-team14 \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances cs411-team14:us-central1:cs411-014 \
  --set-env-vars "DB_USER=YOUR_DB_USER,DB_PASSWORD=YOUR_DB_PASSWORD,DB_NAME=cs411,DB_CONNECTION_LIMIT=5,DB_SOCKET_PATH=/cloudsql/cs411-team14:us-central1:cs411-014"
```

Get service URL:

```bash
gcloud run services describe wattwhere-next --region us-central1 --format='value(status.url)'
```

## Re-Deploy

After code changes:

```bash
gcloud run deploy wattwhere-next \
  --project cs411-team14 \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances cs411-team14:us-central1:cs411-014 \
  --set-env-vars "DB_USER=YOUR_DB_USER,DB_PASSWORD=YOUR_DB_PASSWORD,DB_NAME=cs411,DB_CONNECTION_LIMIT=5,DB_SOCKET_PATH=/cloudsql/cs411-team14:us-central1:cs411-014"
```

If only env vars changed:

```bash
gcloud run services update wattwhere-next \
  --region us-central1 \
  --set-env-vars "DB_USER=YOUR_DB_USER,DB_PASSWORD=YOUR_DB_PASSWORD,DB_NAME=cs411,DB_CONNECTION_LIMIT=5,DB_SOCKET_PATH=/cloudsql/cs411-team14:us-central1:cs411-014"
```
