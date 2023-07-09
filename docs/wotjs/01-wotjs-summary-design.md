# WoT.js 架构设计说明书

## 概要

WoT.js 运行在智能硬件及 Linux 系统之上，用来连接设备和云服务。

WoT.js 运行时是以 daemon 的形式在后台运行的。主要通过 HTTPS 和 MQTTS 和云端通信，注册设备，上报需要的属性值和事件信息，并接收和执行平台下发的控制指令。

## 软件架构

WoT.js 实现了 JavaScript 运行时，提供了相关的 Scripting API 供应用程序调用。应用程序可以使用相关的 API 和云端进行通信。

其次 WoT.js 也提供了核心的系统，硬件和其他工具类 API，应用程序可以使用 JavaScript 即可实现大部分应用功能和业务逻辑。

对于有一些无法用脚本实现的功能，比如视频采集和传输，AI 算法等可以通过 Native 模块的方式扩展后供应用使用。

### 项目结构

- `app` JavaScript 应用程序
- `bin` 命令行开发工具
- `build` 构建临时文件
- `config` 配置文件
- `core` 运行时等核心模块
- `docs` 文件
- `modules` 扩展模块
- `output` 输出以及打包后的文件
- `packages` 基他独立原生应用
- `tools` 其他工具

### 项目根目录配置文件

- `.eslintrc.js` ES-Lint 配置文件，用来检查 JavaScript 代码风格
- `.gitignore` Git 配置文件，用于管理不需要 git 控制的文件和目录
- `CMakeLists.txt` 当前项目的 CMake 配置脚本，用来编译 C 代码等
- `index.d.ts` JavaScript 模块接口定义
- `Makefile` make 配置文件
- `package.json` Node.js 模块配置文件
- `README.md` 说明文档
- `tsconfig.json` Visual Studio Code 开发环境 TypeScript 语言配置

## 架构理念

WoT.js 运行时主要是按 W3C Web of Things 的架构和接口来实现的，所以会遵从 WoT 的相关设计，并在此基础上扩展了一些方法。

> 相关信息请参考 W3C 的网站

## 消息语义

> JSON-RPC 2.0

## 设备配置文件

WoT.js 用到的配置文件有:

- /system/wotjs/conf/device.conf
- /system/wotjs/conf/device.token
- /system/wotjs/conf/network.conf
- /system/wotjs/conf/user.conf

链接文件:

- /etc/wotjs -> /system/wotjs/conf/
- /system/bin/tjs -> - /system/wotjs/bin/tjs
- /system/bin/tci -> - /system/wotjs/bin/tjs
- /system/bin/tcd -> - /system/wotjs/bin/tjs
- /system/bin/tpm -> - /system/wotjs/bin/tjs

### product.conf

产品配置文件，保存着设备所属产品的信息。

> 在设置出厂默认设置时写入这个文件，出厂后就不再改变。

### device.conf

设备配置文件，保存着设备独有的信息。

> 在设置出厂默认设置时生成这个文件，出厂后就不再改变。

### device.token

设备 token, 每次设备重置时生成，主要用于设备和用户绑定，快连，在同一网络下对设备进行直接控制等。

> 设备重置时必须删除这个文件。

### network.conf

保存配网后分配的 Wi-Fi 名称和密码等网络信息。

> 设备重置时必须删除这个文件。

### user.conf

保存其他在用户使用设备时用到的配置参数。

> 设备重置时必须删除这个文件。

## 移植和运行

## 配网

为了方便用户将设备和 APP 进行绑定，WoT.js 提供了以下方法。

### 蓝牙配网

系统启动时会检查 network.conf，根据当前的配置进入不同的模式。

- 如果已经配置了 Wi-Fi 则会调用相关的脚本连接到网络和服务器。
- 如果还没有配置则会进入待连接状态，并等待 APP 的配网信息。

