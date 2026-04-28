# ESP32 Firmware — Design Doc

**Datum:** 2026-04-28
**Status:** Odobreno

---

## Pregled

Arduino/PlatformIO firmware za ESP32-S3 s RC522 RFID čitačem. Zaposlenici skeniraju karticu; uređaj poziva Supabase RPC `handle_rfid_scan` i daje LED povratnu informaciju. Kad nema interneta, skenovi se čuvaju lokalno u LittleFS redu čekanja i šalju kad se veza vrati.

---

## Hardware

| Komponenta | Detalj |
|---|---|
| Board | ESP32-S3 DevKit |
| RFID čitač | RC522 (SPI) |
| LED | RGB LED (jedna komponenta, 3 PWM kanala) |

### Pinout

**RC522 (SPI2):**

| Signal | GPIO |
|---|---|
| MOSI | 11 |
| MISO | 13 |
| SCK | 12 |
| SS/CS | 10 |
| RST | 9 |

**RGB LED (LEDC PWM):**

| Kanal | GPIO |
|---|---|
| Red | 4 |
| Green | 5 |
| Blue | 6 |

---

## Tech stack

| Komponenta | Tehnologija |
|---|---|
| IDE | PlatformIO (VS Code) |
| Framework | Arduino (ESP32 Arduino core) |
| RFID | MFRC522 library |
| WiFi konfiguracija | WiFiManager |
| HTTP | HTTPClient (Arduino built-in) |
| JSON | ArduinoJson |
| Lokalna pohrana | LittleFS |
| Sinkronizacija vremena | NTP (configTime) |

---

## Struktura projekta

```
esp32/
├── platformio.ini
└── src/
    ├── main.cpp           # setup(), loop() — orkestrira sve module
    ├── config.h           # pin definicije, konstante (timeoutovi, limiti)
    ├── led.h / led.cpp    # RGB LED: postavi boju, blink, pulse
    ├── rfid.h / rfid.cpp  # RC522 init, čitanje UID-a, debounce
    ├── wifi_mgr.h / .cpp  # WiFiManager setup, stanje veze
    ├── storage.h / .cpp   # LittleFS: config.json i queue.json
    ├── http_client.h / .cpp # POST na Supabase RPC, parsiranje odgovora
    └── queue.h / queue.cpp  # offline red čekanja: enqueue, sync, drain
```

Sve konstante i pin definicije nalaze se isključivo u `config.h` — jedno mjesto za promjene pri dodavanju OLED-a ili promjeni ožičenja.

---

## Konfiguracija

### `/config.json` (LittleFS)

```json
{
  "supabase_url": "https://uxobtkrzmxkaiekxkhik.supabase.co",
  "supabase_anon_key": "eyJ..."
}
```

Supabase URL i anon ključ unose se jednom kroz WiFiManager portal i čuvaju trajno. Nikad se ne mijenjaju — mijenja se samo WiFi mreža.

---

## WiFi konfiguracija (WiFiManager)

1. **Prvo pokretanje:** uređaj otvara hotspot `RFID-BP-Setup`
2. Korisnik se spoji s mobitela → automatski se otvara captive portal
3. Odabere WiFi mrežu, upiše lozinku → uređaj se spoji i spremi vjerodajnice
4. Svako sljedeće pokretanje: automatski spoj na spremljenu mrežu

**Promjena mreže (npr. prelazak na restoran):**
- Uređaj ne pronađe poznatu mrežu → 10 sekundi čeka → otvori hotspot ponovo
- Novi vlasnik/admin odabere svoju mrežu kroz portal

Ovo eliminira potrebu za reflashingom pri promjeni WiFi mreže.

---

## NTP sinkronizacija vremena

Nakon svakog WiFi spajanja, uređaj sinkronizira sat s NTP serverom (`pool.ntp.org`, timezone `Europe/Zagreb`). Timestamp koji se šalje u Supabase uvijek je točan, čak i nakon nestanka struje.

---

## RFID skeniranje

