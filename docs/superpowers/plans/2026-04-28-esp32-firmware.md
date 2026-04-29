# ESP32 RFID Firmware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Arduino/PlatformIO firmware for ESP32-S3 + RC522 RFID reader that posts scans to Supabase RPC, gives RGB LED feedback, and queues scans to LittleFS when offline.

**Architecture:** Each hardware concern lives in its own module (led, rfid, wifi_mgr, storage, http_client, queue); `main.cpp` orchestrates them in `setup()` + `loop()`. WiFiManager handles WiFi provisioning and Supabase credential entry via a captive portal — no reflashing needed to change networks. Offline scans are persisted in LittleFS `/queue.json` and replayed one-per-loop-iteration on reconnection.

**Tech Stack:** PlatformIO + Arduino core (ESP32-S3), MFRC522, WiFiManager, ArduinoJson v7, LittleFS, HTTPClient

---

## File Map

| File | Responsibility |
|---|---|
| `esp32/platformio.ini` | PlatformIO project config, lib dependencies |
| `esp32/src/config.h` | Pin definitions, timing constants — single source of truth |
| `esp32/src/led.h/cpp` | RGB LED via LEDC PWM: init, solid, blink, pulse |
| `esp32/src/storage.h/cpp` | LittleFS mount, `/config.json` load/save |
| `esp32/src/wifi_mgr.h/cpp` | WiFiManager: connect or open portal, save Supabase creds |
| `esp32/src/rfid.h/cpp` | RC522 init + UID read with 10 s debounce |
| `esp32/src/http_client.h/cpp` | POST to Supabase RPC, parse ScanResult |
| `esp32/src/queue.h/cpp` | LittleFS `/queue.json`: enqueue, peek, dequeue, max 500 |
| `esp32/src/main.cpp` | setup() + loop(): orchestrates all modules |

---

### Task 1: Project scaffold

**Files:**
- Create: `esp32/platformio.ini`
- Create: `esp32/src/config.h`
- Create: `esp32/src/main.cpp` (stub)

- [ ] **Step 1: Create `esp32/platformio.ini`**

```ini
[env:esp32s3]
platform = espressif32
board = esp32-s3-devkitc-1
framework = arduino
lib_deps =
    miguelbalboa/MFRC522@^1.4.11
    bblanchon/ArduinoJson@^7.0.0
    tzapu/WiFiManager@^2.0.17
board_build.filesystem = littlefs
monitor_speed = 115200
```

- [ ] **Step 2: Create `esp32/src/config.h`**

```cpp
#pragma once

// RC522 (SPI2) pins
#define PIN_MOSI    11
#define PIN_MISO    13
#define PIN_SCK     12
#define PIN_SS      10
#define PIN_RST     9

// RGB LED (LEDC PWM)
#define PIN_LED_R   4
#define PIN_LED_G   5
#define PIN_LED_B   6
#define LEDC_FREQ   5000
#define LEDC_RES    8

// Timing
#define DEBOUNCE_MS      10000UL
#define HTTP_TIMEOUT_MS  10000
#define QUEUE_MAX        500

// NTP
#define NTP_SERVER  "pool.ntp.org"
```

- [ ] **Step 3: Create stub `esp32/src/main.cpp`**

```cpp
#include <Arduino.h>
#include "config.h"

void setup() { Serial.begin(115200); }
void loop()  {}
```

- [ ] **Step 4: Verify compilation**

```bash
cd esp32 && pio run -e esp32s3
```

Expected: `[SUCCESS] Took X.XX seconds`

- [ ] **Step 5: Commit**

```bash
git add esp32/
git commit -m "feat: esp32 project scaffold (platformio.ini + config.h)"
```

---

### Task 2: LED module

**Files:**
- Create: `esp32/src/led.h`
- Create: `esp32/src/led.cpp`
- Modify: `esp32/src/main.cpp`

- [ ] **Step 1: Create `esp32/src/led.h`**

```cpp
#pragma once
#include <cstdint>

void ledInit();
void ledOff();
void ledSet(uint8_t r, uint8_t g, uint8_t b);
void ledSolid(uint8_t r, uint8_t g, uint8_t b, uint32_t durationMs);
void ledBlink(uint8_t r, uint8_t g, uint8_t b, uint8_t count, uint32_t onMs, uint32_t offMs);
// Call each loop iteration to animate a slow triangle-wave pulse. ledOff() stops it.
void ledPulse(uint8_t r, uint8_t g, uint8_t b);
```

