#include <assert.h>
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <stdbool.h>

#include "util/getopt.h"

#if defined(__APPLE__)
#include <malloc/malloc.h>
#elif defined(__linux__)
#include <malloc.h>
#endif

/**
 * @brief 返回长参数名的长度
 * - --foo bar (3)
 * - --foo=bar (3)
 * @param arg 命令行参数
 * @return 长参数名的长度
 */
static size_t option_get_length(const char* arg)
{
    const char* value_start = strchr(arg, OPT_ASSIGN);
    if (!value_start) {
        value_start = arg + strlen(arg);
    }

    return value_start - arg - 1;
}

int option_init(option_t* option, int argc, char** argv)
{
    option->argc = argc;
    option->argv = argv;
    option->arg = NULL;
    option->index = 1;
    return 0;
}

bool option_get(option_t* option)
{
    if (option == NULL) {
        return false;

    } else if (option->index >= option->argc) {
        return false;

    } else if (*option->argv[option->index] != OPT_PREFIX) {
        return false;
    }
    
    option->key = 0;
    option->name = NULL;
    option->value = NULL;
    option->length = 0;

    char* arg = option->argv[option->index] + 1;

    /* a single `-` is not an option, it also stops argument scanning */
    if (!*arg) { // -
        return false;
    }

    option->length = option_get_length(arg);
    if (*arg == OPT_PREFIX) { // --name
        option->name = arg + 1;
        /* `--` stops argument scanning */
        if (!*option->name) { // --
            return false;
        }

        arg += option->length + 1;
        option->value = arg;

    } else if (*arg) { // -k
        option->key = *arg;
        arg += 1;
        option->value = arg;
    }

    if (*arg == OPT_ASSIGN) { // -=
        arg += 1;
        option->value = arg;
    }

    option->arg = arg;
    return true;
}

char* option_get_value(option_t* option)
{
    if (option->value && option->value[0]) {
        return option->value;
    }

    if (option->index >= option->argc) {
        return NULL;
    }

    char* value = option->argv[option->index];
    if (*value == OPT_PREFIX) {
        return NULL;
    }

    option->index += 1;
    return value;
}

bool option_is(option_t* option, char type, char* name)
{
    if (option == NULL) {
        return false;
    } 
    
    if (type && (type == option->key)) {
        return true;

    } else if (name && option->name) {
        return strncmp(option->name, name, option->length) == 0;
    }

    return false;
}

