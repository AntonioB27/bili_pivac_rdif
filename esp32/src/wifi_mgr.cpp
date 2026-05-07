#include "wifi_mgr.h"
#include "led.h"
#include <WiFi.h>
#include <WiFiManager.h>

void wifiInit(Config& cfg) {
    WiFiManager wm;
    wm.setConfigPortalBlocking(false);

    WiFiManagerParameter urlParam("supabase_url",      "Supabase URL",      cfg.supabase_url,      127);
    WiFiManagerParameter keyParam("supabase_anon_key", "Supabase Anon Key", cfg.supabase_anon_key, 511);
    WiFiManagerParameter secretParam("device_secret",  "Device Secret",     cfg.device_secret,      63);
    wm.addParameter(&urlParam);
    wm.addParameter(&keyParam);
    wm.addParameter(&secretParam);

    bool connected = wm.autoConnect("RFID-BP-Setup");

    if (!connected) {
        // Portal is open — animate purple until user connects
        while (!WiFi.isConnected()) {
            wm.process();
            ledPulse(128, 0, 128);
            delay(20);
        }
        ledOff();
    }

    // Save Supabase creds if the user entered them in the portal
    const char* url    = urlParam.getValue();
    const char* key    = keyParam.getValue();
    const char* secret = secretParam.getValue();
    if (url[0] != '\0' && strcmp(url, cfg.supabase_url) != 0) {
        strlcpy(cfg.supabase_url,      url,    sizeof(cfg.supabase_url));
        strlcpy(cfg.supabase_anon_key, key,    sizeof(cfg.supabase_anon_key));
        strlcpy(cfg.device_secret,     secret, sizeof(cfg.device_secret));
        configSave(cfg);
    } else if (secret[0] != '\0' && strcmp(secret, cfg.device_secret) != 0) {
        strlcpy(cfg.device_secret, secret, sizeof(cfg.device_secret));
        configSave(cfg);
    }
}

bool wifiConnected() {
    return WiFi.isConnected();
}
