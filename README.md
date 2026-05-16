# Skyland Dashboard

Operativ dashboard för Skyland AI. Visar leads från void-submission-flödet i realtid och hanterar aktiva klient-engagements.

## Stack

- React 19 (Create React App / CRACO)
- Tailwind CSS
- Radix UI
- Supabase (Auth + Realtime + Postgres)
- TanStack React Query
- Lucide Icons

## Utveckling

```bash
cd frontend
yarn install
yarn start
```

Kräver `.env` med:
```
REACT_APP_SUPABASE_URL=https://ydlpqlrcriayzgtxzmvy.supabase.co
REACT_APP_SUPABASE_ANON_KEY=...
```

## Deployment

Netlify → `dashboard.skylandai.se`
