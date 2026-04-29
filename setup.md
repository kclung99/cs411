## WattWhere Next.js App Setup

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
- `DB_ADMIN_PASSWORD` (required for `/db` actions)
- `DB_HOST` (required for TCP mode; optional when `DB_SOCKET_PATH` is set)
- `DB_SOCKET_PATH`
- `DB_CONNECTION_LIMIT` (optional)
- `DB_SSL` (set `true` for local TCP to Cloud SQL when SSL-only is enabled)

## DB Management UI

Use the in-app page `http://localhost:3000/db` to manage database state. Every action requires `DB_ADMIN_PASSWORD`, and destructive actions also require typed confirmation:

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

Cloud SQL prerequisites (required for trigger + stored procedure install during DB seed/reset):

```bash
# allow non-SUPER users to create trigger/procedure when binary logging is enabled
gcloud sql instances patch cs411-014 \
  --database-flags=log_bin_trust_function_creators=on
```

```bash
# connect as root/admin and grant app user privileges on cs411
gcloud sql connect cs411-014 --user=root
```

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON cs411.* TO 'app_user'@'%';
GRANT TRIGGER, CREATE ROUTINE, ALTER ROUTINE, EXECUTE ON cs411.* TO 'app_user'@'%';
FLUSH PRIVILEGES;
SHOW GRANTS FOR 'app_user'@'%';
```

Cloud Run DB connection note:

- Current app code supports Unix socket mode directly (`DB_SOCKET_PATH`), so `DB_HOST` is optional in socket mode.
- If you are running an older deployed revision and DB Admin returns 500, set `DB_HOST=127.0.0.1` as a compatibility fallback, then redeploy.
- For source deploys, ensure `data/sql/*` and `data/generated/*` are included in the uploaded source. This repo uses `.gcloudignore` to keep those files available to DB Admin actions.

First deploy:

```bash
gcloud run deploy wattwhere-next \
  --project cs411-team14 \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances cs411-team14:us-central1:cs411-014 \
  --set-env-vars "DB_USER=YOUR_DB_USER,DB_PASSWORD=YOUR_DB_PASSWORD,DB_NAME=cs411,DB_ADMIN_PASSWORD=YOUR_DB_ADMIN_PASSWORD,DB_CONNECTION_LIMIT=5,DB_SOCKET_PATH=/cloudsql/cs411-team14:us-central1:cs411-014"
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
  --set-env-vars "DB_USER=YOUR_DB_USER,DB_PASSWORD=YOUR_DB_PASSWORD,DB_NAME=cs411,DB_ADMIN_PASSWORD=YOUR_DB_ADMIN_PASSWORD,DB_CONNECTION_LIMIT=5,DB_SOCKET_PATH=/cloudsql/cs411-team14:us-central1:cs411-014"
```

If only env vars changed:

```bash
gcloud run services update wattwhere-next \
  --region us-central1 \
  --set-env-vars "DB_USER=YOUR_DB_USER,DB_PASSWORD=YOUR_DB_PASSWORD,DB_NAME=cs411,DB_ADMIN_PASSWORD=YOUR_DB_ADMIN_PASSWORD,DB_CONNECTION_LIMIT=5,DB_SOCKET_PATH=/cloudsql/cs411-team14:us-central1:cs411-014"
```
