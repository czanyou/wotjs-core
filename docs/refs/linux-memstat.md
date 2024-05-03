# 性能分析

## /proc/meminfo

/proc/meminfo 内存文件详解：

[root@td01-b96716:~]# cat /proc/meminfo 
MemTotal:          37180 kB
MemFree:            6092 kB
Buffers:             424 kB
Cached:             6064 kB
SwapCached:            0 kB
Active:            18260 kB
Inactive:           1624 kB
Active(anon):      13712 kB
Inactive(anon):       36 kB
Active(file):       4548 kB
Inactive(file):     1588 kB
Unevictable:           0 kB
Mlocked:               0 kB
SwapTotal:             0 kB
SwapFree:              0 kB
Dirty:                 0 kB
Writeback:             0 kB
AnonPages:         13408 kB
Mapped:             4328 kB
Shmem:               352 kB
Slab:               3764 kB
SReclaimable:        748 kB
SUnreclaim:         3016 kB
KernelStack:         712 kB
PageTables:          412 kB
NFS_Unstable:          0 kB
Bounce:                0 kB
WritebackTmp:          0 kB
CommitLimit:       18588 kB
Committed_AS:     365644 kB
VmallocTotal:    1048372 kB
VmallocUsed:        3492 kB
VmallocChunk:    1040464 kB

MemTotal:          37180 kB
MemFree:           17516 kB
Buffers:             424 kB
Cached:             6068 kB
SwapCached:            0 kB
Active:             8132 kB
Inactive:           1364 kB
Active(anon):       3328 kB
Inactive(anon):       32 kB
Active(file):       4804 kB
Inactive(file):     1332 kB
Unevictable:           0 kB
Mlocked:               0 kB
SwapTotal:             0 kB
SwapFree:              0 kB
Dirty:                 0 kB
Writeback:             0 kB
AnonPages:          3016 kB
Mapped:             1588 kB
Shmem:               356 kB
Slab:               3764 kB
SReclaimable:        748 kB
SUnreclaim:         3016 kB
KernelStack:         360 kB
PageTables:          208 kB
NFS_Unstable:          0 kB
Bounce:                0 kB
WritebackTmp:          0 kB
CommitLimit:       18588 kB
Committed_AS:      37760 kB
VmallocTotal:    1048372 kB
VmallocUsed:        3324 kB
VmallocChunk:    1041304 kB

[root@td01-b96716:~]# cat /proc/meminfo 
MemTotal:          37180 kB
MemFree:            9516 kB
Buffers:             424 kB
Cached:             6068 kB
SwapCached:            0 kB
Active:            15296 kB
Inactive:           1212 kB
Active(anon):      10336 kB
Inactive(anon):       36 kB
Active(file):       4960 kB
Inactive(file):     1176 kB
Unevictable:           0 kB
Mlocked:               0 kB
SwapTotal:             0 kB
SwapFree:              0 kB
Dirty:                 0 kB
Writeback:             0 kB
AnonPages:         10028 kB
Mapped:             4100 kB
Shmem:               356 kB
Slab:               3764 kB
SReclaimable:        748 kB
SUnreclaim:         3016 kB
KernelStack:         688 kB
PageTables:          392 kB
NFS_Unstable:          0 kB
Bounce:                0 kB
WritebackTmp:          0 kB
CommitLimit:       18588 kB
Committed_AS:     327504 kB
VmallocTotal:    1048372 kB
VmallocUsed:        3492 kB
VmallocChunk:    1040128 kB



