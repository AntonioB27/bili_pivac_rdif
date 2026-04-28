# ESP32 Firmware

## Overview

The firmware runs on an ESP32-S3 microcontroller paired with an RC522 RFID reader. When an employee taps their RFID card, the device sends the card UID to the Supabase RPC endpoint (`handle_rfid_scan`) and provides immediate visual feedback via an RGB LED. If the device cannot reach the server — due to network loss or a server error — the scan is queued locally in flash storage and retried automatically when connectivity is restored.

WiFi provisioning and Supabase credential entry are handled through a captive portal, requiring no firmware reflash to change networks or deploy to a new location.

---

## Hardware

| Component | Model |
|---|---|
| Microcontroller | ESP32-S3 DevKitC-1 |
| RFID Reader | RC522 (SPI interface) |
| Visual indicator | Common-anode RGB LED |

### Pinout

**RC522 RFID reader (SPI2 bus):**

| Signal | GPIO |
|---|---|
| MOSI | 11 |
| MISO | 13 |
| SCK | 12 |
| SS / CS | 10 |
| RST | 9 |

**RGB LED (LEDC PWM):**

| Channel | GPIO |
|---|---|
| Red | 4 |
| Green | 5 |
| Blue | 6 |

The LED is driven by the ESP32's built-in LEDC peripheral (hardware PWM), configured at 5 kHz with 8-bit resolution (0–255 per channel). This produces smooth dimming and colour mixing without flickering.

---

## Software Stack

