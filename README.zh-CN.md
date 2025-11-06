# About WoT.js

## Overview - 概述

基于 QuickJS 的嵌入式物联网 JavaScript 运行时环境

### Documents - 文档

[开发文档](./docs/)

## Supported platforms - 支持的平台

目前只适用于基于 IoT 设备的嵌入式 Linux 平台

* GNU/Linux
* Windows/WSL
* Windows/mingw

## 依赖项

WoT.js 依赖于以下一些依赖项，这样它才能正常工作。

### QuickJS

### libuv

另外一个重要的依赖项是 libuv，它是一个 C 写成的类库，用于非阻塞型的 I/O 操作，同时在所有支持的操作系统上保持一致的接口。它提供了一些机制来处理诸如文件系统、DNS、网络、子进程、管道、信号量控制、轮询机制和数据流。它同样也提供了一个线程池，用于无法在操作系统层面进行异步操作的任务卸载。

## Develop - 开发

### Building - 构建

使用了 CMake 做为主要构建工具

[CMake] is necessary.

```shell
# 安装需要的编译工具
sudo apt install cmake make gcc g++ -y

# Compile it!
make local

# Run the tjs
./build/local/tjs -v
```

其他编译选项:

- `build` 编译原生代码
- `dist` 打包，需在 `make build` 后执行
- `link` 安装本机运行环境，必须在 `make local` 后执行
- `unlink` 删除安装的文件
- `clean` 清除生成的编译目标文件

常用开发板快速编译选项

- `make local` 生成适合 `本机` 的目标文件
- `make linux` 生成适合 `Linux` 系统的目标文件
- `make windows` 生成适合 `Windows` 系统的目标文件
