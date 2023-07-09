#include <errno.h>
#include <fcntl.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#if defined(__linux__) || defined(__linux)
#include <linux/watchdog.h>
#include <sys/ioctl.h>
#include <sys/select.h>
#include <syslog.h>
#include <termios.h>
#endif

#include "private.h"
#include "tjs-utils.h"

enum tjs_gpio_events {
    TJS_GPIO_EVENT_CLOSE = 0,
    TJS_GPIO_EVENT_END,
    TJS_GPIO_EVENT_ERROR,
    TJS_GPIO_EVENT_POLL,
    TJS_GPIO_EVENT_MAX,
};

typedef struct tjs_gpio_t {
    JSContext* ctx;
    int read_start;
    int closed;
    int fd;
    int finalized;

    uv_poll_t pollHandle;
    JSValue events[TJS_GPIO_EVENT_MAX];
    DynBuf readBuffer;
} TJSGpio;

static JSClassID tjs_gpio_class_id;
static int tjs_gpio_poll_start(JSContext* ctx, TJSGpio* gpioObject);
static int tjs_gpio_poll_stop(JSContext* ctx, TJSGpio* gpioObject);

static TJSGpio* tjs_gpio_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, tjs_gpio_class_id);
}

static JSValue tjs_gpio_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSGpio* gpioObject = tjs_gpio_get(ctx, this_val);
    CHECK_NOT_NULL(gpioObject);

    if (gpioObject->fd > 0) {
        uv_poll_stop(&gpioObject->pollHandle);

        close(gpioObject->fd);
        gpioObject->fd = -1;
    }

    return JS_UNDEFINED;
}

static void tjs_gpio_emit_event(JSContext* ctx, TJSGpio* gpioObject, int event, JSValue arg)
{
    JSValue callback = gpioObject->events[event];
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

static JSValue tjs_gpio_event_get(JSContext* ctx, JSValueConst this_val, int magic)
{
    TJSGpio* gpioObject = tjs_gpio_get(ctx, this_val);
    CHECK_NOT_NULL(gpioObject);

    return JS_DupValue(ctx, gpioObject->events[magic]);
}

static JSValue tjs_gpio_event_set(JSContext* ctx, JSValueConst this_val, JSValueConst value, int magic)
{
    TJSGpio* gpioObject = tjs_gpio_get(ctx, this_val);
    CHECK_NOT_NULL(gpioObject);

    if (!(JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value))) {
        JS_ThrowTypeError(ctx, "invalid argument");
        return JS_EXCEPTION;
    }

    if (magic == TJS_GPIO_EVENT_POLL) {
        if (JS_IsFunction(ctx, value)) {
            if (!gpioObject->read_start) {
                gpioObject->read_start = 1;
                tjs_gpio_poll_start(ctx, gpioObject);
            }

        } else {
            if (gpioObject->read_start) {
                gpioObject->read_start = 0;
                tjs_gpio_poll_stop(ctx, gpioObject);
            }
        }
    }

    JS_FreeValue(ctx, gpioObject->events[magic]);
    gpioObject->events[magic] = JS_DupValue(ctx, value);

    return JS_UNDEFINED;
}

static JSValue tjs_gpio_fileno(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSGpio* gpioObject = tjs_gpio_get(ctx, this_val);
    CHECK_NOT_NULL(gpioObject);

    return JS_NewInt32(ctx, gpioObject->fd);
}

static void tjs_gpio_poll_callback(uv_poll_t* handle, int status, int events)
{
    // printf("tjs_gpio_poll_callback(%d) = %d\r\n", status, events);
    TJSGpio* gpioObject = (TJSGpio*)handle->data;
    JSContext* ctx = gpioObject->ctx;

    if (events & UV_PRIORITIZED) {
        tjs_gpio_emit_event(gpioObject->ctx, gpioObject, TJS_GPIO_EVENT_POLL, JS_UNDEFINED);

    } else if (events & UV_DISCONNECT) {
        tjs_gpio_emit_event(gpioObject->ctx, gpioObject, TJS_GPIO_EVENT_END, JS_UNDEFINED);
    }
}