- [ ] **Step 2: Create `esp32/src/led.cpp`**

```cpp
#include "led.h"
#include "config.h"
#include <Arduino.h>

static bool     _pulsing    = false;
static uint8_t  _pr, _pg, _pb;
static uint32_t _pulseStart = 0;

void ledInit() {
    ledcAttach(PIN_LED_R, LEDC_FREQ, LEDC_RES);
    ledcAttach(PIN_LED_G, LEDC_FREQ, LEDC_RES);
    ledcAttach(PIN_LED_B, LEDC_FREQ, LEDC_RES);
    ledOff();
}

void ledOff() {
    _pulsing = false;
    ledcWrite(PIN_LED_R, 0);
    ledcWrite(PIN_LED_G, 0);
    ledcWrite(PIN_LED_B, 0);
}

void ledSet(uint8_t r, uint8_t g, uint8_t b) {
    _pulsing = false;
    ledcWrite(PIN_LED_R, r);
    ledcWrite(PIN_LED_G, g);
    ledcWrite(PIN_LED_B, b);
}

void ledSolid(uint8_t r, uint8_t g, uint8_t b, uint32_t durationMs) {
    ledSet(r, g, b);
    delay(durationMs);
    ledOff();
}

void ledBlink(uint8_t r, uint8_t g, uint8_t b, uint8_t count, uint32_t onMs, uint32_t offMs) {
    _pulsing = false;
    for (uint8_t i = 0; i < count; i++) {
        ledcWrite(PIN_LED_R, r);
        ledcWrite(PIN_LED_G, g);
        ledcWrite(PIN_LED_B, b);
        delay(onMs);
        ledcWrite(PIN_LED_R, 0);
        ledcWrite(PIN_LED_G, 0);
        ledcWrite(PIN_LED_B, 0);
        if (i < count - 1) delay(offMs);
    }
}

void ledPulse(uint8_t r, uint8_t g, uint8_t b) {
    if (!_pulsing || _pr != r || _pg != g || _pb != b) {
        _pulsing    = true;
        _pr = r; _pg = g; _pb = b;
        _pulseStart = millis();
    }
    uint32_t phase = (millis() - _pulseStart) % 2000;
    float t          = phase / 2000.0f;
    float brightness = (t < 0.5f) ? (2.0f * t) : (2.0f - 2.0f * t);
    uint8_t scale    = static_cast<uint8_t>(brightness * 255);
    ledcWrite(PIN_LED_R, (r * scale) >> 8);
    ledcWrite(PIN_LED_G, (g * scale) >> 8);
    ledcWrite(PIN_LED_B, (b * scale) >> 8);
}
```

- [ ] **Step 3: Update `esp32/src/main.cpp`**

```cpp
#include <Arduino.h>
#include "config.h"
#include "led.h"

void setup() {
    Serial.begin(115200);
    ledInit();
    ledSet(255, 255, 255);  // white = booting
}

void loop() {}
```

- [ ] **Step 4: Verify compilation**

```bash
cd esp32 && pio run -e esp32s3
```

Expected: `[SUCCESS] Took X.XX seconds`

- [ ] **Step 5: Commit**

```bash
git add esp32/src/led.h esp32/src/led.cpp esp32/src/main.cpp
git commit -m "feat: esp32 LED module (LEDC PWM, solid/blink/pulse)"
```

---

### Task 3: Storage module

**Files:**
- Create: `esp32/src/storage.h`
- Create: `esp32/src/storage.cpp`
- Modify: `esp32/src/main.cpp`

- [ ] **Step 1: Create `esp32/src/storage.h`**

```cpp
#pragma once
#include <Arduino.h>

struct Config {
    char supabase_url[128];
    char supabase_anon_key[512];
};

bool storageInit();
bool configLoad(Config& cfg);   // returns false if missing or corrupt
void configSave(const Config& cfg);
```

- [ ] **Step 2: Create `esp32/src/storage.cpp`**

