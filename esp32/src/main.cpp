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

    configLoad(gCfg);  // empty on first boot — portal will populate it
    wifiInit(gCfg);    // blocks until connected; purple pulse if portal opens
}

void loop() {}
