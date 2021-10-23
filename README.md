# WoT.js

基于 libuv 和 QuickJS 的嵌入式物联网开发框架

## Overview

> **wot.js** (basque): small, tiny.

*wot.js* is a small and powerful JavaScript runtime. It's built on the shoulders of
giants: it uses [QuickJS] as its JavaScript engine and [libuv] as the platform layer.

### Browser-like APIs

- Console API
- URL & URLSearchParams
- TextEncoder / TextDecoder APIs
- EventTarget / Event / CustomEvent
- fetch (including AbortController)
- Performance API
- Worker API
- Crypto API

### Custom features

- TCP and UDP sockets
- TTY handles
- Unix sockets / named pipes
- Timers
- Signals
- File operations
- Event loop
- High-resolution time
- Miscellaneous utility functions
- Worker threads
- Child processes
- DNS (getaddrinfo)

Other extras:

- path module
- mqtt module
- serial module
- BigFloat and BigDecimal extensions

## Supported platforms

* GNU/Linux

## Building

[CMake] is necessary.

```bash
# Get the code
git clone https://www.github.com/czanyou/wotjs-core.git
cd wotjs-core

# Compile it!
make build

# Run the REPL
./build/tjs
```

## Thanks

wot.js stands on shoulders of giants. It wouldn't be what it is today without these libraries:

* [QuickJS]: JavaScript engine
* [libuv]: platform abstraction layer

In addition, wot.js has these [contributors] to thank for their help.

```text
[QuickJS]: `https://bellard.org/quickjs/`
[libuv]: `https://libuv.org/`
[CMake]: `https://cmake.org/`
[txiki.js]: `https://github.com/saghul/txiki.js/graphs/contributors`
```