static int tjs_gpio_poll_start(JSContext* ctx, TJSGpio* gpioObject)
{
    if (gpioObject->fd <= 0) {
        return -1;
    }

    int ret = uv_poll_start(&gpioObject->pollHandle, UV_PRIORITIZED, tjs_gpio_poll_callback);
    return ret;
}

static int tjs_gpio_poll_stop(JSContext* ctx, TJSGpio* gpioObject)
{
    int ret = uv_poll_stop(&gpioObject->pollHandle);
    return ret;
}

static JSValue tjs_gpio_read(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSGpio* gpioObject = tjs_gpio_get(ctx, this_val);
    CHECK_NOT_NULL(gpioObject);

    int fd = gpioObject->fd;
    if (lseek(fd, 0, SEEK_SET) == -1) {
        JS_ThrowTypeError(ctx, "seek failed");
        return JS_EXCEPTION;
    }

    char buffer[2];
    int ret = read(fd, buffer, sizeof(buffer));
    if (ret <= 0) {
        return JS_UNDEFINED;
    }

    return JS_NewInt32(ctx, buffer[0]);
}

static JSValue tjs_gpio_write(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSGpio* gpioObject = tjs_gpio_get(ctx, this_val);
    CHECK_NOT_NULL(gpioObject);

    tjs_buffer_t buffer = TJS_ToArrayBuffer(ctx, argv[0]);
    if (JS_IsException(buffer.error)) {
        return buffer.error;
    }

    int ret = write(gpioObject->fd, buffer.data, buffer.length);
    if (buffer.is_string) {
        JS_FreeCString(ctx, (char*)buffer.data);
    }

    return JS_NewInt32(ctx, ret);
}

static void tjs_gpio_close_callback(uv_handle_t* handle)
{
    TJSGpio* gpioObject = (TJSGpio*)handle->data;
    CHECK_NOT_NULL(gpioObject);

    gpioObject->closed = 1;
    if (gpioObject->finalized) {
        free(gpioObject);
    }
}

static void tjs_gpio_maybe_close(TJSGpio* gpioObject)
{
    if (!uv_is_closing((uv_handle_t*)&gpioObject->pollHandle)) {
        uv_close((uv_handle_t*)&gpioObject->pollHandle, tjs_gpio_close_callback);
    }
}

static void tjs_gpio_finalizer(JSRuntime* runtime, JSValue val)
{
    TJSGpio* gpioObject = JS_GetOpaque(val, tjs_gpio_class_id);
    if (!gpioObject) {
        return;
    }

    for (int i = 0; i < TJS_GPIO_EVENT_MAX; i++) {
        JS_FreeValueRT(runtime, gpioObject->events[i]);
    }

    uv_poll_stop(&gpioObject->pollHandle);
    uv_close((uv_handle_t*)&gpioObject->pollHandle, tjs_gpio_close_callback);

    gpioObject->finalized = 1;

    dbuf_free(&gpioObject->readBuffer);

    if (gpioObject->closed) {
        free(gpioObject);

    } else {
        tjs_gpio_maybe_close(gpioObject);
    }
}

static void tjs_gpio_mark(JSRuntime* runtime, JSValueConst val, JS_MarkFunc* mark_func)
{
    TJSGpio* gpioObject = JS_GetOpaque(val, tjs_gpio_class_id);
    if (gpioObject) {
        for (int i = 0; i < TJS_GPIO_EVENT_MAX; i++) {
            JS_MarkValue(runtime, gpioObject->events[i], mark_func);
        }
    }
}

static JSClassDef tjs_gpio_class = {
    "GPIO",
    .finalizer = tjs_gpio_finalizer,
    .gc_mark = tjs_gpio_mark,
};

