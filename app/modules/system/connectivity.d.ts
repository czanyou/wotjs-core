import * as os from '@tjs/os'

/**
 * @module connectivity 网络连接管理
 * - 自动监控和加载网络配置文件
 * - 自动监控和启动/停止相关后台服务程序
 */

export interface NetworkInterface {

    /** internal：`0`|`1` */
    internal?: number;

    /** IPv4 或 IPv6：`inet`, `inet6`  */
    family?: string;

    /** 网络接口名称, 如 `lo`, `eth0`, `wlan0` 等 */
    name?: string;

    /** 硬件地址：`00:00:00:00:00:00` */
    mac?: string;

    /** IPv4/IPv6 地址：`0.0.0.0` */
    ip?: string;

    /** 子网掩码：`255.255.255.0` */
    netmask?: string;

    /**
     * - IFF_UP: 0x01
     * - IFF_BROADCAST: 0x2
     * - IFF_LOOPBACK: 0x8
     * - IFF_RUNNING: 0x40
     * - IFF_MULTICAST: 0x1000
     */
    flags?: number;

    /** ethernet, wifi, loopback 等 */
    type?: string;

    /** 状态 */
    state?: number;
}

/**
 * 网口连接信息
 */
export interface NetworkInterfaceInfo extends NetworkInterface {
    /** 网关地址 */
    gateway?: string;

    /** DNS 服务器地址 */
    dns?: string[];
}

/**
 * 当前网络详细信息
 */
export interface NetworkStatus extends NetworkInterfaceInfo {
    /** DHCP */
    dhcp?: DhcpInfo;

    /** 当前活跃网口名称 */
    interface?: string;

    /** 当前偏好的网络 */
    preference?: string;
}

/**
 * DHCP 信息
 */
export interface DhcpInfo {
    broadcast?: string;
    dns1?: string;
    dns2?: string;
    gateway?: string;
    hostname?: string;
    ip?: string;
    interface?: string;
    lease?: string;
    netmask?: string;
    server?: string;
    updated?: string;
}

/**
 * 路由信息
 */
export interface RouterInfo {
    name?: string;
    dev?: string;
    via?: string;
}

/**
 * 网络流量统计信息
 */
export interface NetworkStat {
    txPackets?: number;
    rxPackets?: number;
    txBytes?: number;
    rxBytes?: number;
}

export interface BaseManager {
    getNetworkInterfaceInfo(): Promise<NetworkInterface | undefined>;
    getNetworkStatistics(): Promise<NetworkStat>;
}

/**
 * 网络配置信息
 */
export interface NetworkOptions {
    /** `ethernet`, `wifi` */
    type?: string;

    /** `eth0`, `wlan0` */
    interface?: string;

    /** `inet`, `inet6` */
    family?: string;

    enabled?: boolean;

    mode?: string;
    ip?: string;
    netmask?: string;
    gateway?: string;
    dns1?: string;
    dns2?: string;

    ssid?: string;
    psk?: string;

    hostname?: string;
}

export class EthernetManager {
    /**
     * 
     */
    getNetworkInterfaceInfo(): Promise<NetworkInterface | undefined>;

    /**
     * 
     */
    getNetworkStatistics(): Promise<NetworkStat>;

    updateNetwork(): Promise<void>;
}

/**
 * 网络管理
 */
export class Connectivity extends EventTarget {
    /**
     * 立即应用网络配置参数
     * - 设置网口分配的 IP 地址
     * - 设置默认网关
     * - 设置 DNS 服务器地址
     */
    applyNetworkConfig(): Promise<void>;

    /**
     * 检查 DHCP 信息是否改变
     * - /run/dhcp.conf
     * @returns 返回 `true` 表示 DHCP 信息有变动
     */
    checkDhcpConfig(): Promise<boolean>;

    /**
     * 检查网络配置文件是否改变
     * - $wotjs/conf/network.conf
     * @returns 返回 `true` 表示配置文件被改动
     */
    checkNetworkConfig(): Promise<boolean>;

    /** 
     * 返回当前处于活跃状态的网口的信息
     * 
     * @returns
     */
    getActiveNetworkInfo(): Promise<NetworkInterfaceInfo>;

    /** 
     * 返回指定类型的网口的 DHCP 信息 
     * @returns
     */
    getDhcpInfo(): Promise<DhcpInfo>;

    /** 读取 DNS 设置 */
    getNameServers(): Promise<string[]>;

