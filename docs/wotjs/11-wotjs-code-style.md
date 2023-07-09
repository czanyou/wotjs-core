# 代码风格

## JavaScript 代码风格

### ESLint

> https://eslint.org/

ESLint 可以静态分析代码以快速检测并修复 JavaScript 代码中的问题。

#### 安装

安装 Visual Studio Code ESLint 插件

> [Visual Studio Code - Marketplace - ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

安装 ESLint

```shell
npm install -g eslint
```

#### 插件

安装 ESLint 插件

```json
{
    "eslint-config-standard": "^16.0.0",
    "eslint-plugin-import": "^2.26.0",
    "eslint-plugin-node": "^11.1.0"
}
```

标准配置和插件

> https://www.npmjs.com/search?q=eslint-config
> https://www.npmjs.com/search?q=eslint-plugin

#### 配置

生成 `.eslintrc` 配置文件:

```shell
eslint --init
```

```json
{
    "rules": {
        "semi": ["error", "always"],
        "quotes": ["error", "double"]
    }
}
```

等级

- off (0)
- warn (1)
- error (2)

extends 

plugins

环境

- browser
- node
- commonjs 
- es6 
- es2021 
- mocha 
- mongo 

## C 语言代码风格

修改 Visual Studio Code 设置如下:

C/C++: Clang_format_fallback Style

> WebKit

- 缩进 4 个空格


```json
{
    "C_Cpp.clang_format_fallbackStyle": "WebKit"
}
```

### 文件名

- 全部小写
- 前缀使用包名
- 多个单词间用 `-` 连接
- 尽量使用完整单词
- 比如 `mqtt-packet.c`

### 示例

```c++
// rpc-server.c

/**
 * 函数体
 * @param port 参数1
 * @returns 返回值
 */
int jsonrpc_server_init(int port)
{
    // 代码块1
    if (port < 1024) {
        return -1;
    }

    // 代码块2
    int socket_fd = socket_create();
    int ret = socket_bind(socket_fd, port);
    if (ret == 0) {
        return -1;

    } else if (ret == 1) {
        // TODO:

    } else {
        printf("socket listening at %d\r\n", port);
    }

    return 0;
}

```