static JSValue tjs_gpio_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        JS_ThrowTypeError(ctx, "invalid argument");
        return JS_EXCEPTION;
    }

    int fd = 0;
    if (JS_IsString(argv[0])) {
        const char* path = JS_ToCString(ctx, argv[0]);
        if (!path) {
            return JS_UNDEFINED;
        }

        int flags = O_RDWR | O_TRUNC;
#ifdef O_CLOEXEC // 防止在 exec 后被子进程继承
        flags |= O_CLOEXEC;
#endif

        fd = open(path, flags, 0666);
        JS_FreeCString(ctx, path);

    } else if (!JS_IsUndefined(argv[0]) && JS_ToInt32(ctx, &fd, argv[0])) {
        // JS_ThrowTypeError(ctx, "invalid argument: not a path or fd");
        return JS_UNDEFINED;
    }

    if (fd <= 0) {
        // JS_ThrowTypeError(ctx, "invalid argument: must be a file descriptor");
        return JS_UNDEFINED;
    }

    TJSGpio* gpioObject;
    JSValue obj;
    int r;

    obj = JS_NewObjectClass(ctx, tjs_gpio_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    gpioObject = calloc(1, sizeof(*gpioObject));
    if (!gpioObject) {
        JS_FreeValue(ctx, obj);
        return JS_UNDEFINED;
    }

    gpioObject->ctx = ctx;

    dbuf_init(&gpioObject->readBuffer);
    gpioObject->read_start = 0;
    gpioObject->finalized = 0;
    gpioObject->closed = 0;
    gpioObject->fd = fd;

    int ret = uv_poll_init(TJS_GetLoop(ctx), &gpioObject->pollHandle, gpioObject->fd);
    gpioObject->pollHandle.data = gpioObject;

    JS_SetOpaque(obj, gpioObject);
    return obj;
}

// ////////////////////////////////////////////////////////////////////////////
// watchdog

static JSValue tjs_watchdog_open(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    int ret = 0;

    const char* path = NULL;
    if (argc > 0) {
        path = JS_ToCString(ctx, argv[0]);
    }

    if (!path) {
        return JS_ThrowTypeError(ctx, "path argument must be string");
    }

    int flags = O_RDWR | O_TRUNC;
#ifdef O_CLOEXEC // 防止在 exec 后被子进程继承
    flags |= O_CLOEXEC;
#endif

    int fd = open(path, flags, 0666);
    JS_FreeCString(ctx, path);

    if (fd <= 0) {
        return JS_UNDEFINED;
    }

    return JS_NewInt32(ctx, fd);
}

static JSValue tjs_watchdog_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        JS_ThrowTypeError(ctx, "fd argument must be a file descriptor");
        return JS_UNDEFINED;
    }

    int fd = TJS_ToInt32(ctx, argv[0], -1);
    if (fd <= 0) {
        JS_ThrowTypeError(ctx, "fd argument must be a file descriptor");
        return JS_EXCEPTION;
    }

    int ret = close(fd);
    return JS_NewInt32(ctx, ret);
}

static JSValue tjs_watchdog_keepalive(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        JS_ThrowTypeError(ctx, "not a file descriptor");
        return JS_EXCEPTION;
    }

#if defined(__linux__) || defined(__linux)
    int watchdog = TJS_ToInt32(ctx, argv[0], -1);
    if (watchdog <= 0) {
        JS_ThrowTypeError(ctx, "invalid argument: fd must be a file descriptor");
        return JS_EXCEPTION;
    }

    int dummy = 0;
    int ret = ioctl(watchdog, WDIOC_KEEPALIVE, &dummy);
    if (ret < 0) {
        JS_ThrowInternalError(ctx, "ioctl return '%d'", ret);
        return JS_EXCEPTION;
    }

    // int ret = write(watchdog, "\0", 1);
    return JS_NewInt32(ctx, ret);

