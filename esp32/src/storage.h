#pragma once
#include <Arduino.h>

struct Config {
    char supabase_url[128];
    char supabase_anon_key[512];
    char device_secret[64];
};

bool storageInit();
bool configLoad(Config& cfg);
void configSave(const Config& cfg);
