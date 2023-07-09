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

#include <ctype.h>
#include <string.h>

#ifdef TJS_HAVE_CURL


enum {
    XHR_EVENT_ABORT = 0,
    XHR_EVENT_ERROR,
    XHR_EVENT_LOAD,
    XHR_EVENT_LOAD_END,
    XHR_EVENT_LOAD_START,
    XHR_EVENT_PROGRESS,
    XHR_EVENT_READY_STATE_CHANGED,
    XHR_EVENT_TIMEOUT,
    XHR_EVENT_MAX,
};

enum {
    XHR_RSTATE_UNSENT = 0,
    XHR_RSTATE_OPENED,
    XHR_RSTATE_HEADERS_RECEIVED,
    XHR_RSTATE_LOADING,
    XHR_RSTATE_DONE,
};

enum {
    XHR_RTYPE_DEFAULT = 0,
    XHR_RTYPE_TEXT,
    XHR_RTYPE_ARRAY_BUFFER,
    XHR_RTYPE_JSON,
};

typedef struct {
    JSContext *ctx;
    JSValue events[XHR_EVENT_MAX];
    tjs_curl_private_t curl_private;
    CURL *curl;
    CURLM *curlm_h;
    struct curl_slist *slist;
    bool sent;
    bool async;
    unsigned long timeout;
    short response_type;
    unsigned short ready_state;
    struct {
        char *raw;
        JSValue status;
        JSValue status_text;
    } status;
    struct {
        JSValue url;
        JSValue headers;
        JSValue response;
        JSValue response_text;
        DynBuf hbuf;
        DynBuf bbuf;
    } result;
} tjs_http_request_t;

static JSClassID tjs_xhr_class_id;

static void tjs_xhr_finalizer(JSRuntime *rt, JSValue val) {
    tjs_http_request_t *request = JS_GetOpaque(val, tjs_xhr_class_id);
    if (request) {
        if (request->curl) {
            if (request->async)
                curl_multi_remove_handle(request->curlm_h, request->curl);
            curl_easy_cleanup(request->curl);
        }
        if (request->slist)
            curl_slist_free_all(request->slist);
        if (request->status.raw)
            js_free_rt(rt, request->status.raw);
        for (int i = 0; i < XHR_EVENT_MAX; i++)
            JS_FreeValueRT(rt, request->events[i]);
        JS_FreeValueRT(rt, request->status.status);
        JS_FreeValueRT(rt, request->status.status_text);
        JS_FreeValueRT(rt, request->result.url);
        JS_FreeValueRT(rt, request->result.headers);
        JS_FreeValueRT(rt, request->result.response);
        JS_FreeValueRT(rt, request->result.response_text);

        free(request);
    }
}

static void tjs_xhr_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    tjs_http_request_t *request = JS_GetOpaque(val, tjs_xhr_class_id);
    if (request) {
        for (int i = 0; i < XHR_EVENT_MAX; i++)
            JS_MarkValue(rt, request->events[i], mark_func);
        JS_MarkValue(rt, request->status.status, mark_func);
        JS_MarkValue(rt, request->status.status_text, mark_func);
        JS_MarkValue(rt, request->result.url, mark_func);
        JS_MarkValue(rt, request->result.headers, mark_func);
        JS_MarkValue(rt, request->result.response, mark_func);
        JS_MarkValue(rt, request->result.response_text, mark_func);
    }
}

static JSClassDef tjs_xhr_class = {
    "XMLHttpRequest",
    .finalizer = tjs_xhr_finalizer,
    .gc_mark = tjs_xhr_mark,
};

static tjs_http_request_t *tjs_xhr_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, tjs_xhr_class_id);
}

static void maybe_emit_event(tjs_http_request_t *request, int event, JSValue arg) {
    JSContext *ctx = request->ctx;
    JSValue event_func = request->events[event];
    if (!JS_IsFunction(ctx, event_func)) {
        JS_FreeValue(ctx, arg);
        return;
    }

    JSValue func = JS_DupValue(ctx, event_func);
    JSValue ret = JS_Call(ctx, func, JS_UNDEFINED, 1, (JSValueConst *) &arg);
    if (JS_IsException(ret))
        TJS_DumpError(ctx);

    JS_FreeValue(ctx, ret);
    JS_FreeValue(ctx, func);
    JS_FreeValue(ctx, arg);
}

