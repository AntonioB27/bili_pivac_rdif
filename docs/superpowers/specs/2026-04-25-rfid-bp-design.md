# RFID Evidencija Radnog Vremena — Design Doc

**Datum:** 2026-04-25
**Status:** Odobreno

---

## Pregled

Digitalni sustav za evidenciju radnog vremena temeljen na RFID tehnologiji. Zaposlenici prijavljuju/odjavljuju dolazak skeniranjem kartice na ESP32 uređaju s RC522 čitačem. Administrator prati podatke kroz React web aplikaciju. Cijelo sučelje je na hrvatskom jeziku.

**Opseg:** 10–30 zaposlenika, jedan objekt, jedan RFID uređaj.

---

## Tehnički stack

| Komponenta | Tehnologija |
|---|---|
| Hardware | ESP32 + RC522 (SPI) |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions + pg_cron) |
| Frontend | React + TypeScript + Vite, deploy na Vercel |
| Email | Resend (putem Supabase Edge Function) |
| Grafovi | Recharts |
| Excel export | xlsx |
| Styling | Tailwind CSS |
| State management | TanStack Query |

---

## Arhitektura sustava

```
ESP32 (RC522)
    │
    │ HTTP POST /rest/v1/rpc/handle_rfid_scan
    │ { uid, timestamp }
    ▼
Supabase
    ├── PostgreSQL
    │     ├── employees
    │     ├── work_sessions
    │     ├── handle_rfid_scan()  (RPC, SECURITY DEFINER)
    │     └── pg_cron job         (svakih 5 min — auto-close 12h)
    │
    ├── Edge Function: send_email
    │     └── poziva Resend API
    │
    └── Auth (username + password)

React (Vercel)
    └── Supabase JS klijent
          ├── Admin view
          └── Employee view
```

### Tok online skena

1. ESP32 skenira karticu → šalje `{ uid, local_timestamp }` na `/rpc/handle_rfid_scan`
2. PostgreSQL funkcija atomično pronalazi zaposlenika, provjerava aktivnu sesiju, otvara ili zatvara
3. Funkcija vraća status: `clock_in` | `clock_out` | `too_soon` | `not_found`
4. ESP32 treperi LED bojom prema odgovoru

### Tok offline skena

1. Nema interneta → ESP32 sprema scan u LittleFS red čekanja
2. Kad se veza vrati → šalje nakupljene skenove kronološkim redom

---

## Baza podataka

### Tablice

```sql
employees
  id            uuid PRIMARY KEY  -- isti UUID kao auth.users.id
  ime_prezime   text NOT NULL
  rfid_uid      text UNIQUE NOT NULL
  username      text UNIQUE NOT NULL
  role          text NOT NULL DEFAULT 'employee'  -- 'admin' | 'employee'
  created_at    timestamptz DEFAULT now()
  -- password u Supabase Auth (auth.users), employees.id = auth.users.id
  -- Supabase Auth zahtijeva email: koristimo "{username}@rfid-bp.local" kao interni format
  -- Frontend prijave koriste samo username polje, email se konstruira programski

work_sessions
  id              uuid PRIMARY KEY
  employee_id     uuid REFERENCES employees(id)
  clock_in        timestamptz NOT NULL
  clock_out       timestamptz
  duration_min    integer       -- zaokruženo na 15 min, NULL dok je sesija otvorena
  is_auto_closed  boolean DEFAULT false
  work_date       date NOT NULL -- datum clock_in (pokriva noćne smjene)
  created_at      timestamptz DEFAULT now()

```

### Pravila

- `work_date` = datum `clock_in` — noćna smjena (17:00–01:00) vodi se pod danom početka
- `duration_min` se postavlja pri `clock_out`: `ROUND(minutes / 15.0) * 15`
- `is_auto_closed = true` označava sesije zatvorene pg_cron jobom

### RLS politike

```
employees:
  SELECT → svi authenticated korisnici
  INSERT/UPDATE/DELETE → samo admin

work_sessions:
  SELECT → admin vidi sve; employee vidi samo svoje (employee_id = auth.uid())
  UPDATE → samo admin
  INSERT → samo SECURITY DEFINER funkcija (handle_rfid_scan)

handle_rfid_scan (RPC):
  EXECUTE → GRANT na anon rolu (ESP32 poziva s anon ključem)
```

---

## Backend logika

### `handle_rfid_scan(uid text, scanned_at timestamptz)` — RPC funkcija

Izvršava se kao `SECURITY DEFINER`. Vraća `jsonb` s poljem `status`.

```
1. Pronađi zaposlenika po rfid_uid
   → nije pronađen: vrati { status: 'not_found' }

2. Pronađi otvorenu sesiju (clock_out IS NULL) za zaposlenika

3. Nema otvorene sesije → CLOCK IN
   - INSERT u work_sessions (clock_in = scanned_at, work_date = date(scanned_at))
   - Vrati { status: 'clock_in', ime: ... }

4. Postoji otvorena sesija → provjeri zaštitu
   - (scanned_at - clock_in) < 60 min → vrati { status: 'too_soon' }
   - Inače → CLOCK OUT
       - duration_min = ROUND(EXTRACT(EPOCH FROM (scanned_at - clock_in)) / 60 / 15) * 15
       - UPDATE work_sessions SET clock_out, duration_min, work_date
       - Vrati { status: 'clock_out', ime: ..., duration_min: ... }
```

