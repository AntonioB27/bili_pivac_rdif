#include "rfid.h"
#include "config.h"
#include <SPI.h>
#include <MFRC522.h>

static MFRC522  _rfid(PIN_SS, PIN_RST);
static char     _lastUid[32] = {0};
static uint32_t _lastMs      = 0;

void rfidInit() {
    SPI.begin(PIN_SCK, PIN_MISO, PIN_MOSI, PIN_SS);
    _rfid.PCD_Init();
}

bool rfidRead(char* uidOut, size_t maxLen) {
    if (!_rfid.PICC_IsNewCardPresent()) return false;
    if (!_rfid.PICC_ReadCardSerial())   return false;

    char uid[32] = {0};
    for (uint8_t i = 0; i < _rfid.uid.size && i < 4; i++) {
        char hex[3];
        snprintf(hex, sizeof(hex), "%02X", _rfid.uid.uidByte[i]);
        strncat(uid, hex, sizeof(uid) - strlen(uid) - 1);
    }

    _rfid.PICC_HaltA();
    _rfid.PCD_StopCrypto1();

    uint32_t now = millis();
    if (strcmp(uid, _lastUid) == 0 && (now - _lastMs) < DEBOUNCE_MS) {
        return false;
    }

    strlcpy(_lastUid, uid, sizeof(_lastUid));
    _lastMs = now;
    strlcpy(uidOut, uid, maxLen);
    return true;
}