static void curl__done_cb(CURLcode result, void *arg) {
    tjs_http_request_t *request = arg;
    CHECK_NOT_NULL(request);

    CURL *easy_handle = request->curl;
    CHECK_EQ(request->curl, easy_handle);

    char *done_url = NULL;
    curl_easy_getinfo(easy_handle, CURLINFO_EFFECTIVE_URL, &done_url);
    if (done_url)
        request->result.url = JS_NewString(request->ctx, done_url);

    if (request->slist) {
        curl_slist_free_all(request->slist);
        request->slist = NULL;
    }

    request->ready_state = XHR_RSTATE_DONE;
    maybe_emit_event(request, XHR_EVENT_READY_STATE_CHANGED, JS_UNDEFINED);

    if (result == CURLE_OPERATION_TIMEDOUT)
        maybe_emit_event(request, XHR_EVENT_TIMEOUT, JS_UNDEFINED);

    maybe_emit_event(request, XHR_EVENT_LOAD_END, JS_UNDEFINED);

    if (result != CURLE_OPERATION_TIMEDOUT) {
        if (result != CURLE_OK)
            maybe_emit_event(request, XHR_EVENT_ERROR, JS_UNDEFINED);
        else
            maybe_emit_event(request, XHR_EVENT_LOAD, JS_UNDEFINED);
    }
}

static void curlm__done_cb(CURLMsg *message, void *arg) {
    tjs_http_request_t *request = arg;
    CHECK_NOT_NULL(request);

    CURL *easy_handle = message->easy_handle;
    CHECK_EQ(request->curl, easy_handle);
    curl__done_cb(message->data.result, request);

    // The calling function will disengage the easy handle when this
    // function returns.
    request->curl = NULL;
}

static size_t curl__data_cb(char *ptr, size_t size, size_t nmemb, void *userdata) {
    tjs_http_request_t *request = userdata;
    CHECK_NOT_NULL(request);

    if (request->ready_state == XHR_RSTATE_HEADERS_RECEIVED) {
        request->ready_state = XHR_RSTATE_LOADING;
        maybe_emit_event(request, XHR_EVENT_READY_STATE_CHANGED, JS_UNDEFINED);
    }

    size_t realsize = size * nmemb;

    if (dbuf_put(&request->result.bbuf, (const uint8_t *) ptr, realsize))
        return -1;

    return realsize;
}

static size_t curl__header_cb(char *ptr, size_t size, size_t nmemb, void *userdata) {
    static const char status_line[] = "HTTP/";
    static const char emptly_line[] = "\r\n";

    tjs_http_request_t *request = userdata;
    CHECK_NOT_NULL(request);

    DynBuf *hbuf = &request->result.hbuf;
    size_t realsize = size * nmemb;
    if (strncmp(status_line, ptr, sizeof(status_line) - 1) == 0) {
        if (hbuf->size == 0) {
            // Fire loadstart on the first HTTP status line.
            maybe_emit_event(request, XHR_EVENT_LOAD_START, JS_UNDEFINED);
        } else {
            dbuf_free(hbuf);
            dbuf_init(hbuf);
        }
        if (request->status.raw) {
            js_free(request->ctx, request->status.raw);
            request->status.raw = NULL;
        }
        // Store status line without the protocol.
        const char *p = memchr(ptr, ' ', realsize);
        if (p) {
            *(ptr + realsize - 2) = '\0';
            request->status.raw = js_strdup(request->ctx, p + 1);
        }
    } else if (strncmp(emptly_line, ptr, sizeof(emptly_line) - 1) == 0) {
        // If the code is not a redirect, this is the final response.
        long code = -1;
        curl_easy_getinfo(request->curl, CURLINFO_RESPONSE_CODE, &code);
        if (code > -1 && code / 100 != 3) {
            CHECK_NOT_NULL(request->status.raw);
            request->status.status_text = JS_NewString(request->ctx, request->status.raw);
            request->status.status = JS_NewInt32(request->ctx, code);
            request->ready_state = XHR_RSTATE_HEADERS_RECEIVED;
            maybe_emit_event(request, XHR_EVENT_READY_STATE_CHANGED, JS_UNDEFINED);
            dbuf_putc(hbuf, '\0');
        }
    } else {
        const char *p = memchr(ptr, ':', realsize);
        if (p) {
            // Lowercae header names.
            for (char *tmp = ptr; tmp != p; tmp++)
                *tmp = tolower(*tmp);
            if (dbuf_put(hbuf, (const uint8_t *) ptr, realsize))
                return -1;
        }
    }

    return realsize;
}

