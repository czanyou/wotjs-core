#include <errno.h>
#include <fcntl.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#if defined(__linux__) || defined(__linux)
#include <sys/ioctl.h>
#include <sys/select.h>
#include <sys/stat.h>
#include <syslog.h>
#include <termios.h>
#endif

#include "private.h"
#include "tjs-utils.h"
#include "util/uart.h"

#if defined(__linux__) || defined(__linux)

/* Events */
enum tjs_uart_events {
    UART_EVENT_CLOSE = 0,
    UART_EVENT_DISCONNECT,
    UART_EVENT_OPEN,
    UART_EVENT_ERROR,
    UART_EVENT_MESSAGE,
    UART_EVENT_MAX,
};

typedef struct tjs_uart_t {
    JSContext* ctx;
    int read_start;
    int closed;
    int fd;
    int finalized;
    int poll_state;

    uv_poll_t poll_handle;
    JSValue events[UART_EVENT_MAX];
    DynBuf read_buffer;
} TJSUart;

static JSClassID tjs_uart_class_id;

static void tjs_uart_close_callback(uv_handle_t* handle);
static TJSUart* tjs_uart_get(JSContext* ctx, JSValueConst obj);
static int tjs_uart_poll_start(JSContext* ctx, TJSUart* uart);
static int tjs_uart_poll_stop(JSContext* ctx, TJSUart* uart);

static JSValue tjs_uart_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        return JS_EXCEPTION;
    }

    int fd = 0;
    if (!JS_IsUndefined(argv[0]) && JS_ToInt32(ctx, &fd, argv[0])) {
        return JS_EXCEPTION;
    }

    if (fd <= 0) {
        return JS_EXCEPTION;
    }

    TJSUart* uart;
    JSValue obj;
    int r;

    obj = JS_NewObjectClass(ctx, tjs_uart_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    uart = calloc(1, sizeof(*uart));
    if (!uart) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    uart->ctx = ctx;

    dbuf_init(&uart->read_buffer);
    uart->read_start = 0;
    uart->finalized = 0;
    uart->closed = 0;
    uart->fd = fd;
    uart->poll_state = 0;

    for (int i = 0; i < UART_EVENT_MAX; i++) {
        uart->events[i] = JS_UNDEFINED;
    }

    uart->poll_state = 1;
    int ret = uv_poll_init(TJS_GetLoop(ctx), &uart->poll_handle, uart->fd);
    uart->poll_handle.data = uart;

    JS_SetOpaque(obj, uart);
    return obj;
}

static void tjs_uart_clear(TJSUart* uart)
{
    JSContext* ctx = uart->ctx;

    for (int i = 0; i < UART_EVENT_MAX; i++) {
        JS_FreeValue(ctx, uart->events[i]);
        uart->events[i] = JS_UNDEFINED;
    }

    dbuf_free(&uart->read_buffer);
}

static void tjs_uart_close_callback(uv_handle_t* handle)
{
    TJSUart* uart = (TJSUart*)handle->data;
    CHECK_NOT_NULL(uart);

    uart->closed = 1;
    if (uart->finalized) {
        free(uart);
    }
}

static void tjs_uart_maybe_close(TJSUart* uart)
{
    if (!uv_is_closing((uv_handle_t*)&uart->poll_handle)) {
        uv_close((uv_handle_t*)&uart->poll_handle, tjs_uart_close_callback);
    }
}

static JSValue tjs_uart_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uart = tjs_uart_get(ctx, this_val);
    CHECK_NOT_NULL(uart);

    tjs_uart_poll_stop(ctx, uart);

    if (uart->fd > 0) {
        close(uart->fd);
        uart->fd = -1;

        tjs_uart_clear(uart);
    }

    tjs_uart_maybe_close(uart);
    return JS_UNDEFINED;
}

static void tjs_uart_event_emit(JSContext* ctx, TJSUart* uart, int event, JSValue arg)
{
    CHECK_NOT_NULL(uart);

    JSValue callback = uart->events[event];
    if (!JS_IsFunction(ctx, callback)) {
        JS_FreeValue(ctx, arg);
        return;
    }

    JSValue func = JS_DupValue(ctx, callback);
    JSValue ret = JS_Call(ctx, func, JS_UNDEFINED, 1, (JSValueConst*)&arg);
    if (JS_IsException(ret)) {
        TJS_DumpError(ctx);
    }

    JS_FreeValue(ctx, ret);
    JS_FreeValue(ctx, func);
    JS_FreeValue(ctx, arg);
}