| Component | Library / Tool |
|---|---|
| Build system | [PlatformIO](https://platformio.org) + Arduino core for ESP32 |
| RFID driver | [MFRC522](https://github.com/miguelbalboa/rfid) ^1.4.11 |
| WiFi provisioning | [WiFiManager](https://github.com/tzapu/WiFiManager) ^2.0.17 |
| JSON serialisation | [ArduinoJson](https://arduinojson.org) ^7.0.0 |
| Local storage | LittleFS (built into ESP32 Arduino core) |
| HTTP client | HTTPClient (built into ESP32 Arduino core) |
| Time synchronisation | `configTime` / NTP (built into ESP32 Arduino core) |

---

## Module Architecture

The firmware is divided into seven independent modules, each encapsulated in a `.h`/`.cpp` pair. `main.cpp` orchestrates them in `setup()` and `loop()`.

| Module | Files | Responsibility |
|---|---|---|
| Configuration | `config.h` | All pin numbers and timing constants — single source of truth; no magic numbers elsewhere |
| LED | `led.h` / `led.cpp` | RGB LED control: instant colour set, blocking solid/blink, non-blocking triangle-wave pulse animation |
| Storage | `storage.h` / `storage.cpp` | LittleFS initialisation; load and save `/config.json` (Supabase URL and anon key) |
| WiFi Manager | `wifi_mgr.h` / `wifi_mgr.cpp` | WiFi connection; non-blocking captive portal for credential entry; saves new credentials after provisioning |
| RFID | `rfid.h` / `rfid.cpp` | RC522 initialisation; UID reading with 10-second same-card debounce |
| HTTP Client | `http_client.h` / `http_client.cpp` | POST to Supabase RPC; parse JSON response into `ScanResult` enum |
| Queue | `queue.h` / `queue.cpp` | FIFO offline scan queue backed by `/queue.json` on LittleFS; max 500 entries |

---

## Configuration Constants

All constants are defined in `config.h` and are the only place where hardware-specific values appear.

| Constant | Value | Description |
|---|---|---|
| `PIN_MOSI` | `11` | SPI MOSI pin |
| `PIN_MISO` | `13` | SPI MISO pin |
| `PIN_SCK` | `12` | SPI clock pin |
| `PIN_SS` | `10` | SPI chip select pin |
| `PIN_RST` | `9` | RC522 reset pin |
| `PIN_LED_R/G/B` | `4 / 5 / 6` | RGB LED PWM pins |
| `LEDC_FREQ` | `5000` Hz | LED PWM frequency |
| `LEDC_RES` | `8` bit | LED PWM resolution |
| `DEBOUNCE_MS` | `10 000` ms | Minimum re-scan interval for the same card |
| `HTTP_TIMEOUT_MS` | `10 000` ms | HTTP request timeout |
| `QUEUE_MAX` | `500` | Maximum offline queue entries |
| `NTP_SERVER` | `"pool.ntp.org"` | NTP time server hostname |

---

## First-Time Provisioning

On first power-up, or whenever the saved WiFi network is unavailable, the device enters provisioning mode:

1. The LED pulses **purple**.
2. The device opens a WiFi access point named **`RFID-BP-Setup`**.
3. Connect a phone or laptop to this network — a captive portal opens automatically (or navigate to `192.168.4.1`).
4. Select the target WiFi network and enter the password.
5. Enter the **Supabase project URL** and **Supabase anon key** in the custom fields.
6. Save — the device connects to WiFi, stores the credentials in `/config.json` on LittleFS, and turns the LED off (ready state).

WiFi credentials are managed by the WiFiManager library and persisted in NVS (non-volatile storage). Supabase credentials are stored in `/config.json` and loaded on every boot. Both survive power cycles. Neither requires reflashing to change.

---

## Boot Sequence

```
setup()
  ├─ Serial.begin(115200)
  ├─ ledInit()
  ├─ ledSet(white)                  ← white LED: booting
  ├─ storageInit()
  │     └─ FAIL ──▶ ledBlink(red, ∞)  ← halt: LittleFS error
  ├─ configLoad()                   ← load Supabase URL + anon key
  ├─ wifiInit()
  │     ├─ Connected immediately ──▶ continue
  │     └─ Portal opened ──▶ ledPulse(purple) until connected
  ├─ ntpSync()                      ← sync clock with pool.ntp.org (5 s timeout)
  ├─ rfidInit()                     ← initialise RC522 over SPI
  └─ ledOff()                       ← LED off: ready
```

---

## Main Loop

On every `loop()` iteration:

1. **Queue drain** — If WiFi is connected and the offline queue is non-empty, send the front entry to Supabase, dequeue it on success or legitimate rejection, and indicate sync with a white LED.
2. **RFID read** — If a card is present and debounce has elapsed, read the UID, get a UTC timestamp, and process the scan (online or offline path).

```
loop()
  │
  ├─ WiFi connected AND queue not empty?
  │     └─ YES ──▶ ledSet(white)
  │                httpSendScan(front entry)
  │                result ≠ Error? ──▶ queueDequeue()
  │                ledOff()
  │
  └─ rfidRead(uid)?
        │
        ├─ Same card within 10 s ──▶ ignore
        │
        └─ New valid scan
              ├─ WiFi connected?
              │     └─ YES ──▶ httpSendScan(uid, timestamp)
              │                result == Error ──▶ queueEnqueue()
              │                applyLedFeedback(result)
              │
              └─ NO ──▶ queueEnqueue(uid, timestamp)
                         ledBlink(red, 5×)
```

---

## RFID Scan Processing

### UID format

The RC522 reads 4-byte UIDs. The firmware converts each byte to uppercase hexadecimal and concatenates them: e.g. bytes `{0xA1, 0xB2, 0xC3, 0xD4}` → `"A1B2C3D4"`.

### Debounce

After a card is successfully read, any subsequent read of the **same UID within 10 seconds** is silently ignored. This prevents a single tap from registering multiple scans. Different cards are not affected.

### HTTP request

```
POST <supabase_url>/rest/v1/rpc/handle_rfid_scan
Content-Type: application/json
apikey: <anon_key>
Authorization: Bearer <anon_key>

{
  "uid": "A1B2C3D4",
  "scanned_at": "2026-04-28T08:30:00Z"
}
```

Timestamps are UTC ISO-8601 strings obtained from the NTP-synchronised system clock via `gmtime_r`. The request timeout is 10 seconds.

### Response mapping

| `status` value | `ScanResult` | LED feedback |
|---|---|---|
| `"clock_in"` | `ClockIn` | Green solid 2 s |
| `"clock_out"` | `ClockOut` | Blue solid 2 s |
| `"too_soon"` | `TooSoon` | Yellow 3× blink |
| `"not_found"` | `NotFound` | Red solid 3 s |
| Non-2xx HTTP / parse error | `Error` | Red 5× fast blink + enqueue |

---

## LED Feedback Reference

| Situation | Colour | Pattern |
|---|---|---|
| Boot / connecting to WiFi | White | Solid |
| WiFiManager portal open | Purple | Slow pulse (triangle wave, 2 s period) |
| Ready — waiting for card | Off | — |
| Clock in | Green | Solid 2 s |
| Clock out | Blue | Solid 2 s |
| Too soon (< 60 min since clock-in) | Yellow | 3× blink (150 ms on / 100 ms off) |
| Card not found in database | Red | Solid 3 s |
| HTTP error / scan queued offline | Red | 5× fast blink (100 ms on / 100 ms off) |
| Syncing offline queue entry | White | Solid (brief, while HTTP request runs) |
| LittleFS mount failure | Red | Infinite slow blink (device halted) |

---

## Offline Queue

When a scan cannot be delivered (no WiFi, HTTP error, timeout), it is appended to `/queue.json` on LittleFS:

```json
[
  { "uid": "A1B2C3D4", "scanned_at": "2026-04-28T08:30:00Z" },
  { "uid": "B2C3D4E5", "scanned_at": "2026-04-28T08:31:45Z" }
]
```

**Queue behaviour:**

| Property | Value |
|---|---|
| Order | FIFO — oldest entry sent first |
| Maximum size | 500 entries |
| Overflow policy | Oldest entry discarded to make room for the newest |
| Drain rate | One entry per `loop()` iteration while WiFi is connected |
| Dequeue condition | `ScanResult` is anything other than `Error` (including `NotFound` and `TooSoon` — legitimate rejections are not retried) |
| Retry condition | `ScanResult::Error` only — network/server failures are retried on the next iteration |

---

## NTP Time Synchronisation

After each WiFi connection, the device calls `configTime(0, 0, "pool.ntp.org")` to synchronise its clock to UTC. The firmware polls `getLocalTime()` for up to 5 seconds before proceeding. If NTP synchronisation fails within that window, the device continues with whatever the system clock reports (which defaults to a date near the ESP32's epoch on cold boot).

All timestamps sent to Supabase are UTC and formatted as ISO-8601 using `gmtime_r` and `strftime`.

---

## Building and Flashing

**Prerequisites:** Python 3 and PlatformIO (`pip install platformio`).

```bash
cd esp32

# Compile firmware
pio run -e esp32s3

# Flash firmware to connected ESP32-S3
pio run -e esp32s3 -t upload

# Open serial monitor at 115200 baud
pio device monitor -b 115200

# (Optional) Pre-load /config.json via LittleFS data folder
# Create esp32/data/config.json with Supabase credentials, then:
pio run -e esp32s3 -t uploadfs
```

**Pre-loading credentials** (`esp32/data/config.json`) eliminates the need for the captive portal on first boot — useful for batch deployment:

```json
{
  "supabase_url": "https://<project-ref>.supabase.co",
  "supabase_anon_key": "<anon-key>"
}
```

WiFi credentials still require the portal or manual NVS entry, as they are managed by the WiFiManager library separately.