static int curl__progress_cb(void *clientp,
                             curl_off_t dltotal,
                             curl_off_t dlnow,
                             curl_off_t ultotal,
                             curl_off_t ulnow) {
    tjs_http_request_t *request = clientp;
    CHECK_NOT_NULL(request);

    if (request->ready_state == XHR_RSTATE_LOADING) {
        double cl = -1;
        curl_easy_getinfo(request->curl, CURLINFO_CONTENT_LENGTH_DOWNLOAD, &cl);
        JSContext *ctx = request->ctx;
        JSValue event = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, event, "lengthComputable", JS_NewBool(ctx, cl > 0), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, event, "loaded", JS_NewInt64(ctx, dlnow), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, event, "total", JS_NewInt64(ctx, dltotal), JS_PROP_C_W_E);
        maybe_emit_event(request, XHR_EVENT_PROGRESS, event);
    }

    return 0;
}

static JSValue tjs_xhr_constructor(JSContext *ctx, JSValueConst new_target, int argc, JSValueConst *argv) {
    JSValue obj = JS_NewObjectClass(ctx, tjs_xhr_class_id);
    if (JS_IsException(obj))
        return obj;

    tjs_http_request_t *request = calloc(1, sizeof(*request));
    if (!request) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    request->ctx = ctx;
    request->result.url = JS_NULL;
    request->result.headers = JS_NULL;
    request->result.response = JS_NULL;
    request->result.response_text = JS_NULL;
    dbuf_init(&request->result.hbuf);
    dbuf_init(&request->result.bbuf);
    request->ready_state = XHR_RSTATE_UNSENT;
    request->status.raw = NULL;
    request->status.status = JS_UNDEFINED;
    request->status.status_text = JS_UNDEFINED;
    request->slist = NULL;
    request->sent = false;
    request->async = true;

    for (int i = 0; i < XHR_EVENT_MAX; i++) {
        request->events[i] = JS_UNDEFINED;
    }

    tjs_curl_init();

    request->curl_private.arg = request;
    request->curl_private.done_cb = curlm__done_cb;

    request->curlm_h = tjs__get_curlm(ctx);
    request->curl = curl_easy_init();
    curl_easy_setopt(request->curl, CURLOPT_PRIVATE, &request->curl_private);
    curl_easy_setopt(request->curl, CURLOPT_USERAGENT, "tjs/1.0");
    curl_easy_setopt(request->curl, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(request->curl, CURLOPT_NOPROGRESS, 0L);
    curl_easy_setopt(request->curl, CURLOPT_NOSIGNAL, 1L);
#ifdef CURL_HTTP_VERSION_2
    curl_easy_setopt(request->curl, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_2);
#endif
    curl_easy_setopt(request->curl, CURLOPT_XFERINFOFUNCTION, curl__progress_cb);
    curl_easy_setopt(request->curl, CURLOPT_XFERINFODATA, request);
    curl_easy_setopt(request->curl, CURLOPT_WRITEFUNCTION, curl__data_cb);
    curl_easy_setopt(request->curl, CURLOPT_WRITEDATA, request);
    curl_easy_setopt(request->curl, CURLOPT_HEADERFUNCTION, curl__header_cb);
    curl_easy_setopt(request->curl, CURLOPT_HEADERDATA, request);
#if defined(_WIN32)
    curl_easy_setopt(request->curl, CURLOPT_CAINFO, "cacert.pem");
#endif

    JS_SetOpaque(obj, request);
    return obj;
}

static JSValue tjs_xhr_event_get(JSContext *ctx, JSValueConst this_val, int magic) {
    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;
    return JS_DupValue(ctx, request->events[magic]);
}

static JSValue tjs_xhr_event_set(JSContext *ctx, JSValueConst this_val, JSValueConst value, int magic) {
    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;
    if (JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value)) {
        JS_FreeValue(ctx, request->events[magic]);
        request->events[magic] = JS_DupValue(ctx, value);
    }
    return JS_UNDEFINED;
}