#else
    return JS_UNDEFINED;
#endif
}

static JSValue tjs_watchdog_timeout(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        JS_ThrowTypeError(ctx, "not a file descriptor");
        return JS_EXCEPTION;
    }

#if defined(__linux__) || defined(__linux)
    int watchdog = TJS_ToInt32(ctx, argv[0], -1);
    if (watchdog <= 0) {
        JS_ThrowTypeError(ctx, "invalid argument: fd must be a file descriptor");
        return JS_EXCEPTION;
    }

    if (argc > 1) {
        int timeout = TJS_ToInt32(ctx, argv[1], -1);
        if (timeout < 0) {
            JS_ThrowTypeError(ctx, "invalid argument: timeout must be > 0");
            return JS_EXCEPTION;
        }

        int ret = ioctl(watchdog, WDIOC_SETTIMEOUT, &timeout);
        if (ret < 0) {
            JS_ThrowInternalError(ctx, "ioctl return '%d'", ret);
            return JS_EXCEPTION;
        }

        return JS_UNDEFINED;

    } else {
        int timeout = 0;
        int ret = ioctl(watchdog, WDIOC_GETTIMEOUT, &timeout);
        if (ret < 0) {
            JS_ThrowInternalError(ctx, "ioctl return '%d'", ret);
            return JS_EXCEPTION;
        }

        return JS_NewInt32(ctx, timeout);
    }

#else
    return JS_UNDEFINED;
#endif
}

static JSValue tjs_watchdog_enable(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        JS_ThrowTypeError(ctx, "not a file descriptor");
        return JS_EXCEPTION;
    }

#if defined(__linux__) || defined(__linux)
    int watchdog = TJS_ToInt32(ctx, argv[0], -1);
    if (watchdog <= 0) {
        JS_ThrowTypeError(ctx, "invalid argument: fd must be a file descriptor");
        return JS_EXCEPTION;
    }

    if (argc > 1) {
        int enable = TJS_ToInt32(ctx, argv[1], -1);
        if (enable < 0) {
            JS_ThrowTypeError(ctx, "invalid argument: enable must be 0 or 1");
            return JS_EXCEPTION;
        }

        // write(watchdog, "V", 1);

        int option = (enable == 1) ? WDIOS_ENABLECARD : WDIOS_DISABLECARD;
        int ret = ioctl(watchdog, WDIOC_SETOPTIONS, &option);
        if (ret < 0) {
            JS_ThrowInternalError(ctx, "ioctl return '%d'", ret);
            return JS_EXCEPTION;
        }

    } else {
        int status = 0;
        int ret = ioctl(watchdog, WDIOC_GETSTATUS, &status);
        if (ret < 0) {
            JS_ThrowInternalError(ctx, "ioctl return '%d'", ret);
            return JS_EXCEPTION;
        }

        return JS_NewInt32(ctx, status);
    }
#endif

    return JS_UNDEFINED;
}

static JSValue tjs_watchdog_reset(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        return JS_UNDEFINED;
    }

    int watchdog = TJS_ToInt32(ctx, argv[0], -1);
    if (watchdog <= 0) {
        return JS_UNDEFINED;
    }

    int ret = write(watchdog, "V", 1);
    return JS_NewInt32(ctx, ret);
}

/* define ioctl command. they are fixed. don't modify! */
#define ADC_ENABLE 0
#define ADC_DISABLE 1
#define ADC_SET_VREF 2
#define ADC_PATH_LEN 32
#define ADC_MAX_COUNT 8

#define ADC_PATH "/dev/jz_adc_aux_" /* adc channal 0-3 */
#define STD_VAL_VOLTAGE 1800 /* The unit is mv. T10/T20 VREF=3300; T30/T21/T31 VREF=1800 */

int adc_fds[8] = { -1 };

