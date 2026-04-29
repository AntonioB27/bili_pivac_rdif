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
    struct tm t;
    gmtime_r(&now, &t);
    strftime(buf, len, "%Y-%m-%dT%H:%M:%SZ", &t);
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

    queueInit();
    configLoad(gCfg);  // empty on first boot — portal will populate it
    wifiInit(gCfg);    // blocks until connected; purple pulse if portal opens
    ntpSync();
    rfidInit();
    ledOff();          // ready
}

void loop() {
    // Sync one queued scan per iteration when online
    if (wifiConnected() && !queueIsEmpty()) {
        QueueEntry entry;
        if (queuePeek(entry)) {
            Serial.printf("[QUEUE] Replaying UID: %s  Time: %s\n", entry.uid, entry.scanned_at);
            ledSet(255, 255, 255);
            ScanResult result = httpSendScan(gCfg.supabase_url, gCfg.supabase_anon_key,
                                             entry.uid, entry.scanned_at);
            if (result != ScanResult::Error) {
                Serial.println("[QUEUE] Dequeued");
                queueDequeue();
            } else {
                Serial.println("[QUEUE] Retry next loop");
            }
            ledOff();
        }
    }

    // Read RFID
    char uid[32];
    if (rfidRead(uid, sizeof(uid))) {
        char ts[32];
        getTimestamp(ts, sizeof(ts));
        Serial.printf("[SCAN] UID: %s  Time: %s\n", uid, ts);

        if (wifiConnected()) {
            Serial.println("[HTTP] Sending scan...");
            ScanResult result = httpSendScan(gCfg.supabase_url, gCfg.supabase_anon_key, uid, ts);
            switch (result) {
                case ScanResult::ClockIn:  Serial.println("[HTTP] clock_in");  break;
                case ScanResult::ClockOut: Serial.println("[HTTP] clock_out"); break;
                case ScanResult::TooSoon:  Serial.println("[HTTP] too_soon");  break;
                case ScanResult::NotFound: Serial.println("[HTTP] not_found"); break;
                case ScanResult::Error:
                    Serial.println("[HTTP] error — queuing");
                    queueEnqueue(uid, ts);
                    break;
            }
            applyLedFeedback(result);
        } else {
            Serial.println("[WIFI] Offline — scan queued");
            queueEnqueue(uid, ts);
            ledBlink(255, 0, 0, 5, 100, 100);
        }
    }

    delay(50);
}
