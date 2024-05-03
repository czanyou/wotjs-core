# 远程调试

## 概述


## 开发环境

### NFS 配置

> https://github.com/winnfsd/winnfsd

```shell
WinNFSd.exe -pathFile C:\path\to\your\pathfile

WinNFSd.exe u:\home\cz\projects\ /home/cz/main/
```

```shell
=====================================================
WinNFSd 2.2.0
Network File System server for Windows
Copyright (C) 2005 Ming-Yang Kao
Edited in 2011 by ZeWaren
Edited in 2013 by Alexander Schneider (Jankowfsky AG)
Edited in 2014 2015 by Yann Schepens
Edited in 2016 by Peter Philipp (Cando Image GmbH), Marc Harding
=====================================================

Usage: WinNFSd.exe [-id <uid> <gid>] [-log on | off] [-pathFile <file>] [-addr <ip>] [export path] [alias path]

At least a file or a path is needed
For example:
On Windows> WinNFSd.exe d:\work
On Linux> mount -t nfs 192.168.12.34:/d/work mount

For another example:
On Windows> WinNFSd.exe d:\work /exports
On Linux> mount -t nfs 192.168.12.34:/exports

Another example where WinNFSd is only bound to a specific interface:
On Windows> WinNFSd.exe -addr 192.168.12.34 d:\work /exports
On Linux> mount - t nfs 192.168.12.34: / exports

Use "." to export the current directory (works also for -filePath):
On Windows> WinNFSd.exe . /exports
```


## 远程调试

在 configurations 下添加如下的配置:

```json
{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        {
            "program": "${workspaceFolder}/build/t31a/tjs",
            "name": "GDB 远程调试",
			"type": "cppdbg",
			"request": "launch",
			"args": [],
			"stopAtEntry": false,
			"cwd": "${workspaceFolder}",
			"environment": [],
			"externalConsole": false,
			"MIMode": "gdb",
			"logging": {
				"moduleLoad": true,
				"engineLogging": true,
				"trace": true
			},
			"setupCommands": [
				{
					"description": "Enable pretty-printing for gdb",
					"text": "-enable-pretty-printing",
					"ignoreFailures": true
				}
			],
			"linux": {
				"miDebuggerPath": "/opt/mips-gcc472-glibc216-64bit/bin/mips-linux-uclibc-gnu-gdb",
			},
            "miDebuggerServerAddress": "10.0.12.241:8888"
        }
    ]
}
```

- `program` 要调试的程序
- `linux.miDebuggerPath` 开发机 gdb 所在的路径
- `miDebuggerServerAddress` 开发板的地址和端口

## CMake

CMake 主要用于生成 build 系统，比如在 Linux 上是生成 Makefiles

> Usage: `cmake [options] -S <path-to-source> -B <path-to-build>`

### 指定选项值

```shell
cmake -DTEST_DEBUG=ON
```

### 列出可用的选项

```shell
cmake -LH
```

## gdb

```shell
gdb ./build/local/tjs
```

### 常用命令

 | 命令名称    | 命令缩写  | 命令说明                                         |
 | ----------- | --------- | ------------------------------------------------ |
 | run         | r         | 运行一个待调试的程序                             |
 | continue    | c         | 让暂停的程序继续运行                             |
 | next        | n         | 运行到下一行                                     |
 | step        | s         | 单步执行，遇到函数会进入                         |
 | until       | u         | 运行到指定行停下来                               |
 | finish      | fi        | 结束当前调用函数，回到上一层调用函数处           |
 | return      | return    | 结束当前调用函数并返回指定值，到上一层函数调用处 |
 | jump        | j         | 将当前程序执行流跳转到指定行或地址               |
 | print       | p         | 打印变量或寄存器值                               |
 | backtrace   | bt        | 查看当前线程的调用堆栈                           |
 | frame       | f         | 切换到当前调用线程的指定堆栈                     |
 | thread      | thread    | 切换到指定线程                                   |
 | break       | b         | 添加断点                                         |
 | tbreak      | tb        | 添加临时断点                                     |
 | delete      | d         | 删除断点                                         |
 | enable      | enable    | 启用某个断点                                     |
 | disable     | disable   | 禁用某个断点                                     |
 | watch       | watch     | 监视某一个变量或内存地址的值是否发生变化         |
 | list        | l         | 显示源码                                         |
 | info        | i         | 查看断点 / 线程等信息                            |
 | ptype       | ptype     | 查看变量类型                                     |
 | disassemble | dis       | 查看汇编代码                                     |
 | set args    | set args  | 设置程序启动命令行参数                           |
 | show args   | show args | 查看设置的命令行参数                             |
