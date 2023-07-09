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

#include "private.h"
#include "tjs.h"

extern const uint8_t mjs_abort_controller[];
extern const uint32_t mjs_abort_controller_size;

extern const uint8_t mjs_assert[];
extern const uint32_t mjs_assert_size;

extern const uint8_t mjs_bootstrap[];
extern const uint32_t mjs_bootstrap_size;

extern const uint8_t mjs_native_bootstrap[];
extern const uint32_t mjs_native_bootstrap_size;

extern const uint8_t mjs_config[];
extern const uint32_t mjs_config_size;

extern const uint8_t mjs_console[];
extern const uint32_t mjs_console_size;

extern const uint8_t mjs_crypto[];
extern const uint32_t mjs_crypto_size;

extern const uint8_t mjs_devices[];
extern const uint32_t mjs_devices_size;

extern const uint8_t mjs_dns[];
extern const uint32_t mjs_dns_size;

extern const uint8_t mjs_encoding[];
extern const uint32_t mjs_encoding_size;

extern const uint8_t mjs_event_target[];
extern const uint32_t mjs_event_target_size;

extern const uint8_t mjs_fetch[];
extern const uint32_t mjs_fetch_size;

extern const uint8_t mjs_form_data[];
extern const uint32_t mjs_form_data_size;

extern const uint8_t mjs_fs[];
extern const uint32_t mjs_fs_size;

extern const uint8_t mjs_getopts[];
extern const uint32_t mjs_getopts_size;

extern const uint8_t mjs_gpio[];
extern const uint32_t mjs_gpio_size;

extern const uint8_t mjs_http[];
extern const uint32_t mjs_http_size;

extern const uint8_t mjs_logs[];
extern const uint32_t mjs_logs_size;

extern const uint8_t mjs_mqtt[];
extern const uint32_t mjs_mqtt_size;

extern const uint8_t mjs_navigator[];
extern const uint32_t mjs_navigator_size;

extern const uint8_t mjs_net[];
extern const uint32_t mjs_net_size;

extern const uint8_t mjs_os[];
extern const uint32_t mjs_os_size;

extern const uint8_t mjs_path[];
extern const uint32_t mjs_path_size;

extern const uint8_t mjs_storage[];
extern const uint32_t mjs_storage_size;

extern const uint8_t mjs_performance[];
extern const uint32_t mjs_performance_size;

extern const uint8_t mjs_process[];
extern const uint32_t mjs_process_size;

extern const uint8_t mjs_tls[];
extern const uint32_t mjs_tls_size;

extern const uint8_t mjs_serial[];
extern const uint32_t mjs_serial_size;

extern const uint8_t mjs_url[];
extern const uint32_t mjs_url_size;

extern const uint8_t mjs_util[];
extern const uint32_t mjs_util_size;

extern const uint8_t mjs_wasm[];
extern const uint32_t mjs_wasm_size;

extern const uint8_t mjs_wot[];
extern const uint32_t mjs_wot_size;

int tjs__eval_binary(JSContext* ctx, const uint8_t* buf, size_t buf_len)
{
    JSValue obj = JS_ReadObject(ctx, buf, buf_len, JS_READ_OBJ_BYTECODE);
    if (JS_IsException(obj)) {
        goto error;
    }

    if (JS_VALUE_GET_TAG(obj) == JS_TAG_MODULE) {
        if (JS_ResolveModule(ctx, obj) < 0) {
            JS_FreeValue(ctx, obj);
            goto error;
        }

        js_module_set_import_meta(ctx, obj, FALSE, FALSE);
    }

    JSValue val = JS_EvalFunction(ctx, obj);
    if (JS_IsException(val)) {
        goto error;
    }

    JS_FreeValue(ctx, val);

    return 0;

error:
    tjs_dump_error(ctx);
    return -1;
}

void tjs__bootstrap_globals(JSContext* ctx)
{
#ifdef ENABLE_BOOTSTRAP
    /* Load bootstrap */
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_native_bootstrap, mjs_native_bootstrap_size));

    /* Load TextEncoder / TextDecoder */
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_encoding, mjs_encoding_size));

    /* Load Console */
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_console, mjs_console_size));

    /* Load Crypto */
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_crypto, mjs_crypto_size));

    /* Load EventTarget */
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_event_target, mjs_event_target_size));

    /* Load FormData */
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_form_data, mjs_form_data_size));

    /* Load Performance */
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_storage, mjs_storage_size));

    /* Load Performance */
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_performance, mjs_performance_size));

    /* Load URL */
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_url, mjs_url_size));

    /* Load File system */
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_fs, mjs_fs_size));

    /* Load System */
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_os, mjs_os_size));
    
    /* Load Process */
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_process, mjs_process_size));

    /* Load AbortController */
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_abort_controller, mjs_abort_controller_size));

    /* Load WebAssembly */
#ifndef DISABLE_WASM
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_wasm, mjs_wasm_size));
#endif

    /* Load Navigator */
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_navigator, mjs_navigator_size));

    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_bootstrap, mjs_bootstrap_size));
#endif
}

void tjs__add_builtins(JSContext* ctx)
{
#ifdef ENABLE_BOOTSTRAP
    // core
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_assert, mjs_assert_size));
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_path, mjs_path_size));
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_util, mjs_util_size));
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_logs, mjs_logs_size));

    // net
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_dns, mjs_dns_size));
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_net, mjs_net_size));
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_tls, mjs_tls_size));
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_http, mjs_http_size));
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_fetch, mjs_fetch_size));
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_mqtt, mjs_mqtt_size));
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_wot, mjs_wot_size));

    // ext
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_config, mjs_config_size));
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_getopts, mjs_getopts_size));
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_serial, mjs_serial_size));
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_gpio, mjs_gpio_size));
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_devices, mjs_devices_size));
#endif
}
