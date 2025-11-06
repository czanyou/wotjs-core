# Windows 交叉编译

## 概述

使用 Mingw 可以方便地在 Linux 下交叉编译 Windows 可执行程序，比在 Windows 下编译更加方便。这样可以很方便地将 WoT.js 移植到 Windows 平台。

## 安装交叉编译工具链

安装 mingw:

```shell
sudo apt install -y gcc-mingw-w64-i686 gcc-mingw-w64-x86-64 gdb-mingw-w64 
```

编译方法:

```shell
# 32 位
i686-w64-mingw32-gcc main.c -o main32.exe

# 64 位
x86_64-w64-mingw32-gcc main.c -o main64.exe
```

## 配置 CMake 脚本

在 CMakeLists.txt 需要添加如下的选项

```shell
# 打开 WIN32 选项
SET(WIN32 TRUE)

# 设置系统名称为 Windows
SET(CMAKE_SYSTEM_NAME Windows)

# 设置 gcc 编译器名称
set(CMAKE_C_COMPILER "x86_64-w64-mingw32-gcc")

# 清除默认的链接标记，否则在生成可执行文件时会发生错误
SET(CMAKE_SHARED_LIBRARY_LINK_C_FLAGS)
```

## 链接库

系统库文件 mingw32 使用的是和 Linux 类似的 libxxx.a 的命名格式，所以要链接 Windows 相关的库文件时需要采用和 Linux 类似的名称

```shell
if (BUILD_WITH_MINGW)
    target_compile_definitions(uv PRIVATE _WIN32_WINNT=0x0600 _CRT_SECURE_NO_WARNINGS _GNU_SOURCE)
    target_link_libraries(uv ws2_32 shell32 psapi iphlpapi advapi32 userenv)
endif ()
```

## 特别说明

Windows 命令行以及 PowerShell 默认是 GBK 编码，而 WoT.js 默认是使用的 UTF-8 编码，所以显示中文时会出现乱码，可以通过修改活动代码页编号, 即更改字符集来解决这个问题。

```shell
# 切换成 UTF-8
chcp 65001

# 切换回 GBK
chcp 936
```
