# Skyland Dashboard — Status

**Senast uppdaterad:** 2026-05-17  
**Version:** v0 — live på dashboard.skylandai.se

---

## Vad som är klart (v0)

- **Auth** — Magic link via email (Supabase Auth). Fungerar i produktion.
- **LeadsPage** — Visar prospects från Supabase i realtid. Status-hantering, score-badges, AI-svar expanderbara. Realtime-subscription på nya leads.
- **EngagementsPage** — Visar klient-projekt (5 seeded: Hasselblads Livs, MarinMekaniker, Björn Olsson, Cold Experience, Tankrengöring.se).
- **Navigation** — Leads ↔ Engagements i gemensam navbar.
- **Databas** — Migration `001_dashboard_v0.sql` körd mot produktion. Tabeller: `engagements`, `activity_log`. Kolumner `status` och `updated_at` tillagda på `prospects`. RLS korrekt.

---

## Deploy

- **Netlify** — `skyland-dashboard` → `dashboard.skylandai.se` ✅
- **DNS** — CNAME i one.com: `dashboard` → `skyland-dashboard.netlify.app` ✅
- **Supabase Auth** — Site URL + Redirect URLs satta till `https://dashboard.skylandai.se` ✅
- **SSL** — Let's Encrypt via Netlify ✅

---

## Vad som återstår

1. **GDPR privacy policy-sida** — Länkas från consent-checkbox i void-formuläret (skylandai.se, inte dashboarden)

---

## Starta dev-servern

```bash
cd frontend
yarn install   # första gången
yarn start     # startar på localhost:3000
```

Kräver en `.env`-fil i `frontend/`:

```
REACT_APP_SUPABASE_URL=https://ydlpqlrcriayzgtxzmvy.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<din anon key>
DISABLE_ESLINT_PLUGIN=true
```

**Anon key** hämtas från Supabase Dashboard:  
`supabase.com/dashboard/project/ydlpqlrcriayzgtxzmvy/settings/api`  
→ **Project API Keys → anon public**

`.env` är gitignorerad och ska aldrig committas.

---

## Stack

- React 19 + CRACO + Tailwind CSS + Radix UI
- Supabase Auth (magic link) + Realtime + PostgreSQL
- TanStack React Query, Sonner toasts, date-fns/sv, Lucide icons
- Deployed: Netlify → dashboard.skylandai.se
