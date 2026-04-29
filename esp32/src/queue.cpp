#include "queue.h"
#include "config.h"
#include <LittleFS.h>
#include <ArduinoJson.h>

static const char* PATH = "/queue.json";

static bool _load(JsonDocument& doc) {
    File f = LittleFS.open(PATH, "r");
    if (!f) { doc.to<JsonArray>(); return false; }
    DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err || !doc.is<JsonArray>()) { doc.to<JsonArray>(); return false; }
    return true;
}

static void _save(JsonDocument& doc) {
    File f = LittleFS.open(PATH, "w");
    if (!f) return;
    serializeJson(doc, f);
    f.close();
}

void queueInit() {
    if (!LittleFS.exists(PATH)) {
        File f = LittleFS.open(PATH, "w");
        if (f) { f.print("[]"); f.close(); }
        else   { Serial.println("[QUEUE] ERROR: could not create queue.json"); }
    }
}

bool queueIsEmpty() {
    JsonDocument doc;
    _load(doc);
    return doc.as<JsonArray>().size() == 0;
}

void queueEnqueue(const char* uid, const char* scannedAt) {
    JsonDocument doc;
    _load(doc);
    JsonArray arr = doc.as<JsonArray>();
    while ((int)arr.size() >= QUEUE_MAX) arr.remove(0);  // drop oldest if full
    JsonObject entry  = arr.add<JsonObject>();
    entry["uid"]        = uid;
    entry["scanned_at"] = scannedAt;
    _save(doc);
}

bool queuePeek(QueueEntry& out) {
    JsonDocument doc;
    _load(doc);
    JsonArray arr = doc.as<JsonArray>();
    if (arr.size() == 0) return false;
    strlcpy(out.uid,        arr[0]["uid"]        | "", sizeof(out.uid));
    strlcpy(out.scanned_at, arr[0]["scanned_at"] | "", sizeof(out.scanned_at));
    return true;
}

void queueDequeue() {
    JsonDocument doc;
    _load(doc);
    JsonArray arr = doc.as<JsonArray>();
    if (arr.size() == 0) return;
    arr.remove(0);
    _save(doc);
}
