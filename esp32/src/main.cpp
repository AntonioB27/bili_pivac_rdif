#include <Arduino.h>
#include "config.h"
#include "led.h"

void setup() {
    Serial.begin(115200);
    ledInit();
    ledSet(255, 255, 255);  // white = booting
}

void loop() {}
