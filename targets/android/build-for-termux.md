# 交叉编译环境配置

## 交叉编译

```shell
set(ANDROID ON)
set(ANDROID_PLATFORM android-19)
set(CMAKE_ANDROID_ARCH_ABI arm64-v8a)
set(CMAKE_ANDROID_NDK "/opt/android-ndk-r23b")
set(CMAKE_C_COMPILER_TARGET "${CMAKE_ANDROID_NDK}/toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android30")
set(CMAKE_C_COMPILER "${CMAKE_C_COMPILER_TARGET}-clang")
set(CMAKE_C_STANDARD 99)
set(CMAKE_CXX_COMPILER "${CMAKE_C_COMPILER_TARGET}-clang++")
set(CMAKE_CXX_COMPILER_TARGET ${CMAKE_C_COMPILER_TARGET})
set(CMAKE_SYSTEM_NAME Android)
set(CMAKE_SYSTEM_PROCESSOR arm64)
set(CMAKE_SYSTEM_VERSION 19)
set(CMAKE_TOOLCHAIN_FILE "${CMAKE_ANDROID_NDK}/build/cmake/android.toolchain.cmake")
set(CMAKE_VERBOSE_MAKEFILE OFF)

```

### 文件同步

> rsync

```shell
# push
rsync -a -e 'ssh -p 8022' ./server/ u0_a150@192.168.0.43:~/work/

# pull
rsync -a -e 'ssh -p 8022' u0_a150@192.168.0.43:~/work/ ./server/

```

- -v verbose
- -c checksum
- -P progress


