# Native 原生 API 单元测试用例

## 常量 - Constants

- AF_INET
- AF_INET6
- AF_UNSPEC
- STDERR_FILENO
- STDIN_FILENO
- STDOUT_FILENO

## 属性

- applet
- arch
- arg0
- args
- board
- exepath
- platform
- root
- version
- versions

## 类

- Error
- Pipe
- TCP
- TLS
- TTY
- UDP

## 方法

- cwd
- environ
- evalScript
- exit
- gc
- getenv
- gettimeofday
- homedir
- hrtime
- isatty
- loadScript
- mqtt
- openlog
- print
- alert
- write
- setenv
- spawn
- syslog
- tmpdir
- uname
- unsetenv

## 模块

- crypto
- dns
- fs
- hal
- http
- os
- signal
- serial
- util

### crypto

- MD_MD5
- MD_SHA1
- MD_SHA256
- MD_SHA512
- encrypt
- decrypt
- hash

### dns

- getaddrinfo

### fs

- UV_DIRENT_UNKNOWN
- UV_DIRENT_FILE
- UV_DIRENT_DIR
- UV_DIRENT_LINK
- UV_DIRENT_FIFO
- UV_DIRENT_SOCKET
- UV_DIRENT_CHAR
- UV_DIRENT_BLOCK
- UV_FS_COPYFILE_EXCL
- UV_FS_COPYFILE_FICLONE
- UV_FS_COPYFILE_FICLONE_FORCE
- S_IFMT
- S_IFIFO
- S_IFCHR
- S_IFDIR
- S_IFBLK
- S_IFREG
- S_IFSOCK
- S_IFLNK
- S_ISGID
- S_ISUID

- access
- chmod
- chown
- copyFile
- file
- hashFile
- mkdir
- mkdtemp
- mkstemp
- open
- opendir
- readFile
- readlink
- realpath
- rename
- rmdir
- statfs
- symlink
- unlink
- lstat
- stat

### hal

- GPIO

#### watchdog

- close
- open
- enable
- keepalive
- timeout


### http

- Parser
- REQUEST
- RESPONSE
- BOTH
- methods

### os

- chdir
- cpuinfo
- freemem
- hostname
- interfaces
- kill
- loadavg
- pid
- ppid
- reboot
- sleep
- totalmem
- uptime

### signal

- signal
- SignalHandler
  - close
  - signum

### serial

- PARITY_EVEN
- PARITY_NONE
- PARITY_ODD
- open
- setDTR
- setRTS
- setOptions
- UART

### util

- CODE_HEX
- CODE_BASE64
- hash
- decode
- encode
- textDecode
- textEncode
