# 看门狗使用方法

```c
// 看门狗头文件
#include <linux/watchdog.h>

// 打开看门狗设备， /dev/watchdog 和 /dev/watchdog0 是同一个设备，是为了兼容老的应用。
const char* path = "/dev/watchdog";
int flags = O_WRONLY;
int watchdog = open(path, flags, 0666);

// 设置超时时间
int timeout = 60;
int ret = ioctl(watchdog, WDIOC_SETTIMEOUT, &timeout);

// 查询超时时间
timeout = 0;
ret = ioctl(watchdog, WDIOC_GETTIMEOUT, &timeout);

// 启用看门狗
int option = WDIOS_ENABLECARD;
ret = ioctl(watchdog, WDIOC_SETOPTIONS, &option);

// 查询看门狗状态
int status = 0;
ret = ioctl(watchdog, WDIOC_GETSTATUS, &status);

while (1) {
	// 模拟喂狗操作
	// ret = write(fd, "\0", 1);

	// 在看门狗定时器到达超时时间前，重置看门狗定时时间，以避免系统复位或产生中断信号。
	int dummy = 0;
    ret = ioctl(watchdog, WDIOC_KEEPALIVE, &dummy);
	if (ret < 0) {
		perror("Failed to feed watchdog");
		break;
	}

	printf("Feed watchdog.\n");

	// 等待一段时间再喂狗
	sleep(FEED_INTERVAL);
}

// 禁用看门狗
option = WDIOS_DISABLECARD;
ret = ioctl(watchdog, WDIOC_SETOPTIONS, &option);

// 复位看门狗，不再超时重启
ret = write(watchdog, "V", 1);

// 关闭看门狗设备
ret = close(watchdog);
```
