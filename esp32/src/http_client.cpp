#include "http_client.h"
#include "config.h"
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

ScanResult httpSendScan(const char* supabaseUrl, const char* anonKey,
                        const char* uid, const char* scannedAt) {
    WiFiClientSecure client;
    client.setInsecure();  // skip cert verification — acceptable for internal IoT device
    HTTPClient http;
    String url = String(supabaseUrl) + "/rest/v1/rpc/handle_rfid_scan";
    http.begin(client, url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", anonKey);
    http.addHeader("Authorization", String("Bearer ") + anonKey);
    http.setTimeout(HTTP_TIMEOUT_MS);

    JsonDocument body;
    body["p_uid"]        = uid;
    body["p_scanned_at"] = scannedAt;
    String bodyStr;
    serializeJson(body, bodyStr);

    int code = http.POST(bodyStr);
    Serial.printf("[HTTP] Status code: %d\n", code);
    if (code < 200 || code >= 300) {
        Serial.printf("[HTTP] Response: %s\n", http.getString().c_str());
        http.end();
        return ScanResult::Error;
    }

    String response = http.getString();
    Serial.printf("[HTTP] Response: %s\n", response.c_str());
    http.end();

    JsonDocument resp;
    if (deserializeJson(resp, response) != DeserializationError::Ok) {
        Serial.println("[HTTP] JSON parse failed");
        return ScanResult::Error;
    }

    const char* status = resp["status"] | "";
    if (strcmp(status, "clock_in")  == 0) return ScanResult::ClockIn;
    if (strcmp(status, "clock_out") == 0) return ScanResult::ClockOut;
    if (strcmp(status, "too_soon")  == 0) return ScanResult::TooSoon;
    if (strcmp(status, "not_found") == 0) return ScanResult::NotFound;
    Serial.printf("[HTTP] Unknown status: '%s'\n", status);
    return ScanResult::Error;
}
