# Web Things API

## 概述

在使用 JavaScript 编写 Web Things 代码时，有许多 Web API 可供调用。下面是开发 Web Things 应用程序时可能使用的所有 API 和接口（对象类型）的列表。

## 基础 API

### Abort Controller API

可以用来取消一个 Promise  操作

#### AbortController

- signal: AbortSignal
- abort()

#### AbortSignal

- aborted: boolean
- event abort


### Events API

#### Event

- type: string
- target

#### CustomEvent

#### EventTarget

- addEventListener(eventName: string, listener, options)
- removeEventListener(eventName: string, listener, options)
- dispatchEvent(event: Event)


### URL API

URL API 是一个 URL 标准的组件，它定义了有效的 Uniform Resource Locator 和访问、操作 URL 的 API。

## Barcode Detection API

- TODO: 

The Barcode Detection API detects linear and two-dimensional barcodes in images.

> https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API

### 接口

> BarcodeDetector

The BarcodeDetector interface of the Barcode Detection API allows detection of linear and two dimensional barcodes in images.

## Battery Status API

- TODO: 

Battery Status API，更多时候被称之为 Battery API, 提供了有关系统充电级别的信息并提供了通过电池等级或者充电状态的改变提醒用户的事件。

> https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API

### 接口

> BatteryManager

Provides information about the system's battery charge level.

> navigator.getBattery() Read only

Returns a Promise that resolves with a BatteryManager object.

## Canvas API

- TODO: 

Canvas API 提供了一个通过 JavaScript 来绘制图形的方式。它可以用于动画、游戏画面、数据可视化、图片编辑以及实时视频处理等方面。

> https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API

## Console API

Console API 提供了允许开发人员执行调试任务的功能，例如在代码中的某个位置记录消息或变量值，或者计算任务完成所需的时间。

> https://developer.mozilla.org/zh-CN/docs/Web/API/Console_API

### 接口

> console

提供基本的调试功能，包括日志记录，堆栈跟踪，计时器和计数器。

- log(...args)
- info(...args)
- warn(...args)
- error(...args)
- assert(expression, ...args)
- table(data, properties)
- trace(...args)

## Encoding API

The Encoding API provides a mechanism for handling text in various character encodings, including legacy non-UTF-8 encodings.

> https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API

### 接口

> TextDecoder

- decode(buffer: ArrayBuffer | ArrayBufferView): string

> TextEncoder

- encode(text: string): Uint8Array

## Fetch API

Fetch API 提供了一个获取资源的接口（包括跨域请求）。

> https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API

### 接口

> WindowOrWorkerGlobalScope.fetch()

包含了 fetch() 方法，用于获取资源。

> Headers

相当于 response/request 的头信息，可以使你查询到这些头信息，或者针对不同的结果做不同的操作。

> Request

相当于一个资源请求。

> Response

相当于请求的响应

## Geolocation API

- TODO: 

地理位置 API 允许用户向 Web 应用程序提供他们的位置。出于隐私考虑，报告地理位置前会先请求用户许可。

> https://developer.mozilla.org/zh-CN/docs/Web/API/Geolocation_API

### 接口

> navigator.geolocation

## MediaStream Image Capture API

- TODO: 

The MediaStream Image Capture API is an API for capturing images or videos from a photographic device. In addition to capturing data, it also allows you to retrieve information about device capabilities such as image size, red-eye reduction and whether or not there is a flash and what they are currently set to. Conversely, the API allows the capabilities to be configured within the constraints what the device allows.

## Media Capabilities API

- TODO: 

The Media Capabilities API allows developers to determine decoding and encoding abilities of the device, exposing information such as whether media is supported and whether playback should be smooth and power efficient, with real time feedback about playback to better enable adaptive streaming, and access to display property information.

## Network Information API

- TODO: 

网络状态 API 可以获取到系统的网络连接信息，比如说连接方式是 WiFi 还是蜂窝

## Performance API

- TODO: 

## Sensor APIs

- TODO: 

传感器 API （Sensor APIs）是一组统一设计的接口，它们在 web 平台中为各类传感器提供了一致的访问方式。

### 接口

AmbientLightSensor

返回当前光照强度或环境光照度。

## Web Audio API

- TODO:

> https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Audio_API

## Web Bluetooth API

- TODO: 

The Web Bluetooth API provides the ability to connect and interact with Bluetooth Low Energy peripherals.

> https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API

## Web Codecs API

- TODO: 

## Web Crypto API

Web Crypto API 为脚本提供加密了一套关于密码（学）的接口，以便用于构建需要使用密码的系统。

> https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Crypto_API

### 接口

> Crypto

- getRandomValues(obj: TypedArray)

> subtle

## Web RTC API

- TODO:

WebRTC (Web Real-Time Communications) 是一项实时通讯技术，它允许网络应用或者站点，在不借助中间媒介的情况下，建立浏览器之间点对点（Peer-to-Peer）的连接，实现视频流和（或）音频流或者其他任意数据的传输。WebRTC包含的这些标准使用户在无需安装任何插件或者第三方的软件的情况下，创建点对点（Peer-to-Peer）的数据分享和电话会议成为可能。

> https://developer.mozilla.org/zh-CN/docs/Web/API/WebRTC_API

> https://github.com/versatica/JsSIP

## Web Sockets API

- TODO:

WebSockets 是一种先进的技术。它可以在用户的浏览器和服务器之间打开交互式通信会话。使用此API，您可以向服务器发送消息并接收事件驱动的响应，而无需通过轮询服务器的方式以获得响应。

> https://developer.mozilla.org/zh-CN/docs/Web/API/WebSockets_API

### 接口

WebSocket

用于连接 WebSocket 服务器的主要接口，之后可以在这个连接上发送 和接受数据。

CloseEvent

连接关闭时 WebSocket 对象发送的事件。

MessageEvent

当从服务器获取到消息的时候 WebSocket 对象触发的事件。

## Web Storage API

- TODO: 

Web Storage API 提供机制，使浏览器能以一种比使用 Cookie 更直观的方式存储键/值对。

> https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Storage_API

### 接口

Storage

允许你在一个特定域中设置，检索和删除数据和储存类型(session or local.)

Window

Web Storage API 继承于 Window 对象,并提供两个新属性  — Window.sessionStorage 和 Window.localStorage — 它们分别地提供对当前域的会话和本地 Storage 对象的访问。

StorageEvent

当一个存储区更改时，存储事件从文档的 Window 对象上被发布。

## Web Things API

- TODO: 

> https://webthings.io/api/

## Web Workers API

- TODO: 

通过使用Web Workers，Web应用程序可以在独立于主线程的后台线程中，运行一个脚本操作。这样做的好处是可以在独立线程中执行费时的处理任务，从而允许主线程（通常是UI线程）不会因此被阻塞/放慢。

> https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Workers_API

### 接口

Worker

表示正在运行的 worker 线程，允许你将信息传递到正在运行的 worker 程序代码。

