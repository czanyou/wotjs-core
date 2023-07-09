#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <adapters/libuv.h>
#include <async.h>
#include <hiredis.h>

void debugCallback(redisAsyncContext* context, void* r, void* privdata)
{
    (void)privdata; // unused
    redisReply* reply = r;
    if (reply == NULL) {
        /* The DEBUG SLEEP command will almost always fail, because we have set a 1 second timeout */
        printf("`DEBUG SLEEP` error: %s\n", context->errstr ? context->errstr : "unknown error");
        return;
    }
    /* Disconnect after receiving the reply of DEBUG SLEEP (which will not)*/
    redisAsyncDisconnect(context);
}

void getCallback(redisAsyncContext* context, void* r, void* privdata)
{
    redisReply* reply = r;
    if (reply == NULL) {
        printf("`GET key` error: %s\n", context->errstr ? context->errstr : "unknown error");
        return;
    }
    printf("`GET key` result: argv[%s]: %s\n", (char*)privdata, reply->str);

    /* start another request that demonstrate timeout */
    redisAsyncCommand(context, debugCallback, NULL, "DEBUG SLEEP %f", 1.5);
}

void connectCallback(const redisAsyncContext* context, int status)
{
    if (status != REDIS_OK) {
        printf("connect error: %s\n", context->errstr);
        return;
    }
    printf("Connected...\n");
}

void disconnectCallback(const redisAsyncContext* context, int status)
{
    if (status != REDIS_OK) {
        printf("disconnect because of error: %s\n", context->errstr);
        return;
    }
    printf("Disconnected...\n");
}

int main(int argc, char** argv)
{
#ifndef _WIN32
    signal(SIGPIPE, SIG_IGN);
#endif

    uv_loop_t* loop = uv_default_loop();

    // redisAsyncContext *context = redisAsyncConnect("127.0.0.1", 6379);
    redisAsyncContext* context = redisAsyncConnect("10.0.16.55", 6379);
    if (context->err) {
        /* Let *context leak for now... */
        printf("Error: %s\n", context->errstr);
        return 1;
    }

    redisLibuvAttach(context, loop);
    redisAsyncSetConnectCallback(context, connectCallback);
    redisAsyncSetDisconnectCallback(context, disconnectCallback);
    redisAsyncSetTimeout(context, (struct timeval) { .tv_sec = 1, .tv_usec = 0 });

    /*
    In this demo, we first `set key`, then `get key` to demonstrate the basic usage of libuv adapter.
    Then in `getCallback`, we start a `debug sleep` command to create 1.5 second long request.
    Because we have set a 1 second timeout to the connection, the command will always fail with a
    timeout error, which is shown in the `debugCallback`.
    */

    redisAsyncCommand(context, NULL, NULL, "SET key %b", argv[argc - 1], strlen(argv[argc - 1]));
    redisAsyncCommand(context, getCallback, (char*)"end-1", "GET key");

    uv_run(loop, UV_RUN_DEFAULT);
    return 0;
}
