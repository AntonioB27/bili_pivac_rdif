#pragma once
#include "storage.h"

// Connect to WiFi or open captive portal.
// If portal is used, saves new Supabase creds into cfg and persists to LittleFS.
// Returns only when WiFi is connected.
void wifiInit(Config& cfg);
bool wifiConnected();
