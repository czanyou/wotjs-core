# WoT.js

## 概述

简单地说 WoT.js 是运行在嵌入式系统中的 JavaScript。

WoT.js 是基于 QuickJs JavaScript 运行时建立的一个平台。

它是一个事件驱动嵌入式端 JavaScript 环境，基于 QuickJs 引擎。QuickJs 占用系统资源非常少，且支持最新的 ES2020 语法规范。

## Hello World

### 脚本模式

创建一个文件：

```js
console.log("Hello World");
```

保存该文件，文件名为 `helloworld.js`， 并通过 tjs 命令来执行：

```shell
tjs helloworld.js
```

程序执行后，正常的话，就会在终端输出 Hello World。

### 命令行模式

在终端直接执行:

```shell
tjs -e 'console.log("Hello World")'
```

程序执行后，就会在终端输出 Hello World。
