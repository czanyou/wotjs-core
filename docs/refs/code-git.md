# 源代码管理

## 参数设置

提交代码到 git 远程仓库时需要提供提交人信息：

```shell
git config --global user.email "anyou@qq.com"
git config --global user.name "chengzhen"
```

当我们操作 git pull/push 到远程的时候，总是提示我们输入账号和密码才能操作成功，频繁的输入账号和密码会很麻烦。

解决办法：

```shell
git config --global credential.helper store
```

第二种方式是使用 SSH 密钥：

### 放弃所有修改

```shell
# 删除所有未跟踪的文件
git clean -f

# 放弃所有修改
git reset --hard
```
