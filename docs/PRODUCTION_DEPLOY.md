# Produkcijski Deploy — Checklist

Sve migracije, edge funkcije i seed podaci su lokalno testirani i gotovi.
Slijedi 10 koraka za deploy na Supabase produkcijsku instancu.

---

## Preduvjeti

- Supabase account na https://supabase.com
- Supabase CLI: `npx supabase` (dostupno putem `sg docker -c "npx supabase ..."`)
- Resend account i API ključ (za email notifikacije)

---

## Korak 1 — Kreiraj Supabase projekt

Idi na https://supabase.com/dashboard → **New project**.

Zabilježi:
- **Project URL**: `https://<project-ref>.supabase.co`
- **Anon key** (u novom UI-u zvan "Publishable key")
- **Service role key** (u novom UI-u zvan "Secret key")
- **DB password**
- **Project ref** (subdomena iz URL-a: `https://supabase.com/dashboard/project/<project-ref>`)

---

## Korak 2 — Poveži lokalni projekt s produkcijskim

```bash
sg docker -c "npx supabase link --project-ref <project-ref>"
```

Zamijeni `<project-ref>` s vrijednošću iz Koraka 1.
Zahtijeva interaktivnu autentikaciju (browser ili token).

---

## Korak 3 — Omogući pg_cron i pg_net ekstenzije

U Supabase dashboardu:
**Database → Extensions** → pretraži `pg_cron` → **Enable**.
Ponovi za `pg_net`.

> **Važno:** Ovaj korak mora biti napravljen PRIJE `db push`. Migracija `20260425161232_auto_close_cron.sql` poziva `CREATE EXTENSION pg_cron` — na Supabase managed instancama ekstenzija mora biti odobrena u dashboardu prije nego migracija može uspješno završiti.

---

## Korak 4 — Pushaj migracije na produkciju

```bash
sg docker -c "npx supabase db push"
```

Ovo primjenjuje svih 5 migracija na produkcijsku bazu:
1. `20260425071654_create_tables.sql`
2. `20260425072033_rls_policies.sql`
3. `20260425072508_handle_rfid_scan.sql`
4. `20260425073135_prevent_duplicate_open_sessions.sql`
5. `20260425161232_auto_close_cron.sql`

> **Napomena:** Migracije se ne mogu automatski poništiti. U slučaju greške, kontaktiraj Supabase podršku za point-in-time recovery (dostupno na Pro planu).

---

## Korak 5 — Konfiguriraj database settings za auto-close email

U Supabase **SQL Editoru** izvrši:

```sql
ALTER DATABASE postgres
  SET app.edge_function_url = 'https://<project-ref>.supabase.co/functions/v1';
ALTER DATABASE postgres
  SET app.service_role_key = '<service-role-key>';
```

Zamijeni `<project-ref>` i `<service-role-key>` s vrijednostima iz Koraka 1.

> **Sigurnost:** Ova postavka je vidljiva Postgres superkorisnicima putem `SELECT current_setting('app.service_role_key')`. Nemoj je smatrati zamjenom za Vault — koristi je samo za pg_net HTTP pozive unutar baze.

---

## Korak 6 — Postavi Edge Function secrets

```bash
sg docker -c "npx supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxxxxx \
  ADMIN_EMAIL=admin@yourdomain.com \
  FROM_EMAIL=noreply@yourdomain.com"
```

> Za testiranje: `FROM_EMAIL=onboarding@resend.dev` i `ADMIN_EMAIL` mora biti registriran Resend account email.
> Za produkciju: `FROM_EMAIL` mora biti s verificirane Resend domene.

---

## Korak 7 — Deploji Edge Function

```bash
sg docker -c "npx supabase functions deploy send_email"
```

Očekivani output: `Deployed Function send_email`

---

## Korak 8 — Kreiraj admin korisnika na produkciji

U Supabase dashboardu **Authentication → Users → Add user**:
- Email: `admin@rfid-bp.local`
- Password: (jak lozinka, NE `admin123`)
- Email confirmed: ✓

Zatim u **SQL Editoru**:

```sql
INSERT INTO employees (id, ime_prezime, rfid_uid, username, role)
SELECT id, 'Administrator', 'ADMIN-RFID-0001', 'admin', 'admin'
FROM auth.users
WHERE email = 'admin@rfid-bp.local'
ON CONFLICT (id) DO NOTHING;
```

---

## Korak 9 — Verificiraj cron job

U **SQL Editoru**:

```sql
SELECT jobname, schedule, command FROM cron.job;
```

Očekivani rezultat: red s `auto-close-sessions` i rasporedom `*/5 * * * *`.

---

## Korak 10 — Zabilježi produkcijske ključeve

Pohrani u sigurno mjesto (npr. password manager ili `.env.production.local` koji NIJE u gitu):

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

---

## Status

- [ ] Projekt kreiran na dashboardu
- [ ] `supabase link` izvršen
- [ ] pg_cron i pg_net ekstenzije omogućene u dashboardu
- [ ] `supabase db push` — 5 migracija primijenjeno
- [ ] Database settings konfigurirani
- [ ] Edge Function secrets postavljeni
- [ ] `send_email` funkcija deployana
- [ ] Admin korisnik kreiran
- [ ] Cron job verificiran (`SELECT jobname, schedule, command FROM cron.job`)
- [ ] Produkcijski ključevi pohranjeni u password manageru