```cpp
#include "storage.h"
#include <LittleFS.h>
#include <ArduinoJson.h>

bool storageInit() {
    return LittleFS.begin(true);  // format on first use
}

bool configLoad(Config& cfg) {
    File f = LittleFS.open("/config.json", "r");
    if (!f) return false;
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err) return false;
    strlcpy(cfg.supabase_url,      doc["supabase_url"]      | "", sizeof(cfg.supabase_url));
    strlcpy(cfg.supabase_anon_key, doc["supabase_anon_key"] | "", sizeof(cfg.supabase_anon_key));
    return cfg.supabase_url[0] != '\0';
}

void configSave(const Config& cfg) {
    JsonDocument doc;
    doc["supabase_url"]      = cfg.supabase_url;
    doc["supabase_anon_key"] = cfg.supabase_anon_key;
    File f = LittleFS.open("/config.json", "w");
    serializeJson(doc, f);
    f.close();
}
```

- [ ] **Step 3: Update `esp32/src/main.cpp`**

```cpp
#include <Arduino.h>
#include "config.h"
#include "led.h"
#include "storage.h"

void setup() {
    Serial.begin(115200);
    ledInit();
    ledSet(255, 255, 255);
    if (!storageInit()) {
        while (true) { ledBlink(255, 0, 0, 1, 300, 700); }
    }
}

void loop() {}
```

- [ ] **Step 4: Verify compilation**

```bash
cd esp32 && pio run -e esp32s3
```

Expected: `[SUCCESS] Took X.XX seconds`

- [ ] **Step 5: Commit**

```bash
git add esp32/src/storage.h esp32/src/storage.cpp esp32/src/main.cpp
git commit -m "feat: esp32 storage module (LittleFS, config.json)"
```

---

### Task 4: WiFi Manager module

**Files:**
- Create: `esp32/src/wifi_mgr.h`
- Create: `esp32/src/wifi_mgr.cpp`
- Modify: `esp32/src/main.cpp`

- [ ] **Step 1: Create `esp32/src/wifi_mgr.h`**

```cpp
#pragma once
#include "storage.h"

// Connect to WiFi or open captive portal.
// If portal is used, saves new Supabase creds into cfg and persists to LittleFS.
// Returns only when WiFi is connected.
void wifiInit(Config& cfg);
bool wifiConnected();
```

- [ ] **Step 2: Create `esp32/src/wifi_mgr.cpp`**

```cpp
#include "wifi_mgr.h"
#include "led.h"
#include <WiFi.h>
#include <WiFiManager.h>

void wifiInit(Config& cfg) {
    WiFiManager wm;
    wm.setConfigPortalBlocking(false);

    WiFiManagerParameter urlParam("supabase_url",      "Supabase URL",      cfg.supabase_url,      127);
    WiFiManagerParameter keyParam("supabase_anon_key", "Supabase Anon Key", cfg.supabase_anon_key, 511);
    wm.addParameter(&urlParam);
    wm.addParameter(&keyParam);

    bool connected = wm.autoConnect("RFID-BP-Setup");

    if (!connected) {
        // Portal is open — animate purple until user connects
        while (!WiFi.isConnected()) {
            wm.process();
            ledPulse(128, 0, 128);
            delay(20);
        }
        ledOff();
    }

    // Save Supabase creds if the user entered them in the portal
    const char* url = urlParam.getValue();
    const char* key = keyParam.getValue();
    if (url[0] != '\0' && strcmp(url, cfg.supabase_url) != 0) {
        strlcpy(cfg.supabase_url,      url, sizeof(cfg.supabase_url));
        strlcpy(cfg.supabase_anon_key, key, sizeof(cfg.supabase_anon_key));
        configSave(cfg);
    }
}

bool wifiConnected() {
    return WiFi.isConnected();
}
```

- [ ] **Step 3: Update `esp32/src/main.cpp`**

```cpp
#include <Arduino.h>
#include "config.h"
#include "led.h"
#include "storage.h"
#include "wifi_mgr.h"

static Config gCfg;

void setup() {
    Serial.begin(115200);
    ledInit();
    ledSet(255, 255, 255);  // white = booting / connecting

    if (!storageInit()) {
        while (true) { ledBlink(255, 0, 0, 1, 300, 700); }
    }

    configLoad(gCfg);  // empty on first boot — portal will fill it
    wifiInit(gCfg);    // blocks until connected; purple pulse if portal opens
}

void loop() {}
```

