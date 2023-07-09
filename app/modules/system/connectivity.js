// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
/// <reference path ="connectivity.d.ts" />

/** @typedef {import("./connectivity.js").NetworkInterface} NetworkInterface */
/** @typedef {import("./connectivity.js").NetworkInterfaceInfo} NetworkInterfaceInfo */
/** @typedef {import("./connectivity.js").DhcpInfo} DhcpInfo */
/** @typedef {import("./connectivity.js").RouterInfo} RouterInfo */
/** @typedef {import("./connectivity.js").NetworkStat} NetworkStat */
/** @typedef {import("./connectivity.js").NetworkStatus} NetworkStatus */
/** @typedef {import("./connectivity.js").NetworkOptions} NetworkOptions */

import * as config from '@tjs/config';
import * as fs from '@tjs/fs';
import * as os from '@tjs/os';

import { WifiManager } from './wifi.js';

/** @enum {number} NetworkType */
export const NetworkType = {
    MOBILE: 0,
    BLUETOOTH: 1,
    WIFI: 2,
    ETHERNET: 3
};

/**
 * 读取文本文件内容
 * @param {string} filename 
 * @returns {Promise<string|undefined>} 文件内容
 */
async function readTextFile(filename) {
    try {
        const result = await fs.readFile(filename, 'utf-8');
        return /** @type string */(result);

    } catch (err) {
        
    }
}

/**
 * 以太网络管理
 */
export class EthernetManager {
    /** @param {Connectivity} networkManager */
    constructor(networkManager) {
        /** @type Connectivity */
        this.networkManager = networkManager;

        /** @type string */
        this.type = 'ethernet';

        /** @type string */
        this.name = 'eth0';
    }

    get [Symbol.toStringTag]() {
        return 'EthernetManager';
    }

    async getNetworkInterfaceInfo() {
        return await this.networkManager.getNetworkInterfaceInfo(this.type);
    }

    async getNetworkStatistics() {
        return await this.networkManager.getNetworkStatistics(this.type);
    }

    async updateNetwork() {

    }
}

/**
 * 网络管理
 */
export class Connectivity extends EventTarget {

    constructor() {
        super();
        
        /** @type NetworkOptions */
        this.options = {};

        /** 
         * @private
         * @type number 
         */
        this.lastDhcpModified = 0;

        /** 
         * @private
         * @type number 
         */
        this.lastNetworkModified = 0;

        /** @type config.Config */
        this.networkConfig = new config.Config('network');

        /** @type config.Config */
        this.dhcpConfig = new config.Config('dhcp', os.tmpdir());
    }

    get [Symbol.toStringTag]() {
        return 'Connectivity';
    }

    /**
     * 立即应用网络配置信息
     * @returns 
     */
    async applyNetworkConfig() {
        const options = this.options;
        if (!options.enabled) {
            return;
        }

        await this.setAddress(options);
        await this.setGateway(options);
        await this.setNameServers(options);
        await this.setHostname(options);
    }

    /**
     * 检查 DHCP 信息是否改变
     * @returns {Promise<boolean>} 返回 `true` 表示 DHCP 信息有变动
     */
    async checkDhcpConfig() {
        await this.dhcpConfig.load();
        const lastModified = this.dhcpConfig.lastModified;
        if (this.lastDhcpModified == lastModified) {
            return false;
        }

        this.lastDhcpModified = lastModified;
        return true;
    }

    /**
     * 检查网络配置文件是否改变
     * @returns {Promise<boolean>} 返回 `true` 表示配置文件被改动
     */
    async checkNetworkConfig() {
        await this.networkConfig.load();

        const lastModified = this.networkConfig.lastModified;
        if (this.lastNetworkModified == null) {
            this.lastNetworkModified = lastModified;
            return false;

        } else if (this.lastNetworkModified == lastModified) {
            return false;
        }

        this.lastNetworkModified = lastModified;
        return true;
    }