- RC522 se provjerava svaki ciklus petlje
- UID se pretvara u hex string, npr. `"A1B2C3D4"`
- **Debounce: isti UID se ignorira 10 sekundi** nakon zadnjeg skeniranja
- UID mora odgovarati `rfid_uid` stupcu u tablici `employees`

---

## HTTP klijent

```
POST https://<project>.supabase.co/rest/v1/rpc/handle_rfid_scan
apikey: <anon_key>
Content-Type: application/json

{ "uid": "A1B2C3D4", "scanned_at": "2026-04-28T08:30:00Z" }
```

Timeout: 10 sekundi. Pri grešci ili timeoutu → scan se stavlja u offline red.

### Mapiranje odgovora na LED

| Status | LED boja | Uzorak |
|---|---|---|
| `clock_in` | Zelena | Solid 2 sec |
| `clock_out` | Plava | Solid 2 sec |
| `too_soon` | Žuta | 3 brza treptaja |
| `not_found` | Crvena | Solid 3 sec |
| HTTP greška / timeout | Crvena | Brzi trepti 1 sec, scan queue-an |

---

## Offline red čekanja

### `/queue.json` (LittleFS)

```json
[
  { "uid": "A1B2C3D4", "scanned_at": "2026-04-28T08:30:00Z" },
  { "uid": "B2C3D4E5", "scanned_at": "2026-04-28T08:31:45Z" }
]
```

**Pravila:**
- Maksimalno 500 zapisa (najstariji se brišu ako se dosegne limit)
- Pri WiFi spajanju: skenovi se šalju kronološki, jedan po jedan
- Uspješno poslan zapis se odmah briše iz fajla
- `not_found` i `too_soon` odgovori = zapis se briše (legitimno odbijen od baze)
- Sinkronizacija: bijeli spori pulse na LED-u

---

## LED feedback (kompletna tablica)

| Situacija | Boja | Uzorak |
|---|---|---|
| Boot / spajanje na WiFi | Bijela | Spori pulse |
| WiFiManager portal otvoren | Ljubičasta | Spori pulse |
| Idle (čeka karticu) | Isključen | — |
| Clock in | Zelena | Solid 2 sec |
| Clock out | Plava | Solid 2 sec |
| Too soon | Žuta | 3 brza treptaja |
| Not found | Crvena | Solid 3 sec |
| HTTP greška / scan queue-an | Crvena | Brzi trepti 1 sec |
| Sinkronizacija offline reda | Bijela | Spori pulse |

---

## Tok programa

### `setup()`

1. Init LED → bijeli spori pulse (bootanje)
2. Init LittleFS → učitaj `config.json`
3. WiFiManager → spoji se ili otvori portal (ljubičasti pulse)
4. Ako spojen → sinkroniziraj NTP
5. Init RC522
6. LED isključen → spreman

### `loop()`

1. Ako WiFi spojen i queue nije prazan → pošalji jedan queued scan
2. Provjeri RC522 za karticu
   - Nema kartice → nastavi
   - Kartica detektirana:
     - a. Čitaj UID
     - b. Provjeri debounce (isti UID unutar 10 sec → ignoriraj)
     - c. WiFi spojen?
       - DA → POST na Supabase → LED feedback
       - NE → stavi u queue → crveni brzi trepti

---

## Proširivost (OLED)

Modul `display.h / display.cpp` može se dodati bez promjene ostalih modula. Jedine promjene:
- Dodati `#include "display.h"` u `main.cpp`
- Pozvati `display.show(status)` na istim mjestima gdje se poziva LED feedback
- Dodati I2C pinove u `config.h`

---

## Rubni slučajevi

| Situacija | Ponašanje |
|---|---|
| Nema `config.json` | LED crvena solid, halt — korisnik mora proći WiFiManager |
| RC522 nije detektiran | LED crvena blink na startu, log na Serial |
| Queue pun (500 zapisa) | Najstariji zapis se briše, novi se dodaje |
| NTP ne uspije | Koristi millis() relativni timestamp kao fallback |
| Isti UID unutar 10 sec | Ignoriraj, bez LED feedback-a |
| `too_soon` od baze (< 60 min) | Žuta LED 3x blink |
