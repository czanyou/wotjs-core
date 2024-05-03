# Shell

## 概述

本文主要描述了一些在 Linux Shell 环境下经常使用的命令。

## ssh

转发内网服务到公网，在目标机上执行如下使令

> ssh -R public-port:localhost:port -N user@hostname

- public-port 公网转发端口
- localhost:port 要转发的本地服务的地址和端口
- user@hostname 公网服务器地址和用户名

### 密钥文件

私钥文件：

~/.ssh/id_rsa:

```
-----BEGIN OPENSSH PRIVATE KEY-----
hx7XlZuGVTMbEAAAARdWJ1bnR1QGktZ25qd2dyMnYBAg==
-----END OPENSSH PRIVATE KEY-----

```

公䄴文件：

~/.ssh/id_rsa.pub:

```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDLEdIPfojAzC2J2UW+b6Tvze3HfvzzEZhYhw+5QXnW84FAq7w4T7LQCLNtoB/TUENM2mgbUXltN/dbYK9D3a481rm22gaATBsMiBKVNWKNq4cY2c88dhDc02m5257nR6J3up+ML0cFvAya3FlUXc5hEr8jrsXgSzol2ZcjaaHOjDFsjIVWxjovvZHu6FJfheNG/wvaADdNdKqL86sT5UPOqg4VtqIzt9CtDT95C7VytzpHrKRIbznE4OreVAvRIaqblWq0o3WhDoxTGxm4Dkk76ZP+HG2jWKLiTo/bqmXZDpeFOPjdDcRsPFXxSY5SwL2EGSgNLRow19gnyd3SeRphbyVWR7hE7gyXXZhcpIutWO47FVqoPPJFOhMJapt2xD4R+9mPOTt3DwWAjtM6JLOzSbUcrhpkV4ZVWYBjM1eY1adtusLNSoJnZ4HLYUSgXetQRQlcZAo5yutDB8rHInEde1G3tpnRGKyNViXUIdSdIiThmjV9FG+i/OTqR0JjUkU= ubuntu@i-gnjwgr2v
```

目标主机：

~/.ssh/authorized_keys

```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDLEdIPfojAzC2J2UW+b6Tvze3HfvzzEZhYhw+5QXnW84FAq7w4T7LQCLNtoB/TUENM2mgbUXltN/dbYK9D3a481rm22gaATBsMiBKVNWKNq4cY2c88dhDc02m5257nR6J3up+ML0cFvAya3FlUXc5hEr8jrsXgSzol2ZcjaaHOjDFsjIVWxjovvZHu6FJfheNG/wvaADdNdKqL86sT5UPOqg4VtqIzt9CtDT95C7VytzpHrKRIbznE4OreVAvRIaqblWq0o3WhDoxTGxm4Dkk76ZP+HG2jWKLiTo/bqmXZDpeFOPjdDcRsPFXxSY5SwL2EGSgNLRow19gnyd3SeRphbyVWR7hE7gyXXZhcpIutWO47FVqoPPJFOhMJapt2xD4R+9mPOTt3DwWAjtM6JLOzSbUcrhpkV4ZVWYBjM1eY1adtusLNSoJnZ4HLYUSgXetQRQlcZAo5yutDB8rHInEde1G3tpnRGKyNViXUIdSdIiThmjV9FG+i/OTqR0JjUkU= ubuntu@i-gnjwgr2v
```

生成密钥：

> ssh-keygen -t rsa

输入密钥文件名，其他直接回车确认

上传密钥：

> ssh-copy-id -i identity_file user@hostname

例如：

> ssh-copy-id -i ~/.ssh/id_rsa.pub root@192.111.111.111

## 用户管理

### 添加用户

> `useradd <username>`

### 查看用户

> `cat /etc/passwd | cut -d : -f 1`

### 设置用户密码

> `passwd <username>`

### 切换用户

> `su <username>`
> `su - <username>`

### 删除用户

> `userdel <username>`

### 检查登录

> whoami
> id

### 查看用户进程

> `ps -u <username>`

杀死进程

> `pkill -KILL -u <username>`

## rsync

通过 SSH 协议同步指定文件夹

> rsync -av -e 'ssh -p 22' output/${BOARD_TYPE}/dist/ root@localhost:/var/www/html/upload/${BOARD_TYPE}/

- output/... 本地目录
- root@localhost 目标服务器地址和用户名
- /var/www/html/... 目标服务器目录

## cat

查看文件

> cat -n 文件路径

覆盖文件

> cat file1 > file2

追加文件

> cat file1 >> file2

合并文件

> cat file1 file2 > file3

生成文件

> cat > file

按 ctrl+d 结束内容添加

## alias

> alias [key=[value]]

```shell
alias "userlist=cat /etc/passwd | cut -d : -f 1"
```
