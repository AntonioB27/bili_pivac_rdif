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