- [ ] **Step 4: Verify compilation**

```bash
cd esp32 && pio run -e esp32s3
```

Expected: `[SUCCESS] Took X.XX seconds`

- [ ] **Step 5: Commit**

```bash
git add esp32/src/wifi_mgr.h esp32/src/wifi_mgr.cpp esp32/src/main.cpp
git commit -m "feat: esp32 WiFiManager with Supabase credential portal"
```

---

### Task 5: RFID module

**Files:**
- Create: `esp32/src/rfid.h`
- Create: `esp32/src/rfid.cpp`
- Modify: `esp32/src/main.cpp`

- [ ] **Step 1: Create `esp32/src/rfid.h`**

```cpp
#pragma once
#include <Arduino.h>

void rfidInit();
// Returns true and fills uidOut (uppercase hex e.g. "A1B2C3D4") when a new card
// is detected and the 10 s debounce has elapsed. Returns false otherwise.
bool rfidRead(char* uidOut, size_t maxLen);
```

- [ ] **Step 2: Create `esp32/src/rfid.cpp`**

```cpp
#include "rfid.h"
#include "config.h"
#include <SPI.h>
#include <MFRC522.h>

static MFRC522  _rfid(PIN_SS, PIN_RST);
static char     _lastUid[32] = {0};
static uint32_t _lastMs      = 0;

void rfidInit() {
    SPI.begin(PIN_SCK, PIN_MISO, PIN_MOSI, PIN_SS);
    _rfid.PCD_Init();
}

bool rfidRead(char* uidOut, size_t maxLen) {
    if (!_rfid.PICC_IsNewCardPresent()) return false;
    if (!_rfid.PICC_ReadCardSerial())   return false;

    char uid[32] = {0};
    for (uint8_t i = 0; i < _rfid.uid.size && i < 4; i++) {
        char hex[3];
        snprintf(hex, sizeof(hex), "%02X", _rfid.uid.uidByte[i]);
        strncat(uid, hex, sizeof(uid) - strlen(uid) - 1);
    }

    _rfid.PICC_HaltA();
    _rfid.PCD_StopCrypto1();

    uint32_t now = millis();
    if (strcmp(uid, _lastUid) == 0 && (now - _lastMs) < DEBOUNCE_MS) {
        return false;
    }

    strlcpy(_lastUid, uid, sizeof(_lastUid));
    _lastMs = now;
    strlcpy(uidOut, uid, maxLen);
    return true;
}
```

- [ ] **Step 3: Update `esp32/src/main.cpp`**

```cpp
#include <Arduino.h>
#include "config.h"
#include "led.h"
#include "storage.h"
#include "wifi_mgr.h"
#include "rfid.h"

static Config gCfg;

void setup() {
    Serial.begin(115200);
    ledInit();
    ledSet(255, 255, 255);

    if (!storageInit()) {
        while (true) { ledBlink(255, 0, 0, 1, 300, 700); }
    }

    configLoad(gCfg);
    wifiInit(gCfg);
    rfidInit();
    ledOff();
}

void loop() {
    char uid[32];
    if (rfidRead(uid, sizeof(uid))) {
        Serial.printf("Card: %s\n", uid);
    }
    delay(50);
}
```

- [ ] **Step 4: Verify compilation**

```bash
cd esp32 && pio run -e esp32s3
```

Expected: `[SUCCESS] Took X.XX seconds`

- [ ] **Step 5: Commit**

```bash
git add esp32/src/rfid.h esp32/src/rfid.cpp esp32/src/main.cpp
git commit -m "feat: esp32 RFID module (RC522 SPI, 10 s debounce)"
```

---

### Task 6: HTTP Client module

**Files:**
- Create: `esp32/src/http_client.h`
- Create: `esp32/src/http_client.cpp`

- [ ] **Step 1: Create `esp32/src/http_client.h`**

```cpp
#pragma once
#include <Arduino.h>

enum class ScanResult { ClockIn, ClockOut, TooSoon, NotFound, Error };

ScanResult httpSendScan(const char* supabaseUrl, const char* anonKey,
                        const char* uid, const char* scannedAt);
```

- [ ] **Step 2: Create `esp32/src/http_client.cpp`**

