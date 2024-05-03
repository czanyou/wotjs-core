# Linux Loopback

## Loopback

在Linux中，回环设备允许用户以一个普通磁盘文件虚拟一个块设备。设想一个磁盘设备，对它的所有读写操作都将被重定向到读写一个名为 virtualfs 的普通文件而非操作实际磁盘或分区的轨道和扇区。

回环设备的使用与其它任何块设备相同。特别是，你可以在这个设备上创建文件系统并像普通的磁盘一样将它挂载在系统中。这样的一个将全部内容保存在一个普通文件中的文件系统，被称为虚拟文件系统（virtual file system）。

创建一个用于承载虚拟文件系统的空文件。这个文件的大小将成为挂载后文件系统的大小。创建指定大小文件的简单方法是通过 dd 命令。这个命令以块为单位（通常为 512 字节，或者你也可以自定义块大小）从一个文件向另一个文件复制数据。/dev/zero 文件则是一个很好的数据来源。

要在根目录下（root directory）建立一个 30 MB 大小（zero-filled）的名为 virtualfs 的文件可以通过以下命令：

> dd if=/dev/zero of=/virtualfs bs=1024 count=30720

回环设备以 /dev/loop0、/dev/loop1 等命名。每个设备可虚拟一个块设备。为了确认当前系统是否有在使用回环设备，你需要使用下面的语句

> losetup /dev/loop0

接下来使用losetup命令来把常规文件或块设备（/dev/loop0）关联到一个loop文件（virtualfs）上。注意只有超级用户才有权限设置回环设备。

> losetup /dev/loop0 /userdata/wotjs-lastest.img


接下来就是把回环文件系统（其实就是一个普通的磁盘文件）挂载（mount）到上面刚刚创建的目录上（/mnt/vfs），这样就算完成了一个“regular” Linux EXT3文件系统的创建。为此，需要输入

> mount -t ext3 /dev/loop0 /mnt/data


sudo apt install mtd-utils


> sudo losetup /dev/loop1 /home/linaro/main/wotjs/output/dt03/dist/wotjs-lastest.img
> sudo mount -t jffs2 /dev/loop1 /mnt/data

/home/linaro/main/wotjs/output/dt03/dist/wotjs-v19.12.110-20220727-dt03.img
