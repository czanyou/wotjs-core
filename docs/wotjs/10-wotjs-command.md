# 命令应用程序 (Command)

## 概述

WoT.js 可以使用 JavaScript 来编写命令应用程序（command），应用程序可以通过 `tjs` 运行时来执行。

WoT.js 命令执行方法：

```shell
tjs [options] <command> [arguments]
```

- options 运行时选项
- command 表示要执行的命令的名称
- arguments 表示可选的命令行参数

## 命令

以应用的名称在 `app` 目录下创建一个子文件夹，并在应用目录下创建一个名为 `app.js` 的入口脚本即可。

### 公共模块

多个应用共用的脚本可以放在 `app/modules` 目录下，方便统一打包。

其中 `app/modules/utils/cmdline.js` 模块提供了一些便利方法，可以用于方便的开发应用程序。

创建一个 `app/test/app.js` 脚本文件如下：

```js
// @ts-check 
// 开启 TypeScript 类型检查功能

// 引入 WoT.js 核心库类型申明文件
/// <reference path ="../modules/types/index.d.ts" />

// 引入 cmdline 模块
import * as cmdline from '../modules/utils/cmdline.js';

// 引入自定义的子命令模块
import * as test from './src/test.js';

// 自己编写的命令 foo
function foo(arg1, arg2) {

}

// 定义应用程序的命令列表
const $commands = {
    // config - Manage the wot.js configuration files
    commands: {
        config: cmdline.command('test'),

        // 定义自己编写的子命令，可以通过 `tjs test sub <command> [arguments]` 方式执行
        sub: test.commands
    }

    // 定义自己编写的命令，可以通过 `tjs test foo [arguments]` 方式执行
    foo: foo,

    // help - Get help
    help() {
        cmdline.help($commands);
    }
};

// 根据命令行参数运行相关的命令
cmdline.run($commands, '', ...process.argv);

```

上面的应用可以通过以下方式执行：

```shell
# 读取配置参数
tjs test config get <name>

# 修改配置参数
tjs test config set <name=value>

# 调用自己编写的命令 test.foo
tjs test foo <arg1> <arg2>

# 调用自己编写的子命令 test.commands.bar
tjs test sub <command> <arg1> <arg2>...

# 查看自动生成的帮助信息
tjs test help

```

### 微应用

在 `applets` 目录下可以将多个小应用放在同一个应用中。

## 应用打包

WoT.js 允许将多个应用和 tjs 运行时打包成一个单一的可执行文件，需要用到 `tjsc` 和 `gcc` 编译器，其中 tjsc 负责将 JavaScript 编译成 C 语言文件，然后再通过 gcc 将所有源文件编译成单一的可执行文件。

通过 tjsc 编译后的 C 语言文件位于 `build/${board}/app-js.c`。

### 打包脚本

当前工程使用了 CMake 脚本来打包应用程序：`app/make.cmake`，定义好要打包的应用后，可以在编译 `tjs` 时自动打包相关的应用程序。

当应用程序被打包进 tjs 运行时之后，在脚本中可以用 `@app/path/to/module.js` 的方式导入应用中的模块，即打包后应用模块都会添加 `@app/` 的前缀。如访问 modules 中的模块：`import * as cmdline from '@app/modules/utils/cmdline.js'`