```cpp
#include "http_client.h"
#include "config.h"
#include <HTTPClient.h>
#include <ArduinoJson.h>

ScanResult httpSendScan(const char* supabaseUrl, const char* anonKey,
                        const char* uid, const char* scannedAt) {
    HTTPClient http;
    String url = String(supabaseUrl) + "/rest/v1/rpc/handle_rfid_scan";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", anonKey);
    http.addHeader("Authorization", String("Bearer ") + anonKey);
    http.setTimeout(HTTP_TIMEOUT_MS);

    JsonDocument body;
    body["uid"]        = uid;
    body["scanned_at"] = scannedAt;
    String bodyStr;
    serializeJson(body, bodyStr);

    int code = http.POST(bodyStr);
    if (code < 200 || code >= 300) {
        http.end();
        return ScanResult::Error;
    }

    String response = http.getString();
    http.end();

    JsonDocument resp;
    if (deserializeJson(resp, response) != DeserializationError::Ok) {
        return ScanResult::Error;
    }

    const char* status = resp["status"] | "";
    if (strcmp(status, "clock_in")  == 0) return ScanResult::ClockIn;
    if (strcmp(status, "clock_out") == 0) return ScanResult::ClockOut;
    if (strcmp(status, "too_soon")  == 0) return ScanResult::TooSoon;
    if (strcmp(status, "not_found") == 0) return ScanResult::NotFound;
    return ScanResult::Error;
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd esp32 && pio run -e esp32s3
```

Expected: `[SUCCESS] Took X.XX seconds`

- [ ] **Step 4: Commit**

```bash
git add esp32/src/http_client.h esp32/src/http_client.cpp
git commit -m "feat: esp32 HTTP client (Supabase RPC, ScanResult)"
```

---

### Task 7: Queue module

**Files:**
- Create: `esp32/src/queue.h`
- Create: `esp32/src/queue.cpp`

- [ ] **Step 1: Create `esp32/src/queue.h`**

```cpp
#pragma once
#include <Arduino.h>

struct QueueEntry {
    char uid[32];
    char scanned_at[32];
};

bool queueIsEmpty();
void queueEnqueue(const char* uid, const char* scannedAt);
bool queuePeek(QueueEntry& out);   // peek at front without removing
void queueDequeue();               // remove front entry
```

- [ ] **Step 2: Create `esp32/src/queue.cpp`**

```cpp
#include "queue.h"
#include "config.h"
#include <LittleFS.h>
#include <ArduinoJson.h>

static const char* PATH = "/queue.json";

static bool _load(JsonDocument& doc) {
    File f = LittleFS.open(PATH, "r");
    if (!f) { doc.to<JsonArray>(); return false; }
    DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err || !doc.is<JsonArray>()) { doc.to<JsonArray>(); return false; }
    return true;
}

static void _save(JsonDocument& doc) {
    File f = LittleFS.open(PATH, "w");
    serializeJson(doc, f);
    f.close();
}

bool queueIsEmpty() {
    JsonDocument doc;
    _load(doc);
    return doc.as<JsonArray>().size() == 0;
}

void queueEnqueue(const char* uid, const char* scannedAt) {
    JsonDocument doc;
    _load(doc);
    JsonArray arr = doc.as<JsonArray>();
    while ((int)arr.size() >= QUEUE_MAX) arr.remove(0);  // drop oldest if full
    JsonObject entry  = arr.add<JsonObject>();
    entry["uid"]        = uid;
    entry["scanned_at"] = scannedAt;
    _save(doc);
}

bool queuePeek(QueueEntry& out) {
    JsonDocument doc;
    _load(doc);
    JsonArray arr = doc.as<JsonArray>();
    if (arr.size() == 0) return false;
    strlcpy(out.uid,        arr[0]["uid"]        | "", sizeof(out.uid));
    strlcpy(out.scanned_at, arr[0]["scanned_at"] | "", sizeof(out.scanned_at));
    return true;
}

void queueDequeue() {
    JsonDocument doc;
    _load(doc);
    JsonArray arr = doc.as<JsonArray>();
    if (arr.size() == 0) return;
    arr.remove(0);
    _save(doc);
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd esp32 && pio run -e esp32s3
```

Expected: `[SUCCESS] Took X.XX seconds`

- [ ] **Step 4: Commit**

