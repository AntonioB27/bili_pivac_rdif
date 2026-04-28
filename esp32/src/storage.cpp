#include "storage.h"
#include <LittleFS.h>
#include <ArduinoJson.h>

bool storageInit() {
    return LittleFS.begin(true);  // format on first use
}

bool configLoad(Config& cfg) {
    File f = LittleFS.open("/config.json", "r");
    if (!f) return false;
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err) return false;
    strlcpy(cfg.supabase_url,      doc["supabase_url"]      | "", sizeof(cfg.supabase_url));
    strlcpy(cfg.supabase_anon_key, doc["supabase_anon_key"] | "", sizeof(cfg.supabase_anon_key));
    return cfg.supabase_url[0] != '\0';
}

void configSave(const Config& cfg) {
    JsonDocument doc;
    doc["supabase_url"]      = cfg.supabase_url;
    doc["supabase_anon_key"] = cfg.supabase_anon_key;
    File f = LittleFS.open("/config.json", "w");
    if (!f) return;
    serializeJson(doc, f);
    f.close();
}
