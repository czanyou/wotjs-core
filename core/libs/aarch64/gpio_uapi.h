#ifndef _TJS_GPIO_H_
#define _TJS_GPIO_H_

/**
 * 讯为 RK3568 核心板 GPIO 接口定义
 */

int gpio_init_ctrl();
void gpio_close_ctrl(int ctrl);
int gpio_find_by_name(int ctrl, char *name);
int gpio_set_output(int ctrl, int index, int value);
int gpio_set_input(int ctrl, int index);
int gpio_get_value(int ctrl, int index);

int simple_gpio_set_output(char *name, int value);
int simple_gpio_get_value(char *name);
int simple_gpio_set_input(char *name);

#endif
