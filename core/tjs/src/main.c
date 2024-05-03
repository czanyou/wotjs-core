#include <stdio.h>
#include "version.h"


int tjs_cli(int argc, char** argv);

int tjs_gpio_set_output(const char *name, int value)
{
    return -1;
}

int tjs_gpio_get_value(const char *name)
{
    return -1;
}

int tjs_gpio_set_input(const char *name)
{
    return -1;
}

const char* tjs_version(void)
{
    return TJS_VERSION_STRING;
}

const char* tjs_board(void)
{
    return TJS_BOARD;
}

const char* tjs_build(void)
{
    return tjs_core_build();
}

const int tjs_code(void)
{
    return TJS_VERSION_TWEAK;
}

int main(int argc, char** argv)
{
	return tjs_cli(argc, argv);
}
