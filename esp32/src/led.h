#pragma once
#include <cstdint>

void ledInit();
void ledOff();
void ledSet(uint8_t r, uint8_t g, uint8_t b);
void ledSolid(uint8_t r, uint8_t g, uint8_t b, uint32_t durationMs);
void ledBlink(uint8_t r, uint8_t g, uint8_t b, uint8_t count, uint32_t onMs, uint32_t offMs);
// Call each loop iteration to animate a slow triangle-wave pulse. ledOff() stops it.
void ledPulse(uint8_t r, uint8_t g, uint8_t b);
