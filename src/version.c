/*
 * QuickJS libuv bindings
 *
 * Copyright (c) 2019-present Saúl Ibarra Corretgé <s@saghul.net>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
#include <string.h>

#include "version.h"
#include "utils.h"

#ifndef TJS_VERSION_SUFFIX
#define TJS_VERSION_SUFFIX ""
#endif

#define TJS_VERSION_STRING       \
    STRINGIFY(TJS_VERSION_MAJOR) \
    "." STRINGIFY(TJS_VERSION_MINOR) "." STRINGIFY(TJS_VERSION_PATCH)

static char tjs__build_string[32] = { 0 };

static void tjs__parse_build_date()
{
    char s_month[5];
    int month, day, year;
    int hour, min, sec;
    
    static const char month_names[] = "JanFebMarAprMayJunJulAugSepOctNovDec";
    sscanf(__DATE__, "%s %d %d", s_month, &day, &year);
    month = (strstr(month_names, s_month) - month_names) / 3 + 1;

    sscanf(__TIME__, "%d:%d:%d", &hour, &min, &sec);
    snprintf(tjs__build_string, sizeof(tjs__build_string), "%04d%02d%02d-%02d%02d",  
        year, month, day, hour, min);
}

const char* tjs_build(void)
{
    if (!tjs__build_string[0]) {
        tjs__parse_build_date();
    }

    return tjs__build_string;
}

const char* tjs_version(void)
{
    return TJS_VERSION_STRING;
}
