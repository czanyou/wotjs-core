// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
/** @typedef {import("./connectivity.js").Connectivity} Connectivity */
/** @typedef {import("./connectivity.js").WifiQuality} WifiQuality */

import * as fs from '@tjs/fs';
import * as os from '@tjs/os';
import * as gpio from '@tjs/gpio';
import * as path from '@tjs/path';

/** @enum {number} */
export const WifiDetailedState = {
    IDLE: 0, // Ready to start data connection setup.
    SCANNING: 1, // Searching for an available access point. 
    CONNECTING: 2, // Currently setting up data connection. 
    AUTHENTICATING: 3, // Network link established, performing authentication. 
    OBTAINING_IPADDR: 4, // Awaiting response from DHCP server in order to assign IP address information.
    CONNECTED: 5, // IP traffic should be available. 
    SUSPENDED: 6, // IP traffic is suspended.
    DISCONNECTING: 7, // Currently tearing down data connection. 
    DISCONNECTED: 8, // IP traffic not available. 
    FAILED: 9, // Attempt to connect failed. 
    BLOCKED: 10, // Access to this network is blocked.
    VERIFYING_POOR_LINK: 11 // Link has poor connectivity.
};

/** @enum {number} */
export const WifiState = {
    IDLE: 0, // Ready to start data connection setup.
    OBTAINING_IPADDR: 4, // Awaiting response from DHCP server in order to assign IP address information.
    CONNECTING: 2, // Currently setting up data connection. 
    CONNECTED: 5, // IP traffic should be available. 
    DISCONNECTING: 7, // Currently tearing down data connection. 
    DISCONNECTED: 8, // IP traffic not available. 
    FAILED: 9 // Attempt to connect failed. 
};

export const WifiStateNames = ['idle', 'scanning', 'connecting', 'authenticating', 'obtaining', 'connected', 'suspended', 'disconnecting', 'disconnected', 'failed', 'blocked', 'poorlink'];

/**
 * 读取文本文件内容
 * @param {string} filename 
 * @returns {Promise<string>} 文件内容
 */
async function readTextFile(filename) {
    try {
        const result = await fs.readFile(filename, 'utf-8');
        return String(result);

    } catch (err) {
        return '';
    }
}

/**
 * 无线网络管理
 * 这个类主要通过调用 wpa_supplicant 进程接口来管理无线网络
 */
export class WifiManager extends EventTarget {
    /** @param {Connectivity} [networkManager] */
    constructor(networkManager) {
        super();

        /** @type Connectivity|undefined */
        this.networkManager = networkManager;

        /** @type string */
        this.socketPath = '/var/run/wpa_supplicant';

        /** @type boolean */
        this.isEnabled = false;

        /** @type string */
        this.type = 'wifi';

        /** @type string */
        this.name = 'wlan0';

        /** @type string */
        this.basePath = '/system/etc';

        /** @type Object<string,string|undefined> */
        this.config = { ssid: undefined, psk: undefined };
    }

    get [Symbol.toStringTag]() {
        return 'WifiManager';
    }

    get isWifiEnabled() {
        return this.isEnabled;
    }

    set isWifiEnabled(enabled) {
        this.isEnabled = enabled;
    }

    /**
     * 检查 Wi-Fi 配置文件
     * @param {string=} ssid SSID
     * @param {string=} psk 密码
     * @returns {Promise<boolean>} true 表示配置发生了改变
     */
    async checkConfigFile(ssid, psk) {
        let filedata = 'ctrl_interface=/var/run/wpa_supplicant\nupdate_config=1\n\n';

        if (ssid && psk && (psk.length >= 8)) {
            filedata += `network={\n\tssid="${ssid}"\n\tpsk="${psk}"\n}\n`;
        }

        const basePath = this.basePath || '/system/etc';
        const filename = path.join(basePath, 'wpa_supplicant.conf');
        const result = await this.saveConfigFile(filename, filedata);
        if (!result) {
            return false;
        }

        this.config.ssid = ssid;
        this.config.psk = psk;

        await this.reconfigure();
        console.info('wifi:', 'Reconfigure Wi-Fi settings:', ssid);
        return true;
    }

    async disconnect() {
        return this._sendCommand('disconnect');
    }

    /**
     * 启用或禁用无线网络
     * @param {string|number} networkId 
     * @param {boolean} enabled 
     * @returns 
     */
    async enableNetwork(networkId, enabled) {
        if (enabled) {
            return this._sendCommand(`enable_network  ${networkId}`);
        } else {
            return this._sendCommand(`disable_network  ${networkId}`);
        }
    }

    /**
     * 返回已配置的网络
     * @returns 
     */
    async getConfiguredNetworks() {
        const result = await this._sendCommand('list_network');
        const results = this._parseResults(result, ['id', 'ssid', 'bssid', 'flags']);
        return results;
    }

    /**
     * 
     * @returns 
     */
    async getNetworkInterfaceInfo() {
        const status = await this.networkManager?.getNetworkInterfaceInfo(this.type);
        if (!status) {
            return;
        }

        const flags = status.flags || 0;
        const up = !!(flags & 0x01);
        const running = !!(flags & 0x40);

        if (up && running) {
            if (status.ip) {
                status.state = WifiState.CONNECTED;

            } else {
                status.state = WifiState.OBTAINING_IPADDR;
            }

        } else {
            status.state = WifiState.CONNECTING;
        }

        return status;
    }

    /**
     * 
     * @returns 
     */
    async getNetworkStatistics() {
        return this.networkManager?.getNetworkStatistics(this.type);
    }