    /** 
     * 返回当前处于活跃状态的网口的信息
     * 
     * @returns {Promise<NetworkInterfaceInfo|undefined>}
     */
    async getActiveNetworkInfo() {
        const routes = await this.getRoutes() || [];
        const gateway = routes.find(route => route.name == 'default');
        if (!gateway) {
            return;
        }

        const interfaces = await this.getNetworkInterfaces();
        const networkInterface = interfaces.find(face => face.name == gateway.dev);
        if (!networkInterface) {
            return;
        }

        /** @type NetworkInterfaceInfo */
        const networkInfo = Object.assign({}, networkInterface);
        networkInfo.gateway = gateway.via;
        networkInfo.dns = await this.getNameServers();

        const options = this.options;
        if (gateway.dev == options?.interface) {
            networkInfo.type = options?.type;
        } else {
            networkInfo.type = 'ethernet';
        }

        return networkInfo;
    }

    /** 
     * 返回指定类型的网口的 DHCP 信息 
     * @returns {Promise<DhcpInfo>}
     */
    async getDhcpInfo() {
        await this.dhcpConfig.load();
        const dhcpData = this.dhcpConfig.data || {};

        const value = dhcpData.dns;
        const dns = value?.split(' ') || [];

        /** @type DhcpInfo */
        const options = {};
        options.dns1 = dns[0];
        options.dns2 = dns[1];
        options.gateway = dhcpData.router;
        options.ip = dhcpData.ip;
        options.netmask = dhcpData.subnet;
        options.interface = dhcpData.interface;
        options.lease = dhcpData.lease;
        options.server = dhcpData.serverid;
        options.broadcast = dhcpData.broadcast;
        options.hostname = dhcpData.hostname;
        options.updated = dhcpData.updated;

        const result = {};
        for (const key in options) {
            const value = options[key];
            if (value != null) {
                result[key] = value;
            }
        }

        return result;
    }

    /** 
     * 返回指定类型的网口的连接信息 
     * @param {string} networkType `wifi`,`ethernet`
     * @returns {Promise<NetworkInterface|undefined>}
     */
    async getNetworkInterfaceInfo(networkType) {
        const name = this.getNetworkInterfaceName(networkType);
        if (!name) {
            return;
        }

        const interfaces = await this.getNetworkInterfaces();
        const iface = interfaces.find(face => face.name == name);
        if (!iface) {
            return;
        }

        /** @type NetworkInterface */
        return Object.assign({ type: networkType }, iface);
    }

    /**
     * @param {string} networkType `wifi`,`ethernet`
     * @returns {string|undefined}
     */
    getNetworkInterfaceName(networkType) {
        let name;
        if (networkType == null) {
            name = undefined;

        } else if (networkType == 'wifi') {
            name = wifi?.name;

        } else {
            name = ethernet?.name;
        }

        return name;
    }

    /** 
     * 返回所有网口信息 
     * @returns {Promise<NetworkInterface[]>}
     */
    async getNetworkInterfaces() {
        return os.networkInterfaces() || [];
    }

    /** 
     * 当前优先的网络类型 
     * @returns {string|undefined}
     */
    getNetworkPreference() {
        return this.options?.type;
    }

    /**
     * 返回网络统计信息
     * @param {string} networkType 
     * @returns {Promise<NetworkStat|undefined>}
     */
    async getNetworkStatistics(networkType) {
        const name = this.getNetworkInterfaceName(networkType);
        if (!name) {
            return;
        }

        /** @type NetworkStat */
        const status = {};
        const basePath = '/sys/class/net/' + name + '/statistics/';

        /** @param {string} filename */
        async function readNumber(filename) {
            const fileData = await readTextFile(basePath + filename);
            if (!fileData) {
                return 0;
            }

            return Number.parseInt(fileData);
        }

        status.rxBytes = await readNumber('rx_bytes');
        status.rxPackets = await readNumber('rx_packets');
        status.txBytes = await readNumber('tx_bytes');
        status.txPackets = await readNumber('tx_packets');

        // console.log('getNetworkStatistics', status);
        return status;
    }

