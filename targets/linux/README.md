# 说明

## 概述

本文主要描述如何在 Linux 环境下创建 WoT.js 测试和运行环境

## 初始化

### 编译工程

```shell
cd /path/to/project/

make local

make linux

make link
```

### 初始化设备信息

```shell
cd /path/to/targets/linux/

# 创建需要的目录和文件
sh reset.sh

# 设置设备出厂信息
tpm factory init --did [did] --secret [secret] --sn [sn] --url [url]

# 
tpm factory init --did 100010000201010001 --secret 0123456789abcdef --sn 100010000201010001

# 查看出厂信息
tpm factory info

# 应用设备信息
tpm device reload

# 查看设备信息
tpm device info

# 导入子设备配置
tpm config import device.conf
```