```bash
git add esp32/src/queue.h esp32/src/queue.cpp
git commit -m "feat: esp32 offline queue (LittleFS queue.json, FIFO, max 500)"
```

---

### Task 8: Main orchestration

**Files:**
- Modify: `esp32/src/main.cpp` (final implementation)

- [ ] **Step 1: Replace `esp32/src/main.cpp` with full orchestration**

```cpp
#include <Arduino.h>
#include <time.h>
#include "config.h"
#include "led.h"
#include "storage.h"
#include "wifi_mgr.h"
#include "rfid.h"
#include "http_client.h"
#include "queue.h"

static Config gCfg;

static void ntpSync() {
    configTime(0, 0, NTP_SERVER);
    struct tm ti;
    uint32_t start = millis();
    while (!getLocalTime(&ti, 1000) && (millis() - start) < 5000);
}

static void getTimestamp(char* buf, size_t len) {
    time_t now;
    time(&now);
    struct tm* t = gmtime(&now);
    strftime(buf, len, "%Y-%m-%dT%H:%M:%SZ", t);
}

static void applyLedFeedback(ScanResult result) {
    switch (result) {
        case ScanResult::ClockIn:  ledSolid(0,   255, 0,   2000); break;
        case ScanResult::ClockOut: ledSolid(0,   0,   255, 2000); break;
        case ScanResult::TooSoon:  ledBlink(255, 255, 0,   3, 150, 100); break;
        case ScanResult::NotFound: ledSolid(255, 0,   0,   3000); break;
        case ScanResult::Error:    ledBlink(255, 0,   0,   5, 100, 100); break;
    }
}

void setup() {
    Serial.begin(115200);
    ledInit();
    ledSet(255, 255, 255);  // white = booting

    if (!storageInit()) {
        while (true) { ledBlink(255, 0, 0, 1, 300, 700); }
    }

    configLoad(gCfg);  // empty on first boot — portal will populate it
    wifiInit(gCfg);    // blocks until connected; shows purple pulse if portal opens
    ntpSync();
    rfidInit();
    ledOff();          // ready
}

void loop() {
    // Sync one queued scan per iteration when online
    if (wifiConnected() && !queueIsEmpty()) {
        QueueEntry entry;
        if (queuePeek(entry)) {
            ledSet(255, 255, 255);  // white = syncing
            ScanResult result = httpSendScan(gCfg.supabase_url, gCfg.supabase_anon_key,
                                             entry.uid, entry.scanned_at);
            if (result != ScanResult::Error) {
                queueDequeue();  // remove on success or legitimate rejection (not_found, too_soon)
            }
            ledOff();
        }
    }

    // Read RFID
    char uid[32];
    if (rfidRead(uid, sizeof(uid))) {
        char ts[32];
        getTimestamp(ts, sizeof(ts));

        if (wifiConnected()) {
            ScanResult result = httpSendScan(gCfg.supabase_url, gCfg.supabase_anon_key, uid, ts);
            if (result == ScanResult::Error) {
                queueEnqueue(uid, ts);
            }
            applyLedFeedback(result);
        } else {
            queueEnqueue(uid, ts);
            ledBlink(255, 0, 0, 5, 100, 100);  // fast red = queued offline
        }
    }

    delay(50);
}
```

- [ ] **Step 2: Final compilation check**

```bash
cd esp32 && pio run -e esp32s3
```

Expected: `[SUCCESS] Took X.XX seconds`

- [ ] **Step 3: Commit**

```bash
git add esp32/src/main.cpp
git commit -m "feat: esp32 main orchestration (full setup + loop)"
```

---

### Task 9: Flash and hardware test

**Files:** None (manual verification on device)

- [ ] **Step 1: (Optional) Pre-load config via LittleFS data folder**

Skip if you prefer to provision via the WiFiManager portal on first boot.

If pre-loading: create `esp32/data/config.json`:
```json
{
  "supabase_url": "https://YOUR_PROJECT_REF.supabase.co",
  "supabase_anon_key": "YOUR_ANON_KEY"
}
```
Then upload: `cd esp32 && pio run -e esp32s3 -t uploadfs`

- [ ] **Step 2: Flash firmware**

```bash
cd esp32 && pio run -e esp32s3 -t upload
```

- [ ] **Step 3: Open serial monitor**