    /** 
     * 读取 DNS 设置 
     * @return {Promise<string[]|undefined>}
     */
    async getNameServers() {
        const filename = '/etc/resolv.conf';
        const filedata = await readTextFile(filename);
        if (!filedata) {
            return;
        }

        /** @type string[] */
        const servers = [];
        const lines = filedata.split('\n');
        for (const line of lines) {
            const tokens = line.split(' ');
            const name = tokens[0];
            if (!name || name != 'nameserver') {
                continue;
            }

            const value = tokens[1];
            if (value) {
                servers.push(value);
            }
        }

        return servers;
    }

    /**
     * 返回路由表所有项目
     * @returns {Promise<RouterInfo[]>}
     */
    async getRoutes() {
        const result = await os.exec('ip route');
        const data = result.stdout || '';
        const lines = data.split('\n');

        /** @type RouterInfo[] */
        const routes = [];

        for (const line of lines) {
            const tokens = line.split(/[ ]+/);
            // console.log(tokens);
            if (!tokens[0]) {
                break;
            }

            /** @type RouterInfo */
            const route = {};
            route.name = tokens[0];

            let i = 1;
            while (tokens[i] != null) {
                const key = tokens[i];
                if (!key) {
                    break;
                }

                i++;
                const value = tokens[i];
                i++;

                route[key] = value;
            }

            routes.push(route);
        }

        return routes;
    }

    /** 
     * 返回当前网络信息 
     * @returns {Promise<NetworkStatus>}
     */
    async getStatus() {
        if (!this.options?.type) {
            await this.loadNetworkConfig();
        }

        /** @type NetworkStatus */
        const status = await $connectivity.getActiveNetworkInfo() || {};

        // preference
        const preference = $connectivity.getNetworkPreference();
        if (preference) {
            status.preference = preference;
            status.interface = this.getNetworkInterfaceName(preference);
        }

        // DHCP
        const dhcp = await $connectivity.getDhcpInfo();
        if (dhcp && dhcp.ip) {
            status.dhcp = dhcp;
        }

        return status;
    }

    /** 读取网络配置信息 */
    async loadNetworkConfig() {
        const networkConfig = this.networkConfig;
        await networkConfig.load();

        /** @type NetworkOptions */
        const options = {};
        options.hostname = networkConfig.getString('hostname');

        const isWifiEnabled = networkConfig.getBoolean('wlan.enabled');

        if (wifi) {
            wifi.name = networkConfig.getString('wlan.interface') || 'wlan0';
        }

        if (ethernet) {
            ethernet.name = networkConfig.getString('eth.interface') || 'eth0';
        }

        if (isWifiEnabled) {
            // Wi-Fi
            options.enabled = true;
            options.type = 'wifi';
            options.family = networkConfig.getString('wlan.family');
            options.interface = networkConfig.getString('wlan.interface') || 'wlan0';
            options.mode = networkConfig.getString('wlan.mode');

            options.ssid = networkConfig.getString('wlan.ssid');
            options.psk = networkConfig.getString('wlan.key');

        } else {
            // Ethernet
            options.enabled = networkConfig.getBoolean('eth.enabled');
            options.type = 'ethernet';
            options.family = networkConfig.getString('eth.family');
            options.interface = networkConfig.getString('eth.interface') || 'eth0';
            options.mode = networkConfig.getString('eth.mode');
        }

        if (options.mode == 'static') {
            if (options.type == 'wifi') {
                options.dns1 = networkConfig.getString('wlan.dns1');
                options.dns2 = networkConfig.getString('wlan.dns2');
                options.gateway = networkConfig.getString('wlan.gateway');
                options.ip = networkConfig.getString('wlan.ip');
                options.netmask = networkConfig.getString('wlan.netmask');

            } else if (options.type == 'ethernet') {
                options.dns1 = networkConfig.getString('eth.dns1');
                options.dns2 = networkConfig.getString('eth.dns2');
                options.gateway = networkConfig.getString('eth.gateway');
                options.ip = networkConfig.getString('eth.ip');
                options.netmask = networkConfig.getString('eth.netmask');
            }

        } else { // dhcp
            await this.dhcpConfig.load();
            const dhcpData = (this.dhcpConfig.data) || {};

            const value = dhcpData.dns;
            const dns = value?.split(' ') || [];
            options.dns1 = dns[0];
            options.dns2 = dns[1];
            options.gateway = dhcpData.router;
            options.ip = dhcpData.ip;
            options.netmask = dhcpData.subnet;
        }

        this.options = options;
        return options;
    }

