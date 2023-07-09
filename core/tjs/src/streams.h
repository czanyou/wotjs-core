#include "private.h"
#include "tjs-utils.h"

/* Stream */
enum tjs_stream_event {
    STREAM_EVENT_CLOSE = 0,
    STREAM_EVENT_OPEN,
    STREAM_EVENT_CONNECT,
    STREAM_EVENT_CONNECTION,
    STREAM_EVENT_ERROR,
    STREAM_EVENT_MESSAGE,
    STREAM_EVENT_MAX,
};

typedef struct tjs_stream {
    JSContext* ctx;

    /** 这个流对象的相关句柄 */
    union {
        uv_handle_t handle;
        uv_stream_t stream;
        uv_tcp_t tcp;
        uv_tty_t tty;
        uv_pipe_t pipe;
    } h;

    /** 事件回调函数 */
    JSValue events[STREAM_EVENT_MAX];

    /** 这个对象相关的 handle 是否已关闭 */
    int closed;

    /** 这个对象是否已销毁, finalizer 方法已调用 */
    int finalized;

    /** 是否开始读数据中 */
    int read_start;

    /** 这个流对象是否开启调试信息打印 */
    int stream_debug;

    /** 这个流对象的 ID */
    int stream_id;

    /** 这个流对象的类型 */
    int stream_type;

} TJSStream;

typedef struct tjs_connect_req {
    uv_connect_t req;
    TJSPromise result;
} TJSConnectReq;

typedef struct tjs_shutdown_req {
    uv_shutdown_t req;
    TJSPromise result;
} TJSShutdownReq;

typedef struct tjs_write_req {
    uv_write_t req;
    TJSPromise result;
    size_t size;
    char data[];
} TJSWriteReq;

int tjs_stream_has_ref(TJSStream* stream);
void tjs_stream_ref(TJSStream* stream);
void tjs_stream_unref(TJSStream* stream);

void tjs_stream_mark(JSRuntime* rt, TJSStream* stream, JS_MarkFunc* mark_func);
void tjs_stream_finalizer(JSRuntime* runtime, TJSStream* stream);
void tjs_stream_connect_callback(uv_connect_t* req, int status);
void tjs_stream_event_emit(JSContext* ctx, TJSStream* stream, int event, JSValue arg);

JSValue tjs_stream_accept(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv);
JSValue tjs_stream_close(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv);
JSValue tjs_stream_event_get(JSContext* ctx, TJSStream* stream, JSValueConst this_val, int magic);
JSValue tjs_stream_event_set(JSContext* ctx, TJSStream* stream, JSValueConst this_val, JSValueConst value, int magic);
JSValue tjs_stream_fileno(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv);
JSValue tjs_stream_init(JSContext* ctx, JSValue obj, TJSStream* stream);
JSValue tjs_stream_listen(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv);
JSValue tjs_stream_pause(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv);
JSValue tjs_stream_resume(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv);
JSValue tjs_stream_shutdown(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv);
JSValue tjs_stream_write(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv);

JSValue tjs_tcp_new(JSContext* ctx, int af);
TJSStream* tjs_tcp_get(JSContext* ctx, JSValueConst obj);
TJSStream* tjs_pipe_get(JSContext* ctx, JSValueConst obj);

void tjs_mod_pipe_init(JSContext* ctx, JSModuleDef* module);
void tjs_mod_tcp_init(JSContext* ctx, JSModuleDef* module);
void tjs_mod_tty_init(JSContext* ctx, JSModuleDef* module);
