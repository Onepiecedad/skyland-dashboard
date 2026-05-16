# Skyland Dashboard — Status

**Senast uppdaterad:** 2026-05-16  
**Version:** v0 — komplett lokalt

---

## Vad som är klart (v0)

- **Auth** — Magic link via email (Supabase Auth). Fungerar lokalt.
- **LeadsPage** — Visar prospects från Supabase i realtid. Status-hantering, score-badges, AI-svar expanderbara. Realtime-subscription på nya leads.
- **EngagementsPage** — Visar klient-projekt (5 seeded: Hasselblads Livs, MarinMekaniker, Björn Olsson, Cold Experience, Tankrengöring.se).
- **Navigation** — Leads ↔ Engagements i gemensam navbar.
- **Databas** — Migration `001_dashboard_v0.sql` körd mot produktion. Tabeller: `engagements`, `activity_log`. Kolumner `status` och `updated_at` tillagda på `prospects`. RLS korrekt.

---

## Vad som återstår

1. **Netlify-deploy** — Bygg och deploya till `dashboard.skylandai.se`
2. **DNS** — Koppla `dashboard.skylandai.se` i Netlify + domänregistraren
3. **GDPR privacy policy-sida** — Länkas från consent-checkbox i void-formuläret (skylandai.se, inte dashboarden)
4. **Produktions-URL i Supabase** — Lägg till `https://dashboard.skylandai.se` i Authentication → URL Configuration → Redirect URLs

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
- Deploy target: Netlify
