#include <stdio.h>
#include "version.h"

#ifdef CONFIG_USE_GPIO
#include "gpio_uapi.h"
#endif

int tjs_cli(int argc, char** argv);

const char* tjs_board(void)
{
    return TJS_BOARD;
}

const int tjs_code(void)
{
    return TJS_VERSION_TWEAK;
}

int tjs_gpio_get_value(const char* name)
{
#ifdef CONFIG_USE_GPIO
    return simple_gpio_get_value((char*)name);
#else
    return -1;
#endif
}

int tjs_gpio_set_input(const char* name)
{
#ifdef CONFIG_USE_GPIO
    return simple_gpio_set_input((char*)name);
#else
    return -1;
#endif
}

int tjs_gpio_set_output(const char* name, int value)
{
#ifdef CONFIG_USE_GPIO
    return simple_gpio_set_output((char*)name, value);
#else
    return -1;
#endif
}

const char* tjs_version(void)
{
    return TJS_VERSION_STRING;
}

int main(int argc, char** argv)
{
	return tjs_cli(argc, argv);
}
