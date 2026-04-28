#include "http_client.h"
#include "config.h"
#include <HTTPClient.h>
#include <ArduinoJson.h>

ScanResult httpSendScan(const char* supabaseUrl, const char* anonKey,
                        const char* uid, const char* scannedAt) {
    HTTPClient http;
    String url = String(supabaseUrl) + "/rest/v1/rpc/handle_rfid_scan";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", anonKey);
    http.addHeader("Authorization", String("Bearer ") + anonKey);
    http.setTimeout(HTTP_TIMEOUT_MS);

    JsonDocument body;
    body["uid"]        = uid;
    body["scanned_at"] = scannedAt;
    String bodyStr;
    serializeJson(body, bodyStr);

    int code = http.POST(bodyStr);
    if (code < 200 || code >= 300) {
        http.end();
        return ScanResult::Error;
    }

    String response = http.getString();
    http.end();

    JsonDocument resp;
    if (deserializeJson(resp, response) != DeserializationError::Ok) {
        return ScanResult::Error;
    }

    const char* status = resp["status"] | "";
    if (strcmp(status, "clock_in")  == 0) return ScanResult::ClockIn;
    if (strcmp(status, "clock_out") == 0) return ScanResult::ClockOut;
    if (strcmp(status, "too_soon")  == 0) return ScanResult::TooSoon;
    if (strcmp(status, "not_found") == 0) return ScanResult::NotFound;
    return ScanResult::Error;
}