    /** 
     * 返回指定类型的网口的连接信息 
     * @param type 
     * @returns
     */
    getNetworkInterfaceInfo(type: string): Promise<NetworkInterface>;

    /**
     * 返回指定的类型的网络接口名称
     * @param type
     */
    getNetworkInterfaceName(type: string): string | undefined;

    /**
     * 返回网络接口列表
     */
    getNetworkInterfaces(): Promise<NetworkInterface[]>;

    /** 
     * 返回当前优先使用的网络类型
     * `ethernet`, `wifi` 
     */
    getNetworkPreference(): string | undefined;

    /**
     * 返回指定的类型的网口的统计信息
     * @param type 
     */
    getNetworkStatistics(type: string): Promise<NetworkStat>;

    /**
     * 返回路由表所有项目
     * @returns {Promise<RouterInfo[]>}
     */
    getRoutes(): Promise<RouterInfo[]>;

    /**
     * 返回当前网络状态
     */
    getStatus(): Promise<NetworkStatus>;

    /**
     * 立即加载网络配置参数
     */
    loadNetworkConfig(): Promise<NetworkOptions>;

    /**
     * 立即复位网络配置
     * - 删除绑定的 IP 地址
     * - 清除 DHCP 信息
     */
    resetNetworkConfig(): Promise<void>;

    wifi: WifiManager;
    options: NetworkOptions;
    ethernet: EthernetManager;
}

export interface WifiStatus {
    ip_address?: string,
    mode?: string,
    address?: string,
    ssid?: string,
    wpa_state?: string,
    rssi?: string,
    signal_strength?: number
}

export interface WifiNetwork {
    id?: string;
    ssid?: string;
    bssid?: string;
    flags?: string;
}

export interface WifiQuality {
    quality?: number;
    noise?: number;
    link?: number;
    level?: number;
    updated?: number;
}

/**
 * 无线管理
 */
export class WifiManager {
    /**
     * 
     * @param ssid 
     * @param psk 
     */
    checkConfigFile(ssid?: string, psk?: string): Promise<any>;

    /**
     * 断开无线连接
     */
    disconnect(): Promise<os.ProcessResult>;

    /**
     * 启用指定的网络
     * @param networkId 
     * @param enabled 
     */
    enableNetwork(networkId: number | string, enabled: boolean): Promise<os.ProcessResult>;

    /**
     * 返回配置的网络信息
     */
    getConfiguredNetworks(): Promise<WifiNetwork>;

    /**
     * 返回无线网络接口信息
     */
    getNetworkInterfaceInfo(): Promise<NetworkInterface | undefined>;

    /**
     * 返回无线网络统计信息
     */
    getNetworkStatistics(): Promise<NetworkStat>;

    /**
     * 返回无线网络扫描结果
     */
    getScanResults(): Promise<os.ProcessResult>;

    /**
     * 返回无线网络信号状态
     */
    getSignalQuality(): Promise<WifiQuality>;

    /**
     * 返回无线网络状态
     */
    getStatus(): Promise<WifiStatus>;
    getStateName(state: number): string;

    /**
     * 指出电源是否打开
     */
    isPowerOn(): Promise<void>;

    /**
     * 指出无线网络是否已启用
     */
    isWifiEnabled: boolean;

    /**
     * 重新连接
     */
    reassociate(): Promise<os.ProcessResult>;

    /**
     * 重新加载配置并连接
     */
    reconfigure(): Promise<os.ProcessResult>;

    /**
     * 重新连接
     * - 只限于通过 disconnect 断开的情况
     */
    reconnect(): Promise<os.ProcessResult>;

    /**
     * 保存配置参数
     */
    saveConfiguration(): Promise<os.ProcessResult>;

    /**
     * 设置网络信息
     */
    setNetwork(): Promise<void>;

    /**
     * 设置电源开关
     * @param on 
     */
    setPowerOn(on: boolean): Promise<os.ProcessResult>;

    /**
     * 开始扫描
     */
    startScan(): Promise<os.ProcessResult>;

    /**
     * 更新网络
     * @param options 
     */
    updateNetwork(options: any): Promise<os.ProcessResult>;
}

export const wifi: WifiManager;
export const ethernet: EthernetManager;
export function getActiveNetwork(): Promise<WifiManager | EthernetManager>;
export function getConnectivity(): Connectivity;

export const $networkManager: Connectivity;
export default $networkManager;
