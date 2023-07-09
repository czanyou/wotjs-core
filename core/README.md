# WoT.js

## Overview

*WoT.js* is a small and powerful JavaScript runtime for Web of Things, it uses [QuickJS] as its JavaScript engine and [libuv] as the platform layer.

### Browser-like APIs

- Console API
- URL & URLSearchParams
- TextEncoder / TextDecoder APIs
- EventTarget / Event / CustomEvent
- fetch
- Performance API
- Streams API
- Web Crypto API
- Web Worker API

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

## Thanks

WoT.js stands on shoulders of giants. It wouldn't be what it is today without these libraries:

* [QuickJS]: JavaScript engine
* [libuv]: platform abstraction layer

In addition, wot.js has these [contributors] to thank for their help.

```text
[QuickJS]: `https://bellard.org/quickjs/`
[libuv]: `https://libuv.org/`
[CMake]: `https://cmake.org/`
[txiki.js]: `https://github.com/saghul/txiki.js/graphs/contributors`
```