MemTotal:          45964 kB    //所有可用的内存大小，物理内存减去预留位和内核使用。系统从加电开始到引导完成，firmware/BIOS要预留一些内存，内核本身要占用一些内存，最后剩下可供内核支配的内存就是MemTotal。这个值在系统运行期间一般是固定不变的，重启会改变。
MemFree:            1636 kB    //表示系统尚未使用的内存。
MemAvailable:       8496 kB    //真正的系统可用内存，系统中有些内存虽然已被使用但是可以回收的，比如cache/buffer、slab都有一部分可以回收，所以这部分可回收的内存加上MemFree才是系统可用的内存
Buffers:               0 kB    //用来给块设备做缓存的内存，(文件系统的 metadata、pages)
Cached:             7828 kB    //分配给文件缓冲区的内存,例如vi一个文件，就会将未保存的内容写到该缓冲区
SwapCached:            0 kB    //被高速缓冲存储用的交换空间（硬盘的swap）的大小
Active:            19772 kB    //经常使用的高速缓冲存储器页面文件大小
Inactive:           3128 kB    //不经常使用的高速缓冲存储器文件大小
Active(anon):      15124 kB    //活跃的匿名内存
Inactive(anon):       52 kB    //不活跃的匿名内存
Active(file):       4648 kB    //活跃的文件使用内存
Inactive(file):     3076 kB    //不活跃的文件使用内存
Unevictable:           0 kB    //不能被释放的内存页
Mlocked:               0 kB    //系统调用 mlock 家族允许程序在物理内存上锁住它的部分或全部地址空间。这将阻止Linux 将这个内存页调度到交换空间（swap space），即使该程序已有一段时间没有访问这段空间
SwapTotal:             0 kB    //交换空间总内存
SwapFree:              0 kB    //交换空间空闲内存
Dirty:                 4 kB    //等待被写回到磁盘的
Writeback:             0 kB    //正在被写回的
AnonPages:         15100 kB    //未映射页的内存/映射到用户空间的非文件页表大小
Mapped:             7160 kB    //映射文件内存
Shmem:               100 kB    //已经被分配的共享内存
Slab:               9236 kB    //内核数据结构缓存
SReclaimable:       2316 kB    //可收回slab内存
SUnreclaim:         6920 kB    //不可收回slab内存
KernelStack:        2408 kB    //内核消耗的内存
PageTables:         1268 kB    //管理内存分页的索引表的大小
NFS_Unstable:          0 kB    //不稳定页表的大小
Bounce:                0 kB    //在低端内存中分配一个临时buffer作为跳转，把位于高端内存的缓存数据复制到此处消耗的内存
WritebackTmp:          0 kB    //FUSE用于临时写回缓冲区的内存
CommitLimit:       22980 kB    //系统实际可分配内存
Committed_AS:     536244 kB    //系统当前已分配的内存
VmallocTotal:     892928 kB    //预留的虚拟内存总量
VmallocUsed:       29064 kB    //已经被使用的虚拟内存
VmallocChunk:     860156 kB    //可分配的最大的逻辑连续的虚拟内存

## 进程分析

```
[root@td01-b96716:~]# cat /proc/122/status 
Name:	tci
State:	S (sleeping)
Tgid:	122
Pid:	122
PPid:	119
TracerPid:	0
Uid:	0	0	0	0
Gid:	0	0	0	0
FDSize:	32
Groups:	
VmPeak:	   38660 kB
VmSize:	   38660 kB
VmLck:	       0 kB
VmPin:	       0 kB
VmHWM:	    3100 kB
VmRSS:	    3100 kB
VmData:	   34420 kB
VmStk:	     136 kB
VmExe:	    2216 kB
VmLib:	    1800 kB
VmPTE:	      28 kB
VmSwap:	       0 kB
Threads:	5
SigQ:	0/288
SigPnd:	00000000000000000000000000000000
ShdPnd:	00000000000000000000000000000000
SigBlk:	00000000000000000000000000000000
SigIgn:	00000000000000000000000000000006
SigCgt:	00000000000000000000000180021000
CapInh:	0000000000000000
CapPrm:	0000001fffffffff
CapEff:	0000001fffffffff
CapBnd:	0000001fffffffff
Seccomp:	0
Cpus_allowed:	1
Cpus_allowed_list:	0
voluntary_ctxt_switches:	2079
nonvoluntary_ctxt_switches:	1164


[root@td01-b96716:~]# cat /proc/151/status
Name:	tig
State:	S (sleeping)
Tgid:	151
Pid:	151
PPid:	122
TracerPid:	0
Uid:	0	0	0	0
Gid:	0	0	0	0
FDSize:	256
Groups:	
VmPeak:	  318864 kB
VmSize:	  318864 kB
VmLck:	       0 kB
VmPin:	       0 kB
VmHWM:	   10720 kB
VmRSS:	   10720 kB
VmData:	  290188 kB
VmStk:	     136 kB
VmExe:	    2216 kB
VmLib:	    3508 kB
VmPTE:	     192 kB
VmSwap:	       0 kB
Threads:	39
SigQ:	0/288
SigPnd:	00000000000000000000000000000000
ShdPnd:	00000000000000000000000000000000
SigBlk:	00000000000000000000000000000000
SigIgn:	00000000000000000000000000000000
SigCgt:	00000000000000000000000180001000
CapInh:	0000000000000000
CapPrm:	0000001fffffffff
CapEff:	0000001fffffffff
CapBnd:	0000001fffffffff
Seccomp:	0
Cpus_allowed:	1
Cpus_allowed_list:	0
voluntary_ctxt_switches:	1013
nonvoluntary_ctxt_switches:	221


status
Name:	tjs
State:	S (sleeping)
Tgid:	3804
Pid:	3804
PPid:	61
TracerPid:	0
Uid:	0	0	0	0
Gid:	0	0	0	0
FDSize:	256
Groups:	0 
VmPeak:	  320052 kB
VmSize:	  319860 kB
VmLck:	       0 kB
VmPin:	       0 kB
VmHWM:	   11592 kB
VmRSS:	    9588 kB
VmData:	  291180 kB
VmStk:	     136 kB
VmExe:	    2216 kB
VmLib:	    3508 kB
VmPTE:	     192 kB
VmSwap:	       0 kB
Threads:	39
SigQ:	0/288
SigPnd:	00000000000000000000000000000000
ShdPnd:	00000000000000000000000000000000
SigBlk:	00000000000000000000000000000000
SigIgn:	00000000000000000000000000000000
SigCgt:	00000000000000000000000180001000
CapInh:	0000000000000000
CapPrm:	0000001fffffffff
CapEff:	0000001fffffffff
CapBnd:	0000001fffffffff
Seccomp:	0
Cpus_allowed:	1
Cpus_allowed_list:	0
voluntary_ctxt_switches:	3478
nonvoluntary_ctxt_switches:	1977


```