int hal_adc_open(uint8_t adc_id)
{
    int ret = 0;

#if defined(__linux__) || defined(__linux)

    // int ch_id = 0; /* change test channal */
    char path[ADC_PATH_LEN];
    if (adc_id >= ADC_MAX_COUNT) {
        return -1;
    }

    sprintf(path, "%s%d", ADC_PATH, adc_id);

    int flags = O_RDONLY;
#ifdef O_CLOEXEC // 防止在 exec 后被子进程继承
    flags |= O_CLOEXEC;
#endif

    int fd = open(path, flags);
    if (fd < 0) {
        printf("sample_adc:open error !\n");
        ret = -1;
        return ret;
    }

    /* set reference voltage */
    int voltage = STD_VAL_VOLTAGE;
    ret = ioctl(fd, ADC_SET_VREF, &voltage);
    if (ret) {
        printf("Failed to set reference voltage!\n");
        return ret;
    }

    adc_fds[0] = fd;

#endif

    return 0;
}

int hal_adc_enable(uint8_t adc_id, uint8_t enable)
{
    if (adc_id >= ADC_MAX_COUNT) {
        return -1;
    }

#if defined(__linux__) || defined(__linux)
    if (enable) {
        /* enable adc */
        ioctl(adc_fds[adc_id], ADC_ENABLE);

    } else {
        /* disable adc */
        ioctl(adc_fds[adc_id], ADC_DISABLE);
    }
#endif

    return 0;
}

int hal_adc_get_voltage(uint8_t adc_id)
{
    if (adc_id >= ADC_MAX_COUNT) {
        return -1;
    }

    int value = 0;
    int ret = read(adc_fds[adc_id], &value, sizeof(int));
    if (ret < 0) {
        return -1;
    }

    return value;
}

int hal_adc_close(uint8_t adc_id)
{
    if (adc_id >= ADC_MAX_COUNT) {
        return -1;
    }

    if (adc_fds[adc_id] >= 0) {
        close(adc_fds[adc_id]);
    }

    return 0;
}

int hal_adc_read(uint8_t adc_id)
{
    if (adc_id >= ADC_MAX_COUNT) {
        return -1;
    }

    if (adc_fds[adc_id] < 0) {
        hal_adc_open(adc_id);
        hal_adc_enable(adc_id, 1);
    }

    int value = hal_adc_get_voltage(adc_id);
    return value;
}

// adc
static JSValue tjs_adc_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    hal_adc_close(0);
    return JS_UNDEFINED;
}

static JSValue tjs_adc_read(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    int ret = hal_adc_read(0);
    return JS_NewInt32(ctx, ret);
}

// gpio
static JSValue tjs_gpio_value(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    const char* name = NULL;
    if (argc > 0) {
        name = JS_ToCString(ctx, argv[0]);
    }

    if (!name) {
        return JS_UNDEFINED;
    }

    int value = tjs_gpio_get_value(name);

    JS_FreeCString(ctx, name);
    return JS_NewInt32(ctx, value);
}

static JSValue tjs_gpio_input(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    const char* name = NULL;
    if (argc > 0) {
        name = JS_ToCString(ctx, argv[0]);
    }

    if (!name) {
        return JS_UNDEFINED;
    }

    int value = tjs_gpio_set_input(name);

    JS_FreeCString(ctx, name);
    return JS_NewInt32(ctx, value);
}

static JSValue tjs_gpio_output(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    const char* name = NULL;
    if (argc > 0) {
        name = JS_ToCString(ctx, argv[0]);
    }

    if (!name) {
        return JS_UNDEFINED;
    }

    int value = TJS_ToInt32(ctx, argv[1], -1);
    if (value < 0) {
        return JS_UNDEFINED;
    }

    int ret = tjs_gpio_set_output(name, value);

    JS_FreeCString(ctx, name);
    return JS_NewInt32(ctx, ret);
}