static JSValue tjs_uart_event_get(JSContext* ctx, JSValueConst this_val, int magic)
{
    TJSUart* uart = tjs_uart_get(ctx, this_val);
    CHECK_NOT_NULL(uart);

    return JS_DupValue(ctx, uart->events[magic]);
}

static JSValue tjs_uart_event_set(JSContext* ctx, JSValueConst this_val, JSValueConst value, int magic)
{
    TJSUart* uart = tjs_uart_get(ctx, this_val);
    CHECK_NOT_NULL(uart);

    if (!(JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value))) {
        return JS_UNDEFINED;
    }

    if (magic == UART_EVENT_MESSAGE) {
        if (JS_IsFunction(ctx, value)) {
            if (!uart->read_start) {
                uart->read_start = 1;
                tjs_uart_poll_start(ctx, uart);
            }

        } else {
            if (uart->read_start) {
                uart->read_start = 0;
                tjs_uart_poll_stop(ctx, uart);
            }
        }
    }

    JS_FreeValue(ctx, uart->events[magic]);
    uart->events[magic] = JS_DupValue(ctx, value);

    return JS_UNDEFINED;
}

static JSValue tjs_uart_fileno(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uart = tjs_uart_get(ctx, this_val);
    CHECK_NOT_NULL(uart);

    return JS_NewInt32(ctx, uart->fd);
}

static void tjs_uart_finalizer(JSRuntime* runtime, JSValue val)
{
    TJSUart* uart = JS_GetOpaque(val, tjs_uart_class_id);
    CHECK_NOT_NULL(uart);

    tjs_uart_clear(uart);

    uart->finalized = 1;

    if (uart->closed) {
        free(uart);

    } else {
        tjs_uart_maybe_close(uart);
    }
}

static JSValue tjs_uart_flush(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uart = tjs_uart_get(ctx, this_val);
    CHECK_NOT_NULL(uart);

    uart_result_t status = uart_flush(uart->fd);
    return JS_NewInt32(ctx, status);
}

static TJSUart* tjs_uart_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, tjs_uart_class_id);
}

static void tjs_uart_mark(JSRuntime* runtime, JSValueConst val, JS_MarkFunc* mark_func)
{
    TJSUart* uart = JS_GetOpaque(val, tjs_uart_class_id);
    CHECK_NOT_NULL(uart);

    for (int i = 0; i < UART_EVENT_MAX; i++) {
        JS_MarkValue(runtime, uart->events[i], mark_func);
    }
}

static void tjs_uart_poll_callback(uv_poll_t* handle, int status, int events)
{
    // printf("tjs_uart_poll_callback(%d) = %d\r\n", status, events);
    TJSUart* uart = (TJSUart*)handle->data;
    CHECK_NOT_NULL(uart);

    JSContext* ctx = uart->ctx;
    CHECK_NOT_NULL(ctx);

    if (events & UV_READABLE) {
        size_t size = 64;
        uint8_t* buffer = js_malloc(ctx, size);

        int ret = uart_read(uart->fd, buffer, size);
        if (ret <= 0) {
            js_free(ctx, buffer);
            return;
        }

        JSValue data = TJS_NewArrayBuffer(ctx, buffer, ret);
        tjs_uart_event_emit(uart->ctx, uart, UART_EVENT_MESSAGE, data);

    } else if (events & UV_DISCONNECT) {
        tjs_uart_event_emit(uart->ctx, uart, UART_EVENT_DISCONNECT, JS_UNDEFINED);
    }
}

static int tjs_uart_poll_start(JSContext* ctx, TJSUart* uart)
{
    CHECK_NOT_NULL(uart);

    if (uart->fd <= 0) {
        return -1;
    }

    int ret = uv_poll_start(&uart->poll_handle, UV_READABLE, tjs_uart_poll_callback);
    return ret;
}

static int tjs_uart_poll_stop(JSContext* ctx, TJSUart* uart)
{
    CHECK_NOT_NULL(uart);
    if (uart->poll_state == 1) {
        uart->poll_state = 0;
        return uv_poll_stop(&uart->poll_handle);
    }

    return 0;
}

static JSValue tjs_uart_read(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uart = tjs_uart_get(ctx, this_val);
    CHECK_NOT_NULL(uart);

    size_t size = 128;
    uint8_t* buffer = js_malloc(ctx, size);

    int ret = uart_read(uart->fd, buffer, size);
    if (ret <= 0) {
        js_free(ctx, buffer);
        return JS_UNDEFINED;
    }

    return TJS_NewArrayBuffer(ctx, buffer, ret);
}

