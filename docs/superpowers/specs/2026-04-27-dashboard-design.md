# React Admin Dashboard — Design Doc

**Datum:** 2026-04-27
**Status:** Odobreno

---

## Pregled

React admin dashboard za RFID sustav evidencije radnog vremena. Admin se prijavljuje korisničkim imenom i lozinkom, pregledava tko je na poslu, upravlja zaposlenicima i sesijama, te generira izvještaje s grafovima i Excel exportom. Sučelje je u potpunosti na hrvatskom jeziku.

**Opseg ovog plana:** samo admin panel. Employee view (`/moje-sate`) dolazi u zasebnom planu.

---

## Tech stack

| Komponenta | Tehnologija |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| Routing | TanStack Router v1 |
| Server state | TanStack Query v5 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Grafovi | Recharts |
| Excel export | xlsx |
| Backend klijent | @supabase/supabase-js |
| Deploy | Vercel |

---

## Struktura projekta

```
frontend/
├── src/
│   ├── routes/
│   │   ├── __root.tsx              # root layout, auth guard, nav
│   │   ├── login.tsx
│   │   ├── index.tsx               # redirect → /dashboard
│   │   ├── dashboard.tsx
│   │   ├── zaposlenici/
│   │   │   ├── index.tsx           # lista zaposlenika
│   │   │   ├── novi.tsx            # dodaj zaposlenika
│   │   │   └── $id.edit.tsx        # uredi zaposlenika
│   │   ├── sesije/
│   │   │   ├── index.tsx           # sve sesije + filteri
│   │   │   └── $id.edit.tsx        # ručno ispravljanje sesije
│   │   └── izvjestaji.tsx          # grafovi + Excel export
│   ├── lib/
│   │   ├── supabase.ts             # Supabase klijent (anon key)
│   │   ├── queries/
│   │   │   ├── employees.ts        # useEmployees, createEmployee, updateEmployee, deleteEmployee
│   │   │   ├── sessions.ts         # useActiveSessions, useAutoClosedAlerts, useSessions, updateSession
│   │   │   └── reports.ts          # useMonthlyReport
│   │   └── utils.ts                # cn(), formatMinutes(), formatDateTime()
│   ├── components/ui/              # shadcn/ui komponente
│   └── main.tsx
├── .env.local                      # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── vite.config.ts
└── package.json
```

---

## Auth flow

- Login forma: polje `username` + `password`
- Frontend konstruira interni email: `` `${username}@rfid-bp.local` ``
- Poziva `supabase.auth.signInWithPassword({ email, password })`
- Nakon prijave dohvaća `role` iz tablice `employees` gdje `id = auth.uid()`
- `__root.tsx` provjerava sesiju na svakom rendu — neprijavljeni → redirect na `/login`
- `useAuth()` hook wrapa `supabase.auth.getUser()` + `onAuthStateChange`, role se cachea u TanStack Query

---

## Admin stranice

### `/dashboard`

- Tri stat kartice: aktivni zaposlenici danas, trenutno prijavljeni (clock_out IS NULL), broj upozorenja za auto-closed sesije
- Alert banner (narančast) za sesije s `is_auto_closed = true` — svaki redak linkuje na `/sesije/$id.edit`. Nema zasebnog "potvrđeno" stanja — ako admin ispravi clock_out, sesija ostaje označena kao auto-closed ali je vidljivo da je uređena.
- Tablica: tko je trenutno prijavljen — ime, clock_in vrijeme

### `/zaposlenici`

- Tablica: ime_prezime, username, rfid_uid, role, akcije (uredi / briši)
- Gumb "Dodaj zaposlenika" → `/zaposlenici/novi`
  - Polja: ime_prezime, username, password, rfid_uid, role (admin | employee)
- `/zaposlenici/$id.edit`: isti obrazac, password polje opcionalno (prazno = bez promjene)
- Brisanje: confirm dialog; ako zaposlenik ima otvorenu sesiju (clock_out IS NULL), upozorenje s potvrdom force-close

### `/sesije`

- Tabovi: zadnjih 12 mjeseci
- Tablica po tabu: Datum | Zaposlenik | Dolazak | Odlazak | Trajanje | Status
- Status badge: "auto-zatvoreno" za `is_auto_closed = true`
- Filteri: po zaposleniku (dropdown), po datumu (date range picker)
- Klik na redak → `/sesije/$id.edit`: obrazac za ispravak clock_in / clock_out, recalculate duration_min

### `/izvjestaji`

- Month picker na vrhu
- Graf 1 (Recharts bar): sati po danima u odabranom mjesecu
- Graf 2 (Recharts bar): ukupni sati po zaposleniku u odabranom mjesecu
- Export: "Izvezi mjesec" (jedan sheet) i "Izvezi godinu" (12 sheetova, jedan po mjesecu)
- Stupci u Excelu: Datum, Zaposlenik, Dolazak, Odlazak, Sati

---

## Data layer

Svi upiti i mutacije idu kroz TanStack Query. Supabase pozivi su u `src/lib/queries/`.

### Queries

| Hook | Opis |
|---|---|
| `useEmployees()` | `SELECT * FROM employees ORDER BY ime_prezime` |
| `useActiveSessions()` | Sesije gdje `clock_out IS NULL`, JOIN employees |
| `useAutoClosedAlerts()` | Sesije gdje `is_auto_closed = true`, JOIN employees |
| `useSessions(month, employeeId?)` | Sesije za odabrani mjesec, opcionalni filter po zaposleniku |
| `useMonthlyReport(month)` | Agregirani sati po danu i po zaposleniku |

### Mutacije

| Mutacija | Opis |
|---|---|
| `createEmployee` | Edge function `manage_employee` (create) → auth.users + employees |
| `updateEmployee` | Edge function `manage_employee` (update) → employees, opcionalno reset lozinke |
| `deleteEmployee` | Edge function `manage_employee` (delete) → briše auth.users (CASCADE na employees) |
| `updateSession` | UPDATE work_sessions, recalculate duration_min |

### manage_employee Edge Function

Upravljanje korisnicima (create / update password / delete) zahtijeva `service_role` ključ koji **ne smije biti u browseru**. Rješenje je Supabase Edge Function `manage_employee` koji prima akciju i parametre, izvršava Admin API pozive server-side, te vraća rezultat. Poziva se s `anon` ključem — autorizacija se provjerava unutar funkcije pomoću `auth.uid()` i provjere admin role.

---

## Error handling

| Situacija | Ponašanje |
|---|---|
| Pogrešne credentials | Inline poruka na login formi |
| Network error (query) | TanStack Query retry 3x → toast "Greška pri dohvatu podataka" |
| Mutation error | Inline greška ispod polja ako validacija; toast za server greške |
| clock_out < clock_in | Klijentska validacija blokira submit; DB constraint kao backup |
| Brisanje s otvorenom sesijom | Warning dialog s potvrdom force-close |
| Prazni podaci | Empty state poruke s akcijskim gumbima |
| Učitavanje | shadcn Skeleton komponente |

---

## Environment varijable

```
VITE_SUPABASE_URL=https://uxobtkrzmxkaiekxkhik.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-key>
```

`.env.local` je gitignored. Za Vercel deploy, iste varijable se postavljaju u project settings.