static JSValue tjs_xhr_readystate_get(JSContext *ctx, JSValueConst this_val) {
    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;
    return JS_NewInt32(ctx, request->ready_state);
}

static JSValue tjs_xhr_response_get(JSContext *ctx, JSValueConst this_val) {
    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;
    DynBuf *bbuf = &request->result.bbuf;
    if (bbuf->size == 0)
        return JS_NULL;
    if (JS_IsNull(request->result.response)) {
        switch (request->response_type) {
            case XHR_RTYPE_DEFAULT:
            case XHR_RTYPE_TEXT:
                request->result.response = JS_NewStringLen(ctx, (char *) bbuf->buf, bbuf->size);
                break;
            case XHR_RTYPE_ARRAY_BUFFER:
                request->result.response = JS_NewArrayBufferCopy(ctx, bbuf->buf, bbuf->size);
                break;
            case XHR_RTYPE_JSON:
                // It's necessary to null-terminate the string passed to JS_ParseJSON.
                dbuf_putc(bbuf, '\0');
                request->result.response = JS_ParseJSON(ctx, (char *) bbuf->buf, bbuf->size, "<xhr>");
                break;
            default:
                abort();
        }
    }
    return JS_DupValue(ctx, request->result.response);
}

static JSValue tjs_xhr_responsetext_get(JSContext *ctx, JSValueConst this_val) {
    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;
    DynBuf *bbuf = &request->result.bbuf;
    if (bbuf->size == 0)
        return JS_NULL;
    if (JS_IsNull(request->result.response_text))
        request->result.response_text = JS_NewStringLen(ctx, (char *) bbuf->buf, bbuf->size);
    return JS_DupValue(ctx, request->result.response_text);
}

static JSValue tjs_xhr_responsetype_get(JSContext *ctx, JSValueConst this_val) {
    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;
    switch (request->response_type) {
        case XHR_RTYPE_DEFAULT:
            return JS_NewString(ctx, "");
        case XHR_RTYPE_TEXT:
            return JS_NewString(ctx, "text");
        case XHR_RTYPE_ARRAY_BUFFER:
            return JS_NewString(ctx, "arraybuffer");
        case XHR_RTYPE_JSON:
            return JS_NewString(ctx, "json");
        default:
            abort();
    }
}

