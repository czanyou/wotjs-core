# 音频

## 音频输出

Web Audio API

### AudioManager

内部音频管理模块

### AudioContext

音频输出上下文，提供应用程序访问音频输出模块

### AudioNode

代表一个音频处理节点，每个节点会提供输入或输出接口

#### 源节点

提供音频数据的节点，只有输出接口，没有输入接口

#### 目标节点

音频数据的最终处理节点, 一般是扬声器，只有输入接口，没有输出接口

#### 处理节点

用来转码等

### AudioBuffer 

代表一段音频数据

