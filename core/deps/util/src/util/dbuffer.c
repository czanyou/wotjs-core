#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "util/dbuffer.h"

#define unlikely(x)     __builtin_expect(!!(x), 0)

/* Dynamic buffer package */

static void *dbuffer_default_realloc(void *opaque, void *ptr, size_t size)
{
    return realloc(ptr, size);
}

void dbuffer_init2(dbuffer_t *s, void *opaque, dbuffer_realloc_func *realloc_func)
{
    memset(s, 0, sizeof(*s));
    if (!realloc_func)
        realloc_func = dbuffer_default_realloc;
    s->opaque = opaque;
    s->realloc_func = realloc_func;
}

void dbuffer_init(dbuffer_t *s)
{
    dbuffer_init2(s, NULL, NULL);
}

/* return < 0 if error */
int dbuffer_realloc(dbuffer_t *s, size_t new_size)
{
    // 多分配一些空间，可以用来设置字符串结束符
    new_size += 8;

    size_t size;
    uint8_t *new_buf;
    if (new_size > s->allocated_size) {
        if (s->error)
            return -1;
        size = s->allocated_size * 3 / 2;
        if (size > new_size)
            new_size = size;
        new_buf = s->realloc_func(s->opaque, s->buf, new_size);
        if (!new_buf) {
            s->error = TRUE;
            return -1;
        }
        s->buf = new_buf;
        s->allocated_size = new_size;
    }
    return 0;
}

int dbuffer_write(dbuffer_t *s, size_t offset, const uint8_t *data, size_t len)
{
    size_t end;
    end = offset + len;
    if (dbuffer_realloc(s, end))
        return -1;
    memcpy(s->buf + offset, data, len);
    if (end > s->size)
        s->size = end;
    return 0;
}

int dbuffer_put(dbuffer_t *s, const uint8_t *data, size_t len)
{
    if (unlikely((s->size + len) > s->allocated_size)) {
        if (dbuffer_realloc(s, s->size + len))
            return -1;
    }
    memcpy(s->buf + s->size, data, len);
    s->size += len;
    return 0;
}

int dbuffer_put_self(dbuffer_t *s, size_t offset, size_t len)
{
    if (unlikely((s->size + len) > s->allocated_size)) {
        if (dbuffer_realloc(s, s->size + len))
            return -1;
    }
    memcpy(s->buf + s->size, s->buf + offset, len);
    s->size += len;
    return 0;
}

int dbuffer_putc(dbuffer_t *s, uint8_t c)
{
    return dbuffer_put(s, &c, 1);
}

int dbuffer_putstr(dbuffer_t *s, const char *str)
{
    return dbuffer_put(s, (const uint8_t *)str, strlen(str));
}

void dbuffer_free(dbuffer_t *s)
{
    /* we test s->buf as a fail safe to avoid crashing if dbuffer_free()
       is called twice */
    if (s->buf) {
        s->realloc_func(s->opaque, s->buf, 0);
    }
    memset(s, 0, sizeof(*s));
}

