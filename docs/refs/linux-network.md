# Linux 网络管理

## 网络状态查询 

> /sys/class/net/wlan0

- address MAC 地址
- carrier The number 1 in the above output means that the network cable is connection physically to your's network card slot.
- operstate The network cable can be connected but there is no way to tell at the moment. Before we can check for a physical cable connection we need to turn it up:
- mtu
- flags
- type
- ifindex
- statistics.rx_bytes
- statistics.rx_dropped
- statistics.rx_packets
- statistics.tx_bytes
- statistics.tx_dropped
- statistics.tx_packets

### 无线状态

> /proc/net/wireless

```shell
Inter-| sta-|   Quality        |   Discarded packets               | Missed | WE
 face | tus | link level noise |  nwid  crypt   frag  retry   misc | beacon | 22
 wlan0: 0000   99.  100.    0.       0      0      0      0      0        0

```


### 路由表状态

> /proc/net/route

```shell
Iface	Destination	Gateway 	Flags	RefCnt	Use	Metric	Mask		MTU	Window	IRTT                                                       
wlan0	00000000	0110000A	0003	0	0	0	00000000	0	0	0                                                                              
eth0	0000000A	00000000	0001	0	0	0	000000FF	0	0	0                                                                               
wlan0	0010000A	00000000	0001	0	0	0	00FFFFFF	0	0	0 

```

### 修改网口名称

```shell
ip link set dev AAA down
ip link set dev AAA up

ip link set AAA name BBB

```

## 网络管理

NetworkManager 是 debian 默认的网络管理服务

nmcli 是它的客户端


查看网络连接状态：

```shell
nmcli n connectivity
```

显示系统网络状态：

```shell
nmcli general status
```

显示主机名：

```shell
nmcli g hostname # 或
nmcli g h
```

更改主机名：

```shell
nmcli g hostname newHostName # 或
nmcli g h newHostName
```

显示所有网络连接的信息：

nmcli connection show

启动指定连接：

nmcli c up ens33

关闭指定连接：

nmcli c down ens33

修改连接：

nmcli c modify ens33  [ + | - ]选项 选项值  # 或
nmcli c m ens33  [ + | - ]选项 选项值

下面给出常用修改示例：

nmcli c m ens33 ipv4.address 192.168.80.10/24  # 修改 IP 地址和子网掩码
nmcli c m ens33 ipv4.method manual             # 修改为静态配置，默认是 auto
nmcli c m ens33 ipv4.gateway 192.168.80.2      # 修改默认网关
nmcli c m ens33 ipv4.dns 192.168.80.2          # 修改 DNS
nmcli c m ens33 +ipv4.dns 114.114.114.114      # 添加一个 DNS
nmcli c m ens33 ipv6.method disabled           # 将 IPv6 禁用
nmcli c m ens33 connection.autoconnect yes     # 开机启动

显示所有网络接口设备的状态：

nmcli device status

显示所有设备的详细信息：

nmcli d show  # 或
nmcli d sh    

断开设备：

nmcli d disconnect ens33  # 或
nmcli d d ens33  
更新设备信息：

nmcli d reapply ens33  # 或
nmcli d r ens33  

命令说明：

sudo nmcli dev wifi connect ssid名称 password WiFi密码 wep-key-type key ifname 无线网卡名称


