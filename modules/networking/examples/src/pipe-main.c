#include "util/log.h"

#include <inttypes.h>
#include <uv.h>

#include <assert.h>
#include <mcheck.h>
#include <stdlib.h>
#include <string.h>

static uv_loop_t* loop = NULL;
static uv_pipe_t stdout_pipe;

#define TAG "pipe-sub"

static char sub_path[500] = { 0 };

static uv_process_t sub_process;
static uv_process_options_t options;
static uv_pipe_t sub_pipe;

void pipe_alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf)
{
    *buf = uv_buf_init((char*)malloc(suggested_size), suggested_size);
}

void close_process_handle(uv_process_t* req, int64_t exit_status, int term_signal)
{
    fprintf(stderr, "Process exited with status %" PRId64 ", signal %d\n", exit_status, term_signal);
    uv_close((uv_handle_t*)req, NULL);
}

typedef struct {
    uv_write_t req;
    uv_buf_t buf;
} write_req_t;

void free_write_req(uv_write_t* req)
{
    write_req_t* wr = (write_req_t*)req;
    free(wr->buf.base);
    free(wr);
}

void on_stdout_write(uv_write_t* req, int status)
{
    free_write_req(req);

    uv_stream_t* stream = (uv_stream_t*)req->data;
    uv_close((uv_handle_t*)stream, NULL);
}

void write_data(uv_stream_t* dest, size_t size, uv_buf_t buf, uv_write_cb cb)
{
    write_req_t* req = (write_req_t*)malloc(sizeof(write_req_t));
    req->buf = uv_buf_init((char*)malloc(size), size);
    req->req.data = dest;
    memcpy(req->buf.base, buf.base, size);
    uv_write((uv_write_t*)req, (uv_stream_t*)dest, &req->buf, 1, cb);
}

int main(int argc, char** argv)
{
    loop = uv_default_loop();

    uv_pipe_init(loop, &stdout_pipe, 0);
    uv_pipe_open(&stdout_pipe, 1);

    size_t path_size = 500;
    uv_exepath(sub_path, &path_size);
    strcpy(sub_path + (strlen(sub_path) - strlen("pipe_main")), "pipe_sub");
    fprintf(stderr, "worker path: %s\n", sub_path);

    char buffer[1024 * 6] = { 0 };
    char* end = buffer + sizeof(buffer);
    char* p = buffer;
    while (p < end) {
        *p++ = 'a';
    }

    char output[1024 * 1024];

    FILE* file = popen(sub_path, "w");
    if (file) {
        for (int i = 0; i < 1024 * 200; i++) {
            #if 0
            memcpy(output, buffer, sizeof(buffer));
            memcpy(output, buffer, sizeof(buffer));
            memcpy(output, buffer, sizeof(buffer));
            #else
            fwrite(buffer, sizeof(buffer), 1, file);
            #endif
        }

        fclose(file);
    }

    return 0;
}