static JSValue tjs_uart_set_baudrate(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uart = tjs_uart_get(ctx, this_val);
    CHECK_NOT_NULL(uart);

    int baud = 0;
    if (argc > 1) {
        int ret = JS_ToInt32(ctx, &baud, argv[1]);
        if (baud <= 0) {
            return JS_UNDEFINED;
        }
    }

    uart_result_t status = uart_set_baudrate(uart->fd, baud);
    return JS_NewInt32(ctx, status);
}

static JSValue tjs_uart_set_flow_control(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uart = tjs_uart_get(ctx, this_val);
    CHECK_NOT_NULL(uart);

    int ret = 0;
    int xonxoff = 0;
    if (argc > 1) {
        ret = JS_ToInt32(ctx, &xonxoff, argv[1]);
        if (xonxoff < 0) {
            return JS_UNDEFINED;
        }
    }

    int rtscts = 0;
    ret = JS_ToInt32(ctx, &rtscts, argv[2]);
    if (rtscts < 0) {
        return JS_UNDEFINED;
    }

    uart_result_t status = uart_set_flow_control(uart->fd, xonxoff, rtscts);
    return JS_NewInt32(ctx, status);
}

static JSValue tjs_uart_set_mode(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uart = tjs_uart_get(ctx, this_val);
    CHECK_NOT_NULL(uart);

    int ret = 0;
    int partiy = 0;
    if (argc > 1) {
        ret = JS_ToInt32(ctx, &partiy, argv[1]);
        if (partiy < 0) {
            partiy = UART_PARITY_NONE;
        }
    }

    int bytesize = 0;
    if (argc > 2) {
        ret = JS_ToInt32(ctx, &bytesize, argv[2]);
        if (bytesize <= 0) {
            bytesize = 8;
        }
    }

    int stopbits = 0;
    if (argc > 3) {
        ret = JS_ToInt32(ctx, &stopbits, argv[3]);
        if (stopbits <= 0) {
            stopbits = 1;
        }
    }

    uart_result_t status = uart_set_mode(uart->fd, bytesize, partiy, stopbits);
    return JS_NewInt32(ctx, status);
}

static JSValue tjs_uart_set_non_blocking(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uart = tjs_uart_get(ctx, this_val);
    CHECK_NOT_NULL(uart);

    int nonNlocking = 0;
    if (argc > 1) {
        int ret = JS_ToInt32(ctx, &nonNlocking, argv[1]);
        if (nonNlocking <= 0) {
            return JS_UNDEFINED;
        }
    }

    uart_result_t status = uart_set_non_blocking(uart->fd, nonNlocking);
    return JS_NewInt32(ctx, status);
}

static JSValue tjs_uart_set_timeout(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uart = tjs_uart_get(ctx, this_val);
    CHECK_NOT_NULL(uart);

    int timeout = 0;
    int ret = JS_ToInt32(ctx, &timeout, argv[0]);
    if (timeout <= 0) {
        return JS_UNDEFINED;
    }

    uart_result_t status = uart_set_timeout(uart->fd, timeout, 0, 0);
    return JS_NewInt32(ctx, status);
}

static JSValue tjs_uart_wait(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uart = tjs_uart_get(ctx, this_val);
    CHECK_NOT_NULL(uart);

    int ret = uart_wait(uart->fd, 1000);
    return JS_UNDEFINED;
}

static JSValue tjs_uart_write(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uart = tjs_uart_get(ctx, this_val);
    CHECK_NOT_NULL(uart);

    tjs_buffer_t buffer = TJS_ToArrayBuffer(ctx, argv[0]);
    if (JS_IsException(buffer.error)) {
        return buffer.error;
    }

    int ret = uart_write(uart->fd, buffer.data, buffer.length);
    if (buffer.is_string) {
        JS_FreeCString(ctx, (char*)buffer.data);
    }

    return JS_NewInt32(ctx, ret);
}

static JSClassDef tjs_uart_class = {
    "UART",
    .finalizer = tjs_uart_finalizer,
    .gc_mark = tjs_uart_mark,
};

