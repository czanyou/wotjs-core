#include "private.h"
#include "tjs-utils.h"

/* Stream */
enum tls_stream_event {
    STREAM_EVENT_CLOSE = 0,
    STREAM_EVENT_OPEN,
    STREAM_EVENT_CONNECT,
    STREAM_EVENT_CONNECTION,
    STREAM_EVENT_ERROR,
    STREAM_EVENT_MESSAGE,
    STREAM_EVENT_MAX,
};

typedef struct tjs_connect_req {
    uv_connect_t req;
    TJSPromise result;
} TJSConnectReq;

typedef struct tls_stream {
    JSContext* ctx;
    int read_start;
    int closed;
    int finalized;

    union {
        uv_handle_t handle;
        uv_stream_t stream;
        uv_tcp_t tcp;
        uv_tls_t tls;
    } h;

    JSValue events[STREAM_EVENT_MAX];

    // TLS
    int reject_unauthorized;
    TJSConnectReq* connect;
    JSValue cacert;
    JSValue cert;
    JSValue key;
    JSValue hostname;
} TJSStream;

typedef struct tjs_shutdown_req {
    uv_shutdown_t req;
    TJSPromise result;
} TJSShutdownReq;

typedef struct tjs_write_req {
    uv_write_t req;
    TJSPromise result;
    dbuffer_t buffer;
    size_t size;
    char data[];
} TJSWriteReq;


TJSStream* tjs_tls_get(JSContext* ctx, JSValueConst obj);

void tls_stream_connect_callback(uv_connect_t* req, int status);
void tls_stream_event_emit(JSContext* ctx, TJSStream* stream, int event, JSValue arg);
void tls_stream_finalizer(JSRuntime* runtime, TJSStream* stream);
void tls_stream_mark(JSRuntime* rt, TJSStream* stream, JS_MarkFunc* mark_func);
void tls_stream_read_alloc_callback(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf);
void tls_stream_read_callback(uv_stream_t* handle, ssize_t nread, const uv_buf_t* buf);
void tls_stream_read_on_message(uv_stream_t* handle, ssize_t nread, const uv_buf_t* buf);

JSValue tjs_tls_new_tcp(JSContext* ctx, JSValue options);
JSValue tls_stream_accept2(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv);
JSValue tls_stream_close(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv);
JSValue tls_stream_event_get(JSContext* ctx, TJSStream* stream, JSValueConst this_val, int magic);
JSValue tls_stream_event_set(JSContext* ctx, TJSStream* stream, JSValueConst this_val, JSValueConst value, int magic);
JSValue tls_stream_fileno(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv);
JSValue tls_stream_init(JSContext* ctx, JSValue obj, TJSStream* stream);
JSValue tls_stream_listen2(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv);
JSValue tls_stream_pause(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv);
JSValue tls_stream_resume(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv);
JSValue tls_stream_shutdown(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv);
JSValue tls_stream_write(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv);
