#ifndef _DBUF_H
#define _DBUF_H

#ifndef TRUE
#define TRUE 1
#endif

#include <stdint.h>
#include <stddef.h>

/* XXX: should take an extra argument to pass slack information to the caller */
typedef void* dbuffer_realloc_func(void* opaque, void* ptr, size_t size);

typedef struct dbuffer_s {
    uint8_t* buf;
    size_t size;
    size_t allocated_size;
    int error; /* true if a memory allocation error occurred */
    dbuffer_realloc_func* realloc_func;
    void* opaque; /* for realloc_func */
} dbuffer_t;

void dbuffer_init(dbuffer_t* s);
void dbuffer_init2(dbuffer_t* s, void* opaque, dbuffer_realloc_func* realloc_func);
int dbuffer_realloc(dbuffer_t* s, size_t new_size);
int dbuffer_write(dbuffer_t* s, size_t offset, const uint8_t* data, size_t len);
int dbuffer_put(dbuffer_t* s, const uint8_t* data, size_t len);
int dbuffer_put_self(dbuffer_t* s, size_t offset, size_t len);
int dbuffer_putc(dbuffer_t* s, uint8_t c);
int dbuffer_putstr(dbuffer_t* s, const char* str);
void dbuffer_free(dbuffer_t* s);

static inline int dbuffer_put_u16(dbuffer_t* s, uint16_t val)
{
    return dbuffer_put(s, (uint8_t*)&val, 2);
}

static inline int dbuffer_put_u32(dbuffer_t* s, uint32_t val)
{
    return dbuffer_put(s, (uint8_t*)&val, 4);
}

static inline int dbuffer_put_u64(dbuffer_t* s, uint64_t val)
{
    return dbuffer_put(s, (uint8_t*)&val, 8);
}

static inline int dbuffer_error(dbuffer_t* s)
{
    return s->error;
}

static inline void dbuffer_set_error(dbuffer_t* s)
{
    s->error = TRUE;
}

#endif