static const JSCFunctionListEntry tjs_uart_proto_funcs[] = {
    TJS_CGETSET_MAGIC_DEF("onclose", tjs_uart_event_get, tjs_uart_event_set, UART_EVENT_CLOSE),
    TJS_CGETSET_MAGIC_DEF("onerror", tjs_uart_event_get, tjs_uart_event_set, UART_EVENT_ERROR),
    TJS_CGETSET_MAGIC_DEF("ondisconnect", tjs_uart_event_get, tjs_uart_event_set, UART_EVENT_DISCONNECT),
    TJS_CGETSET_MAGIC_DEF("onmessage", tjs_uart_event_get, tjs_uart_event_set, UART_EVENT_MESSAGE),
    TJS_CFUNC_DEF("fileno", 0, tjs_uart_fileno),
    TJS_CFUNC_DEF("flush", 0, tjs_uart_flush),
    TJS_CFUNC_DEF("read", 1, tjs_uart_read),
    TJS_CFUNC_DEF("close", 1, tjs_uart_close),
    TJS_CFUNC_DEF("setBaudrate", 1, tjs_uart_set_baudrate),
    TJS_CFUNC_DEF("setFlowControl", 1, tjs_uart_set_flow_control),
    TJS_CFUNC_DEF("setMode", 1, tjs_uart_set_mode),
    TJS_CFUNC_DEF("setNonBlocking ", 1, tjs_uart_set_non_blocking),
    TJS_CFUNC_DEF("setTimeout", 1, tjs_uart_set_timeout),
    TJS_CFUNC_DEF("wait", 1, tjs_uart_wait),
    TJS_CFUNC_DEF("write", 1, tjs_uart_write)
};

static JSValue tjs_uart_open(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    int ret = 0;
    int baudrate = 0;
    if (argc > 1) {
        ret = JS_ToInt32(ctx, &baudrate, argv[1]);
        if (baudrate <= 0) {
            baudrate = 9600;
        }
    }

    int partiy = 0;
    if (argc > 2) {
        ret = JS_ToInt32(ctx, &partiy, argv[2]);
        if (partiy <= 0) {
            partiy = UART_PARITY_NONE;
        }
    }

    int databits = 0;
    if (argc > 3) {
        ret = JS_ToInt32(ctx, &databits, argv[3]);
        if (databits <= 0) {
            databits = 8;
        }
    }

    int stopbits = 0;
    if (argc > 4) {
        ret = JS_ToInt32(ctx, &stopbits, argv[4]);
        if (stopbits <= 0) {
            stopbits = 1;
        }
    }

    const char* path = NULL;
    if (argc > 0) {
        path = JS_ToCString(ctx, argv[0]);
    }

    if (!path) {
        return JS_UNDEFINED;
    }

    int fd = uart_open(path);
    JS_FreeCString(ctx, path);

    if (fd <= 0) {
        return JS_UNDEFINED;
    }

    uart_set_options(fd, baudrate, partiy, databits, stopbits);
    return JS_NewInt32(ctx, fd);
}

static JSValue tjs_uart_get_signals(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        return JS_UNDEFINED;
    }

    // fd
    int fd = 0;
    int ret = JS_ToInt32(ctx, &fd, argv[0]);
    if (fd <= 0) {
        return JS_UNDEFINED;
    }

    int ctrlbits = 0;
    ioctl(fd, TIOCMGET, &ctrlbits);
    return JS_NewInt32(ctx, ctrlbits);
}

static JSValue tjs_uart_set_dtr(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 2) {
        return JS_UNDEFINED;
    }

    int fd = 0;
    int ret = JS_ToInt32(ctx, &fd, argv[0]);
    if (fd <= 0) {
        return JS_UNDEFINED;
    }

    int flag = 0;
    ret = JS_ToInt32(ctx, &flag, argv[1]);
    if (flag <= 0) {
        flag = 0;

    } else {
        flag = 1;
    }

    int ctrlbits = 0;
    ioctl(fd, TIOCMGET, &ctrlbits);
    if (flag) {
        ctrlbits |= TIOCM_DTR;

    } else {
        ctrlbits &= ~TIOCM_DTR;
    }

    ioctl(fd, TIOCMSET, &ctrlbits);
    return JS_UNDEFINED;
}