static const JSCFunctionListEntry tjs_gpio_proto_funcs[] = {
    TJS_CGETSET_MAGIC_DEF("onerror", tjs_gpio_event_get, tjs_gpio_event_set, TJS_GPIO_EVENT_ERROR),
    TJS_CGETSET_MAGIC_DEF("onpoll", tjs_gpio_event_get, tjs_gpio_event_set, TJS_GPIO_EVENT_POLL),
    TJS_CFUNC_DEF("fileno", 0, tjs_gpio_fileno),
    TJS_CFUNC_DEF("read", 1, tjs_gpio_read),
    TJS_CFUNC_DEF("close", 1, tjs_gpio_close),
    TJS_CFUNC_DEF("write", 1, tjs_gpio_write)
};

static const JSCFunctionListEntry tjs_hal_funcs[] = {
    TJS_CFUNC_DEF("close", 1, tjs_watchdog_close),
    TJS_CFUNC_DEF("open", 1, tjs_watchdog_open)
};

static const JSCFunctionListEntry tjs_watchdog_funcs[] = {
    TJS_CFUNC_DEF("close", 1, tjs_watchdog_close),
    TJS_CFUNC_DEF("open", 1, tjs_watchdog_open),
    TJS_CFUNC_DEF("enable", 2, tjs_watchdog_enable),
    TJS_CFUNC_DEF("keepalive", 1, tjs_watchdog_keepalive),
    TJS_CFUNC_DEF("reset", 1, tjs_watchdog_reset),
    TJS_CFUNC_DEF("timeout", 2, tjs_watchdog_timeout)
};

static const JSCFunctionListEntry tjs_adc_funcs[] = {
    TJS_CFUNC_DEF("close", 1, tjs_adc_close),
    TJS_CFUNC_DEF("read", 1, tjs_adc_read),
};

static const JSCFunctionListEntry tjs_gpio_funcs[] = {
    TJS_CFUNC_DEF("value", 1, tjs_gpio_value),
    TJS_CFUNC_DEF("output", 2, tjs_gpio_output),
    TJS_CFUNC_DEF("input", 1, tjs_gpio_input)
};

void tjs_mod_hal_init(JSContext* ctx, JSModuleDef* module)
{
    /* class */
    JS_NewClassID(&tjs_gpio_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_gpio_class_id, &tjs_gpio_class);
    JSValue proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_gpio_proto_funcs, countof(tjs_gpio_proto_funcs));
    JS_SetClassProto(ctx, tjs_gpio_class_id, proto);

    /* object */
    JSValue gpioClass = JS_NewCFunction2(ctx, tjs_gpio_constructor, "GPIO", 1, JS_CFUNC_constructor, 0);

    JSValue hal = JS_NewObject(ctx);
    JS_DefinePropertyValueStr(ctx, hal, "GPIO", gpioClass, JS_PROP_C_W_E);

    // hal
    JS_SetPropertyFunctionList(ctx, hal, tjs_hal_funcs, countof(tjs_hal_funcs));
    JS_SetModuleExport(ctx, module, "hal", hal);

    // adc
    JSValue adc = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, adc, tjs_adc_funcs, countof(tjs_adc_funcs));
    JS_SetModuleExport(ctx, module, "adc", adc);

    // gpio
    JSValue gpio = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, gpio, tjs_gpio_funcs, countof(tjs_gpio_funcs));
    JS_SetModuleExport(ctx, module, "gpio", gpio);

    // watchdog
    JSValue watchdog = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, watchdog, tjs_watchdog_funcs, countof(tjs_watchdog_funcs));
    JS_SetModuleExport(ctx, module, "watchdog", watchdog);
}

void tjs_mod_hal_export(JSContext* ctx, JSModuleDef* module)
{
    JS_AddModuleExport(ctx, module, "hal");
    JS_AddModuleExport(ctx, module, "watchdog");
    JS_AddModuleExport(ctx, module, "adc");
    JS_AddModuleExport(ctx, module, "gpio");
}