```bash
cd esp32 && pio device monitor -b 115200
```

- [ ] **Step 4: Verify boot sequence**

| LED | Meaning |
|---|---|
| White solid | Booting, connecting to saved WiFi |
| Purple pulse | WiFiManager portal open (first boot or unknown network) |
| Off | Ready |

If first boot: connect phone to hotspot `RFID-BP-Setup` → browser opens `192.168.4.1` → enter WiFi network + Supabase URL + Anon Key → save.

- [ ] **Step 5: Verify known card scan**

Tap a card whose `rfid_uid` exists in the `employees` table.

| Expected LED | RPC response |
|---|---|
| Green solid 2 s | `clock_in` |
| Tap again (>10 s debounce, <60 min) → Blue solid 2 s | `clock_out` |

- [ ] **Step 6: Verify unknown card**

Tap a card not in `employees`. Expected: Red solid 3 s (`not_found`).

- [ ] **Step 7: Verify debounce**

Tap the same card twice within 10 seconds. Second tap: no LED response.

- [ ] **Step 8: Verify offline queue**

1. Power off router (or comment out `wifiInit` and reflash without WiFi creds)
2. Tap a card → fast red blinks (5×) — scan queued
3. Restore WiFi → within one loop iteration, white solid briefly → green or blue (queued scan replayed)

- [ ] **Step 9: Commit any hardware-discovered fixes**

```bash
git add -A && git commit -m "fix: esp32 hardware test adjustments"
```

---

## Self-Review

**Spec coverage:**
- [x] RC522 SPI2 pins (config.h): GPIO 11/13/12/10/9
- [x] RGB LED LEDC PWM (config.h): GPIO 4/5/6
- [x] WiFiManager hotspot `RFID-BP-Setup` (wifi_mgr.cpp)
- [x] Supabase URL + anon key via captive portal, saved to `/config.json` (wifi_mgr.cpp + storage.cpp)
- [x] NTP UTC sync after WiFi connect with 5 s timeout fallback (main.cpp: ntpSync)
- [x] UID read as uppercase hex, max 4 bytes (rfid.cpp)
- [x] 10 s same-UID debounce (rfid.cpp: DEBOUNCE_MS)
- [x] POST to `/rest/v1/rpc/handle_rfid_scan` with apikey + Authorization headers (http_client.cpp)
- [x] 10 s HTTP timeout (config.h: HTTP_TIMEOUT_MS)
- [x] LED feedback: clock_in (green 2 s), clock_out (blue 2 s), too_soon (yellow 3× blink), not_found (red 3 s), error (fast red blinks) (main.cpp: applyLedFeedback)
- [x] Offline queue: `/queue.json`, FIFO, max 500 entries, oldest dropped when full (queue.cpp)
- [x] Queue sync: one entry per loop, dequeue on success or legitimate rejection (main.cpp loop)
- [x] `not_found` + `too_soon` dequeued (legitimate rejections, not retried) (main.cpp loop)
- [x] White on boot (main.cpp setup: ledSet)
- [x] Purple pulse while portal open (wifi_mgr.cpp)
- [x] White solid during queue sync (main.cpp loop: ledSet)
- [x] Red halt blink on LittleFS fail (main.cpp setup)

**Known simplification vs spec:**
- Spec specifies "spori pulse" (slow pulse) for boot and sync states. Boot and sync use `ledSet` (solid white) because those states involve blocking calls where `ledPulse` cannot be ticked. Portal state correctly uses `ledPulse` since it runs via `wm.process()` in a loop. Adding FreeRTOS task for LED animation would enable pulse during blocking calls but is out of scope for this MVP.

**Placeholder scan:** None found.

**Type consistency:**
- `ScanResult` — defined in `http_client.h`, used in `http_client.cpp` and `main.cpp`
- `Config` — defined in `storage.h`, used in `storage.cpp`, `wifi_mgr.h`, `wifi_mgr.cpp`, `main.cpp`
- `QueueEntry` — defined in `queue.h`, used in `queue.cpp` and `main.cpp`
- LED API (`ledInit`, `ledOff`, `ledSet`, `ledSolid`, `ledBlink`, `ledPulse`) — consistent across `led.h`, `led.cpp`, `main.cpp`, `wifi_mgr.cpp`