    async resetNetworkConfig() {
        console.info('connectivity:', 'Reset network settings...');

        const options = this.options;
        if (!options.enabled) {
            return;
        }

        try {
            await this.setAddress({ interface: options.interface, ip: '0.0.0.0' });
        } catch (e) {
            console.info('connectivity:', 'Error:', e.message);
        }

        try {
            const filename = this.dhcpConfig.filename;
            if (await fs.exists(filename)) {
                console.log('connectivity:', 'Remove:', filename);
                await fs.unlink(filename);
            }
        } catch (e) {
            console.info('connectivity:', 'Error:', e.message);
        }
    }

    /** 
     * 修改 IP 地址设置 
     * @param {{interface?: string, ip?:string, netmask?: string}} options
     */
    async setAddress(options) {
        if (!options || !options.ip) {
            return;
        }

        const ifacename = options.interface;
        let command = `ifconfig ${ifacename} ${options.ip}`;
        if (options.netmask) {
            command += ' netmask ' + options.netmask;
        }

        console.log('connectivity:', `Set ${ifacename} address: ${options.ip}/${options.netmask}`);
        await os.exec(command);
    }

    /** 
     * 修改网关设置 
     * @param {{interface?: string, gateway?:string}} options
     */
    async setGateway(options) {
        if (!options || !options.gateway) {
            return;
        }

        const ifacename = options.interface;
        const command = `ip route add default via ${options.gateway} dev ${ifacename}`;

        const routes = await this.getRoutes();
        // console.log('routes', routes);

        for (const route of routes) {
            if (route.name == 'default') {
                if (route.dev == ifacename) {
                    if (route.via == options.gateway) {
                        return;
                    }
                }

                await os.exec('ip route del default dev ' + route.dev);
            }
        }

        await os.exec(command);
        console.log('connectivity:', `Set ${ifacename} gateway: ${options.gateway}`);
    }

    /** 
     * 修改 hostname 设置 
     * @param {{hostname?:string}} options
     * 
     */
    async setHostname(options) {
        const hostname = options?.hostname;
        if (!hostname) {
            return;
        }

        const oldHostname = os.hostname();
        if (oldHostname != hostname) {
            console.log('connectivity:', 'Set hostname: ' + hostname);
            await os.exec('hostname ' + hostname);
        }
    }

    /** 
     * 当前优先的网络类型 
     * @param {string} networkType
     */
    setNetworkPreference(networkType) {
        this.preferenceNetwork = networkType;
    }

    /** 
     * 修改 DNS 设置 
     * @param {{dns1?:string, dns2?:string}} options
     */
    async setNameServers(options) {
        if (!options || !options.dns1) {
            return;
        }

        const filename = '/system/etc/resolv.conf';
        const filedata = await readTextFile(filename);

        const lines = [];
        lines.push('nameserver ' + options.dns1);

        const dns2 = options.dns2 || '114.114.114.114';
        lines.push('nameserver ' + dns2);
        lines.push('');

        const data = lines.join('\n');
        if (data != filedata) {
            await fs.writeFile(filename, data);
            console.print('connectivity:', 'Set nameservers: ' + data);
        }
    }
}

const $connectivity = new Connectivity();

// @ts-ignore
export const wifi = new WifiManager($connectivity);
export const ethernet = new EthernetManager($connectivity);

/**
 * 返回当前处理活跃状态的网络
 * @returns {Promise<WifiManager|EthernetManager|undefined>}
 */
export async function getActiveNetwork() {
    const active = await $connectivity.getActiveNetworkInfo();
    if (!active) {
        return;
    }

    if (active.type == 'ethernet') {
        return ethernet;

    } else if (active.type == 'wifi') {
        return wifi;
    }
}

/**
 * 
 * @returns {Connectivity}
 */
export function getConnectivity() {
    return $connectivity;
}
