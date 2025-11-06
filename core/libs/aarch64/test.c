#include <stdio.h>

#include "gpio_uapi.h"

int main(int argc, char** argv)
{
	char name[] = "GPIO_D5";
	simple_gpio_set_output(name, 1);
	int value = simple_gpio_get_value(name);

	printf("value=%d\r\n", value);

	simple_gpio_set_output(name, 0);
	value = simple_gpio_get_value(name);
	printf("value=%d\r\n", value);

	return 0;
}