static JSValue tjs_xhr_responsetype_set(JSContext *ctx, JSValueConst this_val, JSValueConst value) {
    static const char array_buffer[] = "arraybuffer";
    static const char json[] = "json";
    static const char text[] = "text";

    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;

    if (request->ready_state >= XHR_RSTATE_LOADING)
        JS_Throw(ctx, JS_NewString(ctx, "InvalidStateError"));

    const char *v = JS_ToCString(ctx, value);
    if (v) {
        if (strncmp(array_buffer, v, sizeof(array_buffer) - 1) == 0)
            request->response_type = XHR_RTYPE_ARRAY_BUFFER;
        else if (strncmp(json, v, sizeof(json) - 1) == 0)
            request->response_type = XHR_RTYPE_JSON;
        else if (strncmp(text, v, sizeof(text) - 1) == 0)
            request->response_type = XHR_RTYPE_TEXT;
        else if (strlen(v) == 0)
            request->response_type = XHR_RTYPE_DEFAULT;
        JS_FreeCString(ctx, v);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_xhr_responseurl_get(JSContext *ctx, JSValueConst this_val) {
    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;
    return JS_DupValue(ctx, request->result.url);
}

static JSValue tjs_xhr_status_get(JSContext *ctx, JSValueConst this_val) {
    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;
    return JS_DupValue(ctx, request->status.status);
}

static JSValue tjs_xhr_statustext_get(JSContext *ctx, JSValueConst this_val) {
    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;
    return JS_DupValue(ctx, request->status.status_text);
}

static JSValue tjs_xhr_timeout_get(JSContext *ctx, JSValueConst this_val) {
    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;
    return JS_NewInt32(ctx, request->timeout);
}

static JSValue tjs_xhr_timeout_set(JSContext *ctx, JSValueConst this_val, JSValueConst value) {
    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;

    int32_t timeout;
    if (JS_ToInt32(ctx, &timeout, value))
        return JS_EXCEPTION;

    request->timeout = timeout;

    if (!request->sent)
        curl_easy_setopt(request->curl, CURLOPT_TIMEOUT_MS, timeout);

    return JS_UNDEFINED;
}

static JSValue tjs_xhr_upload_get(JSContext *ctx, JSValueConst this_val) {
    // TODO.
    return JS_UNDEFINED;
}

static JSValue tjs_xhr_withcredentials_get(JSContext *ctx, JSValueConst this_val) {
    // TODO.
    return JS_UNDEFINED;
}

static JSValue tjs_xhr_withcredentials_set(JSContext *ctx, JSValueConst this_val, JSValueConst value) {
    // TODO.
    return JS_UNDEFINED;
}

static JSValue tjs_xhr_abort(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;
    if (request->curl) {
        curl_multi_remove_handle(request->curlm_h, request->curl);
        curl_easy_cleanup(request->curl);
        request->curl = NULL;
        request->curlm_h = NULL;
        request->ready_state = XHR_RSTATE_UNSENT;
        JS_FreeValue(ctx, request->status.status);
        request->status.status = JS_NewInt32(request->ctx, 0);
        JS_FreeValue(ctx, request->status.status_text);
        request->status.status_text = JS_NewString(ctx, "");

        maybe_emit_event(request, XHR_EVENT_ABORT, JS_UNDEFINED);
    }
    return JS_UNDEFINED;
}

static JSValue tjs_xhr_getallresponseheaders(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;
    DynBuf *hbuf = &request->result.hbuf;
    if (hbuf->size == 0)
        return JS_NULL;
    if (JS_IsNull(request->result.headers))
        request->result.headers = JS_NewStringLen(ctx, (char *) hbuf->buf, hbuf->size - 1);  // Skip trailing null byte.
    return JS_DupValue(ctx, request->result.headers);
}

static JSValue tjs_xhr_getresponseheader(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;
    DynBuf *hbuf = &request->result.hbuf;
    if (hbuf->size == 0)
        return JS_NULL;
    const char *header_name = JS_ToCString(ctx, argv[0]);
    if (!header_name)
        return JS_EXCEPTION;

    // Lowercae header name
    for (char *tmp = (char *) header_name; *tmp; tmp++)
        *tmp = tolower(*tmp);

    DynBuf r;
    dbuf_init(&r);
    char *ptr = (char *) hbuf->buf;
    for (;;) {
        // Find the header name
        char *tmp = strstr(ptr, header_name);
        if (!tmp)
            break;
        // Find the end of the header, the \r
        char *p = strchr(tmp, '\r');
        if (!p)
            break;
        // Check if the header has a value
        char *p1 = memchr(tmp, ':', p - tmp);
        if (p1) {
            p1++;  // skip the ":"
            for (; *p1 == ' '; ++p1)
                ;
            // p1 now points to the start of the header value
            // check if it was a header without a value like request-foo:\r\n
            size_t size = p - p1;
            if (size > 0) {
                dbuf_put(&r, (const uint8_t *) p1, size);
                dbuf_putstr(&r, ", ");
            }
        }
        ptr = p;
    }

    JS_FreeCString(ctx, header_name);

    JSValue ret;
    if (r.size == 0)
        ret = JS_NULL;
    else
        ret = JS_NewStringLen(ctx, (const char *) r.buf, r.size - 2);  // skip the last ", "
    dbuf_free(&r);
    return ret;
}

static JSValue tjs_xhr_open(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    static const char head_method[] = "HEAD";

    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;

    // TODO: support username and password.

    if (request->ready_state == XHR_RSTATE_DONE) {
        if (request->slist)
            curl_slist_free_all(request->slist);
        if (request->status.raw)
            js_free(ctx, request->status.raw);
        for (int i = 0; i < XHR_EVENT_MAX; i++)
            JS_FreeValue(ctx, request->events[i]);
        JS_FreeValue(ctx, request->status.status);
        JS_FreeValue(ctx, request->status.status_text);
        JS_FreeValue(ctx, request->result.url);
        JS_FreeValue(ctx, request->result.headers);
        JS_FreeValue(ctx, request->result.response);
        JS_FreeValue(ctx, request->result.response_text);
        dbuf_free(&request->result.hbuf);
        dbuf_free(&request->result.bbuf);

        dbuf_init(&request->result.hbuf);
        dbuf_init(&request->result.bbuf);
        request->result.url = JS_NULL;
        request->result.headers = JS_NULL;
        request->result.response = JS_NULL;
        request->result.response_text = JS_NULL;
        request->ready_state = XHR_RSTATE_UNSENT;
        request->status.raw = NULL;
        request->status.status = JS_UNDEFINED;
        request->status.status_text = JS_UNDEFINED;
        request->slist = NULL;
        request->sent = false;
        request->async = true;

        for (int i = 0; i < XHR_EVENT_MAX; i++) {
            request->events[i] = JS_UNDEFINED;
        }
    }
    if (request->ready_state < XHR_RSTATE_OPENED) {
        JSValue method = argv[0];
        JSValue url = argv[1];
        JSValue async = argv[2];
        const char *method_str = JS_ToCString(ctx, method);
        const char *url_str = JS_ToCString(ctx, url);
        if (argc == 3)
            request->async = JS_ToBool(ctx, async);
        if (strncasecmp(head_method, method_str, sizeof(head_method) - 1) == 0)
            curl_easy_setopt(request->curl, CURLOPT_NOBODY, 1L);
        else
            curl_easy_setopt(request->curl, CURLOPT_CUSTOMREQUEST, method_str);
        curl_easy_setopt(request->curl, CURLOPT_URL, url_str);

        JS_FreeCString(ctx, method_str);
        JS_FreeCString(ctx, url_str);

        request->ready_state = XHR_RSTATE_OPENED;
        maybe_emit_event(request, XHR_EVENT_READY_STATE_CHANGED, JS_UNDEFINED);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_xhr_overridemimetype(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    return JS_ThrowTypeError(ctx, "unsupported");
}

static JSValue tjs_xhr_send(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;
    if (!request->sent) {
        JSValue arg = argv[0];
        if (JS_IsString(arg)) {
            size_t size;
            const char *body = JS_ToCStringLen(ctx, &size, arg);
            if (body) {
                curl_easy_setopt(request->curl, CURLOPT_POSTFIELDSIZE, (long) size);
                curl_easy_setopt(request->curl, CURLOPT_COPYPOSTFIELDS, body);
                JS_FreeCString(ctx, body);
            }
        }
        if (request->slist)
            curl_easy_setopt(request->curl, CURLOPT_HTTPHEADER, request->slist);
        if (request->async)
            curl_multi_add_handle(request->curlm_h, request->curl);
        else {
            CURLcode result = curl_easy_perform(request->curl);
            curl__done_cb(result, request);
        }
        request->sent = true;
    }
    return JS_UNDEFINED;
}

static JSValue tjs_xhr_setrequestheader(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    tjs_http_request_t *request = tjs_xhr_get(ctx, this_val);
    if (!request)
        return JS_EXCEPTION;
    if (!JS_IsString(argv[0]))
        return JS_UNDEFINED;
    const char *h_name, *h_value = NULL;
    h_name = JS_ToCString(ctx, argv[0]);
    if (!JS_IsUndefined(argv[1]))
        h_value = JS_ToCString(ctx, argv[1]);
    char buf[CURL_MAX_HTTP_HEADER];
    if (h_value)
        snprintf(buf, sizeof(buf), "%s: %s", h_name, h_value);
    else
        snprintf(buf, sizeof(buf), "%s;", h_name);
    JS_FreeCString(ctx, h_name);
    if (h_value)
        JS_FreeCString(ctx, h_value);
    struct curl_slist *list = curl_slist_append(request->slist, buf);
    if (list)
        request->slist = list;
    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_xhr_class_funcs[] = {
    JS_PROP_INT32_DEF("UNSENT", XHR_RSTATE_UNSENT, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("OPENED", XHR_RSTATE_OPENED, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("HEADERS_RECEIVED", XHR_RSTATE_HEADERS_RECEIVED, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("LOADING", XHR_RSTATE_LOADING, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("DONE", XHR_RSTATE_DONE, JS_PROP_ENUMERABLE),
};

static const JSCFunctionListEntry tjs_xhr_proto_funcs[] = {
    JS_CGETSET_MAGIC_DEF("onabort", tjs_xhr_event_get, tjs_xhr_event_set, XHR_EVENT_ABORT),
    JS_CGETSET_MAGIC_DEF("onerror", tjs_xhr_event_get, tjs_xhr_event_set, XHR_EVENT_ERROR),
    JS_CGETSET_MAGIC_DEF("onload", tjs_xhr_event_get, tjs_xhr_event_set, XHR_EVENT_LOAD),
    JS_CGETSET_MAGIC_DEF("onloadend", tjs_xhr_event_get, tjs_xhr_event_set, XHR_EVENT_LOAD_END),
    JS_CGETSET_MAGIC_DEF("onloadstart", tjs_xhr_event_get, tjs_xhr_event_set, XHR_EVENT_LOAD_START),
    JS_CGETSET_MAGIC_DEF("onprogress", tjs_xhr_event_get, tjs_xhr_event_set, XHR_EVENT_PROGRESS),
    JS_CGETSET_MAGIC_DEF("onreadystatechange", tjs_xhr_event_get, tjs_xhr_event_set, XHR_EVENT_READY_STATE_CHANGED),
    JS_CGETSET_MAGIC_DEF("ontimeout", tjs_xhr_event_get, tjs_xhr_event_set, XHR_EVENT_TIMEOUT),
    JS_CGETSET_DEF("readyState", tjs_xhr_readystate_get, NULL),
    JS_CGETSET_DEF("response", tjs_xhr_response_get, NULL),
    JS_CGETSET_DEF("responseText", tjs_xhr_responsetext_get, NULL),
    JS_CGETSET_DEF("responseType", tjs_xhr_responsetype_get, tjs_xhr_responsetype_set),
    JS_CGETSET_DEF("responseURL", tjs_xhr_responseurl_get, NULL),
    JS_CGETSET_DEF("status", tjs_xhr_status_get, NULL),
    JS_CGETSET_DEF("statusText", tjs_xhr_statustext_get, NULL),
    JS_CGETSET_DEF("timeout", tjs_xhr_timeout_get, tjs_xhr_timeout_set),
    JS_CGETSET_DEF("upload", tjs_xhr_upload_get, NULL),
    JS_CGETSET_DEF("withCcredentials", tjs_xhr_withcredentials_get, tjs_xhr_withcredentials_set),
    JS_CFUNC_DEF("abort", 0, tjs_xhr_abort),
    JS_CFUNC_DEF("getAllResponseHeaders", 0, tjs_xhr_getallresponseheaders),
    JS_CFUNC_DEF("getResponseHeader", 1, tjs_xhr_getresponseheader),
    JS_CFUNC_DEF("open", 5, tjs_xhr_open),
    JS_CFUNC_DEF("overrideMimeType", 1, tjs_xhr_overridemimetype),
    JS_CFUNC_DEF("send", 1, tjs_xhr_send),
    JS_CFUNC_DEF("setRequestHeader", 2, tjs_xhr_setrequestheader),
};

void tjs_mod_xhr_init(JSContext *ctx, JSModuleDef *m) {
    JSValue proto, obj;

    /* XHR class */
    JS_NewClassID(&tjs_xhr_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_xhr_class_id, &tjs_xhr_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_xhr_proto_funcs, countof(tjs_xhr_proto_funcs));
    JS_SetClassProto(ctx, tjs_xhr_class_id, proto);

    /* XHR object */
    obj = JS_NewCFunction2(ctx, tjs_xhr_constructor, "XMLHttpRequest", 1, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, obj, tjs_xhr_class_funcs, countof(tjs_xhr_class_funcs));
    JS_SetModuleExport(ctx, m, "XMLHttpRequest", obj);
}

void tjs_mod_xhr_export(JSContext *ctx, JSModuleDef *m) {
    JS_AddModuleExport(ctx, m, "XMLHttpRequest");
}

#endif
