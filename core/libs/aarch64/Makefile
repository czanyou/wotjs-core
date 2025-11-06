# 指定编译器
CC = /opt/aarch64-linux-gnu/bin/aarch64-linux-gnu-gcc

# 指定编译选项
CFLAGS = -Wall -Werror

# 指定链接选项
LDFLAGS = -L. -lgpio

# 指定目标可执行文件
TARGET = test

# 指定源文件
SRCS = test.c

# 指定目标文件
OBJS = $(SRCS:.c=.o)

# 默认目标
all: $(TARGET)

# 编译目标文件
$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

# 编译源文件
%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

# 清理生成的文件
clean:
	rm -f $(OBJS) $(TARGET)
