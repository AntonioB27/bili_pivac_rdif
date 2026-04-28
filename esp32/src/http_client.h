#pragma once
#include <Arduino.h>

enum class ScanResult { ClockIn, ClockOut, TooSoon, NotFound, Error };

ScanResult httpSendScan(const char* supabaseUrl, const char* anonKey,
                        const char* uid, const char* scannedAt);
