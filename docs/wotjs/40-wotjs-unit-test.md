# 单元测试

## 概述

主本描述了如何编写 WoT.js 单元测试用例

## JavaScript

WoT.js 内置了 `@tjs/assert` 模块用于编写 JavaScript 单元测试

### 测试用例

下面是一个典型的单元测试用例文件：

```js

import { assert, test } from '@tjs/assert';

// 创建一个名称为 process.argv 的测试用例
test('process.argv', () => {
    assert.equal(process.argv[0], 'tjs');
    assert.equal(process.command, undefined);
    assert.ok(Array.isArray(process.argv), 'process.argv must be an array');
});

```

通过 tjs 直接执行即可：

```shell
tjs path/to/test-argv.js
```

在终端会显示如下测试结果

``` shell

  ✔  1. process.argv

RESULT total: 1, passed: 1, failed: 0, time: 0s
```

### 测试套件

WoT.js 将一个目录当作测试套件。

在目录下创建多个类似 `test-<name>.js` 名称的测试文件：

在终端运行：

```shell
tjs test path/to/test/
```

这样就会运行这个目录下所有测试用例文件。

### 目录结构

- `app` 应用程序
  - `test` 针对应用程序的测试用例
- `core` 核心库
  - `test` 针对核心库的测试用例
    - `core` 核心 API 测试用例
    - `ext` 核心扩展 API 测试用例
    - `native` 本地化模块 API 测试用例
    - `net` 网络 API 测试用例
    - `performance` 性能测试
  - `modules` 扩展模块
    - `test` 针对扩展模块的测试用例

### API 参考

`@tjs/assert` 模块提供了单元测试所需要的接口:

```js

/**
 * A subclass of Error that indicates the failure of an assertion.
 */
export class AssertionError extends Error {
    /** Set to the actual argument for methods such as assert.equal(). */
    actual: any;

    /** Set to the expected value for methods such as assert.equal(). */
    expected: any;

    /** Set to the passed in operator value. */
    operator: string;

    /** Value is always ERR_ASSERTION to show that the error is an assertion error. */
    code: string;
}

/** 添加一个测试用例 */
export function test(description: string, testFunction: Function): void;

export namespace assert {

    /**
     * Expects the function fn does not throw an error.
     * @param fn 
     * @param expected 
     * @param message will be appended to the message provided by the AssertionError
     */
    function doesNotThrow(func: Function, expected: any, description?: string): void

    /**
     * Tests strict equality between the actual and expected parameters
     * @param actual 
     * @param expected 
     * @param message will be appended to the message provided by the AssertionError
     */
    function equal(actual: any, expected: any, description?: string): void

    /**
     * Throws an AssertionError with the provided error message or a default error message. 
     * If the message parameter is an instance of an Error then it will be thrown instead of the AssertionError.
     * @param message Default: 'Failed'
     */
    function fail(description?: string): void
    function is(actual: any, expected: any, description?: string): void

    /**
     * Tests strict inequality between the actual and expected parameters
     * @param actual 
     * @param expected 
     * @param message will be appended to the message provided by the AssertionError
     */
    function notEqual(actual: any, expected: any, description?: string): void

    /**
     * Tests if value is truthy. It is equivalent to assert.equal(!!value, true, message).
     * @param actual 
     * @param message will be appended to the message provided by the AssertionError
     */
    function ok(actual: boolean | any, description?: string): void

    /**
     * Expects the function fn to throw an error.
     * @param fn 
     * @param expected 
     * @param message will be appended to the message provided by the AssertionError
     */
    function throws(func: Function, expected: any, description?: string): void
}

```

## 运行所有测试

直接在项目根目录下执行：

```shell
make test
```

这样会执行项目所有测试用例，并显示测试结果。
