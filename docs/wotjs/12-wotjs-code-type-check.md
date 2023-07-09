# JavaScript 类型检查

## 概述

本文主要描述如何利用 Visual Studio Code 自带的类型检查工具为 JavaScript 添加类型定义和检查功能，用于提供代码健壮性和可读性。

## 启用类型检查

在每个 JavaScript 源文件头部添加 `//@ts-check` 注释来启用单个文件的类型检查功能

## 参考信息

### Visual Studio Code 官方说明

JavaScript in Visual Studio Code:

- https://code.visualstudio.com/Docs/languages/javascript#_type-checking
- https://code.visualstudio.com/docs/nodejs/working-with-javascript


### JSDoc 官方网站

- https://jsdoc.app/

## 类型定义

Visual Studio Code 提供了两种类型定义方式，一种是使用 xxx.d.ts 的独立文件来定义，适合模块和 API 接口定义。另外就是利用 JSDoc 注释的方式来定义数据类型，适合在模块内部使用。

### 通过 JSDoc 方式定义

#### 参数和返回值类型

```js

/**
 * @param {string} name
 * @param {number} value
 * @returns {object}
 */
async function test(name, value) {
    return { name, value }
}

```

#### 变量类型

```js
/** @type number */
const name = 100;
```

#### 类

```js
/**
 * @typedef object TestType
 * @property {string} name
 */
```


> https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html

### 通过 d.ts 文件定义

在 types 目录下添加子目录并创建名为 index.d.ts 的文件

在刚创建的文件中编写类型定义:

```typescript
declare module '@tjs/http' {
    export type RequestListener = (request: Request, response: Response) => Promise<any>;

    export interface Request {
        readonly method: string;
        readonly url: string;
    }
}
```

#### 引用 d.ts 文件

```js
/// <reference path ="../../types/index.d.ts" />
```
