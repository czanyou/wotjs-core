#ifndef _UTIL_LOG_H
#define _UTIL_LOG_H

#if CONFIG_SYSLOG

#if defined(__linux__) || defined(__linux)
#include <syslog.h>
#endif

#ifndef LOG_D
#define LOG_F(fmt, ...) printf("FATAL: " fmt "\r\n", ##__VA_ARGS__); syslog(LOG_CRIT, fmt, ##__VA_ARGS__)
#define LOG_E(fmt, ...) printf("ERROR: " fmt "\r\n", ##__VA_ARGS__); syslog(LOG_ERR, fmt, ##__VA_ARGS__)
#define LOG_W(fmt, ...) printf("WARN:  " fmt "\r\n", ##__VA_ARGS__); syslog(LOG_WARNING, fmt, ##__VA_ARGS__)
#define LOG_I(fmt, ...) printf("INFO:  " fmt "\r\n", ##__VA_ARGS__); syslog(LOG_INFO, fmt, ##__VA_ARGS__)
#define LOG_D(fmt, ...) printf("DEBUG: " fmt "\r\n", ##__VA_ARGS__)
#endif

#ifndef LOGT_D
#define LOGT_F(fmt, ...) printf("FATAL: " TAG ": " fmt "\r\n", ##__VA_ARGS__); syslog(LOG_CRIT, TAG ": " fmt, ##__VA_ARGS__)
#define LOGT_E(fmt, ...) printf("ERROR: " TAG ": " fmt "\r\n", ##__VA_ARGS__); syslog(LOG_ERR, TAG ": " fmt, ##__VA_ARGS__)
#define LOGT_W(fmt, ...) printf("WARN:  " TAG ": " fmt "\r\n", ##__VA_ARGS__); syslog(LOG_WARNING, TAG ": " fmt, ##__VA_ARGS__)
#define LOGT_I(fmt, ...) printf("INFO:  " TAG ": " fmt "\r\n", ##__VA_ARGS__); syslog(LOG_INFO, TAG ": " fmt, ##__VA_ARGS__)
#define LOGT_D(fmt, ...) printf("DEBUG: " TAG ": " fmt "\r\n", ##__VA_ARGS__)
#endif

#elif CONFIG_ANDROID_LOG2
#include <android/log.h>

#ifndef LOG_D
#define LOG_D(...) __android_log_print(ANDROID_LOG_DEBUG, "jni", __VA_ARGS__)
#define LOG_I(...) __android_log_print(ANDROID_LOG_INFO, "jni", __VA_ARGS__)
#define LOG_W(...) __android_log_print(ANDROID_LOG_WARN, "jni", __VA_ARGS__)
#define LOG_E(...) __android_log_print(ANDROID_LOG_ERROR, "jni", __VA_ARGS__)
#define LOG_F(...) __android_log_print(ANDROID_LOG_FATAL, "jni", __VA_ARGS__)
#endif

#ifndef LOGT_D
#define LOGT_D(...) __android_log_print(ANDROID_LOG_DEBUG, TAG, __VA_ARGS__)
#define LOGT_I(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGT_W(...) __android_log_print(ANDROID_LOG_WARN, TAG, __VA_ARGS__)
#define LOGT_E(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)
#define LOGT_F(...) __android_log_print(ANDROID_LOG_FATAL, TAG, __VA_ARGS__)
#endif

#else

#ifndef LOG_D
#define LOG_F(fmt, ...) printf("FATAL: " fmt "\r\n", ##__VA_ARGS__)
#define LOG_E(fmt, ...) printf("ERROR: " fmt "\r\n", ##__VA_ARGS__)
#define LOG_W(fmt, ...) printf("WARN:  " fmt "\r\n", ##__VA_ARGS__)
#define LOG_I(fmt, ...) printf("INFO:  " fmt "\r\n", ##__VA_ARGS__)
#define LOG_D(fmt, ...) printf("DEBUG: " fmt "\r\n", ##__VA_ARGS__)
#endif

#ifndef LOGT_D
#define LOGT_F(fmt, ...) printf("FATAL: " TAG ": " fmt "\r\n", ##__VA_ARGS__)
#define LOGT_E(fmt, ...) printf("ERROR: " TAG ": " fmt "\r\n", ##__VA_ARGS__)
#define LOGT_W(fmt, ...) printf("WARN:  " TAG ": " fmt "\r\n", ##__VA_ARGS__)
#define LOGT_I(fmt, ...) printf("INFO:  " TAG ": " fmt "\r\n", ##__VA_ARGS__)
#define LOGT_D(fmt, ...) printf("DEBUG: " TAG ": " fmt "\r\n", ##__VA_ARGS__)
#endif

#endif

#endif // _UTIL_LOG_H
