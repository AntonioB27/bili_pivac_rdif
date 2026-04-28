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