- VmRSS 物理内存占用

输出解释
参数 解释
Name 应用程序或命令的名字
State 任务的状态，运行/睡眠/僵死/
SleepAVG 任务的平均等待时间(以nanosecond为单位)，交互式任务因为休眠次数多、时间长，它们的 sleep_avg
也会相应地更大一些，所以计算出来的优先级也会相应高一些。
Tgid 线程组号
Pid 任务ID
Ppid 父进程ID
TracerPid 接收跟踪该进程信息的进程的ID号
Uid Uid euid suid fsuid
Gid Gid egid sgid fsgid
FDSize 文件描述符的最大个数，file->fds
Groups
VmSize(KB) 任务虚拟地址空间的大小
(total_vm-reserved_vm)，其中total_vm为进程的地址空间的大小，reserved_vm：进程在预留或特殊的内存间的物理页
VmLck(KB) 任务已经锁住的物理内存的大小。锁住的物理内存不能交换到硬盘 (locked_vm)
VmRSS(KB) 应用程序正在使用的物理内存的大小，就是用ps命令的参数rss的值 (rss)
VmData(KB) 程序数据段的大小（所占虚拟内存的大小），存放初始化了的数据；
(total_vm-shared_vm-stack_vm)
VmStk(KB) 任务在用户态的栈的大小 (stack_vm)
VmExe(KB) 程序所拥有的可执行虚拟内存的大小，代码段，不包括任务使用的库 (end_code-start_code)
VmLib(KB) 被映像到任务的虚拟内存空间的库的大小 (exec_lib)
VmPTE 该进程的所有页表的大小，单位：kb
Threads 共享使用该信号描述符的任务的个数，在POSIX多线程序应用程序中，线程组中的所有线程使用同一个信号描述符。
SigQ 待处理信号的个数
SigPnd 屏蔽位，存储了该线程的待处理信号
ShdPnd 屏蔽位，存储了该线程组的待处理信号
SigBlk 存放被阻塞的信号
SigIgn 存放被忽略的信号
SigCgt 存放被俘获到的信号
CapInh Inheritable，能被当前进程执行的程序的继承的能力
CapPrm
Permitted，进程能够使用的能力，可以包含CapEff中没有的能力，这些能力是被进程自己临时放弃的，CapEff是CapPrm的一个子集，进程放弃没有必要的能力有利于提高安全性
CapEff Effective，进程的有效能力