    /**
     * 返回 AP 扫描结果
     * @returns 
     */
    async getScanResults() {
        const result = await this._sendCommand('scan_result');
        // console.log(result);

        const results = this._parseResults(result, ['bssid', 'frequency', 'signal', 'flags', 'ssid']);
        return results;
    }

    /**
     * 返回当前信号强度
     * @returns {Promise<WifiQuality|undefined>}
     */
    async getSignalQuality() {
        try {
            const filename = '/proc/net/wireless';
            const data = await fs.readFile(filename, 'utf-8');
            if (!data) {
                return;
            }

            const content = String(data);
            const lines = content.split('\n');
            const line2 = lines[2] || '';
            const tokens = line2.split('  ');
            const x = [];
            for (let i = 0; i < tokens.length; i++) {
                const value = Number.parseInt(tokens[i]) || 0;
                x.push(value);
            }

            const wifiQuality = {};
            wifiQuality.link = x[1];
            wifiQuality.quality = x[2];
            wifiQuality.noise = x[3];
            return wifiQuality;

        } catch (e) {
            
        }
    }

    /**
     * 返回当前 Wi-Fi 状态
     * @returns 
     */
    async getStatus() {
        const result = await this._sendCommand('status');
        const data = result && result.stdout;
        if (!data) {
            return;
        }

        const lines = data.split('\n');
        const results = {};
        for (const line of lines) {
            const tokens = line.split('=');
            if (tokens[1]) {
                results[tokens[0]] = tokens[1];
            }
        }

        return results;
    }

    /**
     * @param {number} state 
     * @returns string
     */
    getStateName(state) {
        return WifiStateNames[state];
    }

    /** 检查电源状态 */
    async isPowerOn() {
        const port = await gpio.requestPort('wifien');
        if (port) {
            return await port.isOn();
        }
    }

    /** 重新连接，只在 disconnect 状态下有效 */
    async reconnect() {
        return this._sendCommand('reconnect');
    }

    /** 重新加载和应用配置参数 */
    async reconfigure() {
        return this._sendCommand('reconfigure');
    }

    /** 重新连接 */
    async reassociate() {
        return this._sendCommand('reassociate');
    }

    /** 保存配置的网络信息 */
    async saveConfiguration() {
        return this._sendCommand('save_config');
    }

    /**
     * 安全地保存配置文件
     * - 文件内容有改动才写入
     * @param {string} filename 配置文件
     * @param {string} data 文件内容
     * @returns true 表示保存的文件内容已发生改变
     */
    async saveConfigFile(filename, data) {

        /**
         * remove
         * @param {string} filename 
         * @returns Promise<Error | undefined>
         */
        async function remove(filename) {
            try {
                await fs.unlink(filename);

            } catch (err) {
                return err;
            }
        }

        // 读取当前文件
        const filedata = await readTextFile(filename);
        if (filedata == data) {
            return false;
        }

        // 写入临时文件
        const tempname = filename + '~';
        try {
            await fs.writeFile(tempname, data);
            const filedata = await readTextFile(tempname);
            if (filedata != data) {
                return false;
            }

            // remove 
            await remove(filename);

            // 重命名
            await fs.rename(tempname, filename);

        } catch (err) {
            console.log('wifi:', 'Write file failed:', err);
            return false;
        }

        return true;
    }

    /** 
     * 设置网络配置信息 
     * @param {string|number} networkId 要配置的网络的 ID
     * @param {string} key 参数名
     * @param {string=} value 参数值
     */
    async setNetwork(networkId, key, value) {
        if (value == null) {
            return;
        }

        return this._sendCommand(`set_network ${networkId} ${key} "${value}"`);
    }

    /** 设置电源状态 */
    async setPowerOn(isOn = true) {
        const port = await gpio.requestPort('wifien');
        if (!port) {
            return;
        }

        if (isOn) {
            await port.setOn();

        } else {
            await port.setOff();
        }
    }

    /** 开始扫描 */
    async startScan() {
        return this._sendCommand('scan');
    }

    /**
     * 更新网络配置信息
     * @param {{ssid:string,key?:string,psk?:string}} config 
     */
    async updateNetwork(config) {
        const networks = await this.getConfiguredNetworks();
        const network = networks && networks[0];
        let networkId = '0';

        if (!network) {
            await this._sendCommand(`add_network ${networkId}`);

        } else {
            networkId = network.id || '0';
        }

        await this.setNetwork(networkId, 'ssid', config.ssid);
        await this.setNetwork(networkId, 'psk', config.key || config.psk);
        await this.enableNetwork(networkId, true);
    }

    /**
     * 
     * @param {*} result 
     * @param {*} names 
     * @returns 
     */
    _parseResults(result, names) {
        const stdout = result && result.stdout;
        if (!stdout) {
            return;
        }

        const results = [];

        /** @param {string[]} tokens */
        function parseLine(tokens) {
            const result = {};
            for (let i = 0; i < names.length; i++) {
                result[names[i]] = tokens[i];
            }

            const value = result.flags;
            if (value) {
                const flags = {};
                const tokens = value.split(/\[|\]/);
                for (const token of tokens) {
                    if (token) {
                        flags[token] = 1;
                    }
                }
                result.flags = flags;
            }

            results.push(result);
        }

        const lines = stdout.split('\n');
        for (const line of lines) {
            const tokens = line.split('\t');
            if (tokens.length >= names.length) {
                parseLine(tokens);
            }
        }

        return results;
    }

    /**
     * @param {string} command 
     * @returns 
     */
    async _sendCommand(command) {
        try {
            const result = await os.exec(`wpa_cli -p ${this.socketPath} ${command}`);
            return result;

        } catch (err) {
            console.log('wifi:', err);
        }
    }
}
