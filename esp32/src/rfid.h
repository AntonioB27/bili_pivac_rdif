#pragma once
#include <Arduino.h>

void rfidInit();
// Returns true and fills uidOut (uppercase hex e.g. "A1B2C3D4") when a new card
// is detected and the 10 s debounce has elapsed. Returns false otherwise.
bool rfidRead(char* uidOut, size_t maxLen);
