#include "util/log.h"

#include <uv.h>

#include <assert.h>
#include <mcheck.h>
#include <stdlib.h>
#include <string.h>

static uv_loop_t *loop = NULL;
static uv_pipe_t stdin_pipe;

#define TAG "pipe-sub"

void pipe_alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf)
{
    *buf = uv_buf_init((char*)malloc(suggested_size), suggested_size);
}

void pipe_stdin_on_read(uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf)
{
    if (nread < 0) {
        if (nread == UV_EOF) {
            // end of file
            uv_close((uv_handle_t*)&stdin_pipe, NULL);
        }

    } else if (nread > 0) {
        buf->base[nread] = 0;
        // LOGT_I("%ld", nread);
    }
    
    // OK to free buffer as write_data copies it.
    if (buf->base) {
        free(buf->base);
    }
}

int main(int argc, char** argv)
{
    double start = 0;
    uv_uptime(&start);

    LOGT_I("start");
    fprintf(stderr, "started\n");

    loop = uv_default_loop();

    uv_pipe_init(loop, &stdin_pipe, 0);
    uv_pipe_open(&stdin_pipe, 0);

    uv_read_start((uv_stream_t*)&stdin_pipe, pipe_alloc_buffer, pipe_stdin_on_read);

    uv_run(loop, UV_RUN_DEFAULT);

    double now = 0;
    uv_uptime(&now);

    fprintf(stderr, "exit (%dms)\n", (int)((now - start) * 1000));
    return 0;
}
