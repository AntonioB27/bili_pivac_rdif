#pragma once
#include <Arduino.h>

struct QueueEntry {
    char uid[32];
    char scanned_at[32];
};

void queueInit();                  // create empty queue file if missing
bool queueIsEmpty();
void queueEnqueue(const char* uid, const char* scannedAt);
bool queuePeek(QueueEntry& out);   // peek at front without removing
void queueDequeue();               // remove front entry