static JSValue tjs_uart_set_options(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    int fd = 0;
    int ret = JS_ToInt32(ctx, &fd, argv[0]);
    if (fd <= 0) {
        return JS_UNDEFINED;
    }

    int baudrate = 0;
    if (argc > 1) {
        ret = JS_ToInt32(ctx, &baudrate, argv[1]);
        if (baudrate <= 0) {
            baudrate = 9600;
        }
    }

    int partiy = 0;
    if (argc > 2) {
        ret = JS_ToInt32(ctx, &partiy, argv[2]);
        if (partiy < 0) {
            partiy = UART_PARITY_NONE;
        }
    }

    int databits = 0;
    if (argc > 3) {
        ret = JS_ToInt32(ctx, &databits, argv[3]);
        if (databits <= 0) {
            databits = 8;
        }
    }

    int stopbits = 0;
    if (argc > 4) {
        ret = JS_ToInt32(ctx, &stopbits, argv[4]);
        if (stopbits <= 0) {
            stopbits = 1;
        }
    }

    uart_set_options(fd, baudrate, partiy, databits, stopbits);
    return JS_NewInt32(ctx, fd);
}

static JSValue tjs_uart_set_rts(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 2) {
        return JS_UNDEFINED;
    }

    // fd
    int fd = 0;
    int ret = JS_ToInt32(ctx, &fd, argv[0]);
    if (fd <= 0) {
        return JS_UNDEFINED;
    }

    // flag
    int flag = 0;
    ret = JS_ToInt32(ctx, &flag, argv[1]);
    if (flag <= 0) {
        flag = 0;

    } else {
        flag = 1;
    }

    int ctrlbits = 0;
    ioctl(fd, TIOCMGET, &ctrlbits);
    if (flag) {
        ctrlbits |= TIOCM_RTS;

    } else {
        ctrlbits &= ~TIOCM_RTS;
    }

    ioctl(fd, TIOCMSET, &ctrlbits);
    return JS_UNDEFINED;
}

static JSValue tjs_uart_set_signals(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 3) {
        return JS_UNDEFINED;
    }

    // fd
    int fd = 0;
    int ret = JS_ToInt32(ctx, &fd, argv[0]);
    if (fd <= 0) {
        return JS_UNDEFINED;
    }

    // type
    int type = 0;
    ret = JS_ToInt32(ctx, &type, argv[1]);

    // flag
    int flag = 0;
    ret = JS_ToInt32(ctx, &flag, argv[1]);
    if (flag <= 0) {
        flag = 0;

    } else {
        flag = 1;
    }

    int ctrlbits = 0;
    ioctl(fd, TIOCMGET, &ctrlbits);
    if (type) {
        ctrlbits |= type & flag;
        ctrlbits &= ~(type & (~flag));
    }

    ioctl(fd, TIOCMSET, &ctrlbits);
    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_uart_funcs[] = {
    JS_PROP_INT32_DEF("PARITY_EVEN", UART_PARITY_EVEN, 0),
    JS_PROP_INT32_DEF("PARITY_NONE", UART_PARITY_NONE, 0),
    JS_PROP_INT32_DEF("PARITY_ODD", UART_PARITY_ODD, 0),
    TJS_CFUNC_DEF("getSignals", 1, tjs_uart_get_signals),
    TJS_CFUNC_DEF("open", 5, tjs_uart_open),
    TJS_CFUNC_DEF("setDTR", 2, tjs_uart_set_dtr),
    TJS_CFUNC_DEF("setOptions", 5, tjs_uart_set_options),
    TJS_CFUNC_DEF("setRTS", 2, tjs_uart_set_rts),
    TJS_CFUNC_DEF("setSignals", 3, tjs_uart_set_signals)
};

#endif

void tjs_mod_uart_init(JSContext* ctx, JSModuleDef* module)
{
#if defined(__linux__) || defined(__linux)
    /* class */
    JS_NewClassID(&tjs_uart_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_uart_class_id, &tjs_uart_class);
    JSValue prototype = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, prototype, tjs_uart_proto_funcs, countof(tjs_uart_proto_funcs));
    JS_SetClassProto(ctx, tjs_uart_class_id, prototype);

    /* constructor */
    JSValue constructor = JS_NewCFunction2(ctx, tjs_uart_constructor, "UART", 1, JS_CFUNC_constructor, 0);

    /* object */
    JSValue uart = JS_NewObject(ctx);
    JS_DefinePropertyValueStr(ctx, uart, "UART", constructor, JS_PROP_C_W_E);
    JS_SetPropertyFunctionList(ctx, uart, tjs_uart_funcs, countof(tjs_uart_funcs));
    JS_SetModuleExport(ctx, module, "uart", uart);

#endif
}

void tjs_mod_uart_export(JSContext* ctx, JSModuleDef* module)
{
    JS_AddModuleExport(ctx, module, "uart");
}