### pg_cron job — auto-close (svakih 5 minuta)

```sql
SELECT cron.schedule('auto-close-sessions', '*/5 * * * *', $$
  WITH closed AS (
    UPDATE work_sessions ws
    SET
      clock_out      = ws.clock_in + interval '12 hours',
      duration_min   = 720,
      is_auto_closed = true
    WHERE ws.clock_out IS NULL
      AND ws.clock_in < NOW() - interval '12 hours'
    RETURNING ws.id, ws.employee_id, ws.clock_in,
              ws.clock_in + interval '12 hours' AS clock_out
  )
  SELECT net.http_post(
    url     := current_setting('app.edge_function_url') || '/send_email',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || current_setting('app.service_role_key')
               ),
    body    := jsonb_build_object(
                 'session_id',   c.id,
                 'employee_id',  c.employee_id,
                 'ime_prezime',  e.ime_prezime,
                 'clock_in',     c.clock_in,
                 'clock_out',    c.clock_out
               )
  )
  FROM closed c
  JOIN employees e ON e.id = c.employee_id;
$$);
```
Koristi Supabase `pg_net` ekstenziju za HTTP poziv na Edge Function. `app.edge_function_url` i `app.service_role_key` se postavljaju kao Supabase database secrets (vault).

### Edge Function `send_email`

- Prima: ime zaposlenika, clock_in, clock_out
- Šalje email adminu putem Resend API-ja
- Template (HR): *"Sesija zaposlenika [ime] automatski zatvorena nakon 12 sati. Dolazak: [clock_in], Odjava: [clock_out]."*

---

## ESP32 firmware

### Biblioteke

- `MFRC522` — čitanje RC522
- `WiFiManager` — WiFi konfiguracija bez hardkodiranja
- `HTTPClient` — HTTP pozivi
- `LittleFS` — lokalna pohrana
- `ArduinoJson` — JSON serijalizacija

### Konfiguracija (`/config.json` u LittleFS)

```json
{
  "supabase_url": "https://xxx.supabase.co",
  "supabase_anon_key": "eyJ..."
}
```

### Tok programa

```
Pokretanje
  └── WiFiManager (spoji ili otvori hotspot za konfiguraciju)
        └── Učitaj config.json iz LittleFS
              └── Ulazi u glavnu petlju

Glavna petlja
  ├── Pokušaj sync pending offline skenova
  └── Čekaj RFID sken
        ├── Debounce: ignoriraj isti UID unutar 2 sekunde
        ├── Online?
        │     ├── DA → POST /rpc/handle_rfid_scan { uid, timestamp }
        │     │         └── LED feedback:
        │     │               clock_in   → zelena (2 sec)
        │     │               clock_out  → plava (2 sec)
        │     │               too_soon   → žuta (trepti 3x)
        │     │               not_found  → crvena (3 sec)
        │     └── NE → spremi u queue.json → bijela LED (1 sec)
        └── Čekaj novi sken
```

### Offline red čekanja (`/queue.json`)

- Maksimalno 500 zapisa
- Skenovi se šalju kronološkim redom pri sinkronizaciji
- Uspješno sinkronizirani zapisi se brišu

---

## Frontend

### Routing

```
/login                → prijava (admin i zaposlenici)
/                     → redirect prema roli

Admin:
  /dashboard          → pregled + upozorenja za auto-closed sesije
  /zaposlenici        → lista, dodaj, uredi, briši
  /sesije             → sve sesije, filteri, ručno uređivanje
  /izvjestaji         → tablice, grafovi, Excel export

Employee:
  /moje-sate          → vlastite sesije po mjesecima
```

### Dashboard (admin)

- Broj aktivnih zaposlenika danas
- Alert banner za auto-closed sesije (is_auto_closed = true bez admin potvrde)
- Prikaz tko je trenutno prijavljen (clock_out IS NULL)

### Tablica sesija

- Svaki mjesec = zaseban tab
- Stupci: Datum | Zaposlenik | Dolazak | Odlazak | Sati | Status
- Filteri: po zaposleniku, mjesecu, datumu
- Admin može ručno ispraviti clock_in / clock_out na sesiji

### Grafovi (Recharts)

- Stupčasti: sati po danima u odabranom mjesecu
- Stupčasti: ukupno sati po zaposleniku u odabranom mjesecu

### Excel export

- Cijela godina: jedan file, svaki mjesec = jedan sheet
- Ili samo odabrani mjesec
- Stupci: Datum, Zaposlenik, Dolazak, Odlazak, Sati

### Zaštita ruta

- `ProtectedRoute` komponenta čita `role` iz Supabase sesije
- Admin ne može ući na employee rute i obrnuto
- Neprijavljeni → redirect na `/login`

---

## Rubni slučajevi i zaštita

| Situacija | Ponašanje |
|---|---|
| Nepoznati RFID UID | `not_found`, crvena LED |
| Clock-out unutar 60 min od clock-in | `too_soon`, žuta LED |
| Sesija otvorena > 12 sati | pg_cron zatvara, email adminu, alert u dashboardu |
| Nestanak interneta | ESP32 sprema u LittleFS, sinkronizira kad veza vrati |
| Noćna smjena (npr. 17:00 – 01:00) | work_date = datum clock_in |
| Isti UID skeniran unutar 2 sec | debounce na ESP32, ignorira se |
