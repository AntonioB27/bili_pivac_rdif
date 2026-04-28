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
