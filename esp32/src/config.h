#pragma once

// RC522 (SPI2) pins
#define PIN_MOSI    11
#define PIN_MISO    13
#define PIN_SCK     12
#define PIN_SS      10
#define PIN_RST     9

// RGB LED (LEDC PWM)
#define PIN_LED_R   4
#define PIN_LED_G   5
#define PIN_LED_B   6
#define LEDC_FREQ   5000
#define LEDC_RES    8

// Timing
#define DEBOUNCE_MS      10000UL
#define HTTP_TIMEOUT_MS  10000
#define QUEUE_MAX        500

// NTP
#define NTP_SERVER  "pool.ntp.org"
