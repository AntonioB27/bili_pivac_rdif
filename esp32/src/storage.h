#pragma once
#include <Arduino.h>

struct Config {
    char supabase_url[128];
    char supabase_anon_key[512];
};

bool storageInit();
bool configLoad(Config& cfg);   // returns false if missing or corrupt
void configSave(const Config& cfg);
