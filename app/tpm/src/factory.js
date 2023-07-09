// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as fs from '@tjs/fs';
import * as config from '@tjs/config';
import * as os from '@tjs/os';
import * as path from '@tjs/path';
import * as process from '@tjs/process';

import * as cmdline from '../../modules/utils/cmdline.js';
import * as getopts from '../../modules/utils/getopts.js';

/** @typedef {{sn?:string, did?:string,url?:string, secret?:string, uuid?:string, key?:string}} FactoryInfo */

/**
 * @param {string} filename
 */
async function readJSONFile(filename) {
    try {
        const data = await fs.readFile(filename, 'utf-8');
        const values = JSON.parse(/** @type string */(data));
        return values || {};
    } catch (e) {
    }
}

export class FactoryManager {

    /**
     * 加载 device.conf
     * @private
     * @returns 
     */
    async loadDeviceConfig() {
        let basePath;
        if (await fs.exists('/mnt/factory')) {
            basePath = '/mnt/factory';
        }

        const deviceConfig = await config.load('device', basePath);

        /** @type FactoryInfo */
        const info = {};
        info.url = deviceConfig.getString('wot.registry');
        info.did = deviceConfig.getString('wot.did');
        info.secret = deviceConfig.getString('wot.secret');
        info.sn = deviceConfig.getString('device.serial_number');

        info.uuid = deviceConfig.getString('tuya.uuid');
        info.key = deviceConfig.getString('tuya.key');
        return info;
    }

    /**
     * 加载 product.json
     * - 1. /mnt/factory/product.json
     * - 2. /usr/local/tjs/conf/product.json
     * @private
     * @returns {Promise<config.Config|undefined>}
     */
    async loadProductConfig() {
        // product & config
        let filename = '/mnt/factory/product.json';

        let values = await readJSONFile(filename);
        if (values == null) {
            filename = path.join(process.root, 'conf', 'product.json');
            values = await readJSONFile(filename);
        }

        return values;
    }

    /**
     * 初始化设备出厂配置信息
     * 1. loadDeviceConfig
     * 2. loadProductConfig
     * 3. updateDeviceConfig
     * 4. load user & network config
     */
    async reloadFactoryConfig() {
        try {
            // 1. 加载设备信息
            const options = await this.loadDeviceConfig();
            if (!options) {
                console.print('init: Invalid factory options!');
                return;

            } else if (!options.did) {
                console.print('factory.did is required!');
                return;

            } else if (!options.secret) {
                console.print('Invalid deivce secret');
                return;

            } else if (!options.sn) {
                console.print('factory.sn is required!');
                return;
            }

            console.print('= Init device config:\n');
            console.print('- did:    ' + options.did);
            console.print('- sn:     ' + options.sn);
            console.print('- secret: ' + options.secret);
            console.print('- url:    ' + options.url);
            if (options.uuid) {
                console.print('- uuid:   ' + options.uuid);
                console.print('- key:    ' + options.key);
            }
            console.print('');

            // 3. 更新 device.conf 配置文件
            await this.updateDeviceConfig(options);

            // 4. 加载默认的用户和网络配置信息 load default
            await cmdline.load('user');
            await cmdline.load('network', 'true');

        } catch (error) {
            console.print('\n= Error:\n');
            if (error.code) {
                console.print('- code:    ' + error.code);
                console.print('- message: ' + error.message);
                console.print('- error:   ' + error.error);

            } else {
                console.print(error);
            }

            console.print('');
        }
    }

    /**
     * 更新本地设备配置
     * @private
     * @param {FactoryInfo} options
     */
    async updateDeviceConfig(options) {
        // 2. 加载产品信息
        const values = await this.loadProductConfig();
        if (!values) {
            return;
        }

        const deviceConfig = new config.Config('device');
        deviceConfig.set(values);

        /**
         * @param {string} model
         * @param {string=} uuid
         * @returns {string}
         */
        function getHostname(model, uuid) {
            if (!uuid) {
                return model;
            }

            if (model.length > 4) {
                model = model.substring(0, 3);
            }

            if (uuid.length > 6) {
                uuid = uuid.substring(uuid.length - 6);
            }

            const name = model + '-' + uuid;
            return name.toLowerCase();
        }

        /**
         * @param {string} deviceName
         * @param {string=} uuid
         * @returns {string}
         */
        function getDeviceName(deviceName, uuid) {
            if (!uuid) {
                return deviceName;
            }

            if (uuid.length > 6) {
                uuid = uuid.substring(uuid.length - 6);
            }

            const name = deviceName + '-' + uuid;
            return name.toLowerCase();
        }

        // const deviceName = data['device.name'] || '';
        const deviceModel = deviceConfig.getString('device.model_number') || '';

        const now = new Date();

        // device.serial_number
        deviceConfig.setItem('device.serial_number', options.sn);
        deviceConfig.setItem('device.name', getDeviceName(deviceModel, options.did));
        deviceConfig.setItem('hostname', getHostname(deviceModel, options.did));
        deviceConfig.setItem('wot.did', options.did);
        deviceConfig.setItem('wot.secret', options.secret);
        deviceConfig.setItem('wot.registry', options.url);
        deviceConfig.setItem('tuya.uuid', options.uuid);
        deviceConfig.setItem('tuya.key', options.key);
        deviceConfig.setItem('updated', now.toISOString());

        const ret = await deviceConfig.save();
        console.print('Save to:', deviceConfig.filename);
        return ret;
    }
}

const commands = {
    /** 
     * 查看出厂设置信息 
     * - device.serial_number
     * - wot.did
     * - wot.registry
     * - wot.secret
     */
    async info() {
        let basePath;
        if (await fs.exists('/mnt/factory')) {
            basePath = '/mnt/factory';
        }

        const deviceConfig = await config.load('device', basePath);
        console.table(deviceConfig.data);
    },
    /**
     * 初始化设备信息，如设备 ID 和密钥等等
     * @param {any[]} args 
     * @returns {Promise<FactoryInfo|undefined>}
     */
    async init(...args) {
        const options = getopts.parse(args, { string: ['did', 'secret', 'sn', 'url'] });
        // console.log('options', options);

        if (!options.did) {
            console.print('Usage: tpm factory init --did=[did] --secret=[secret] --sn=[sn] --url=[url]');
        }

        // 以可写方式重新挂载 `/mnt/factory`
        if (await fs.exists('/dev/mtdblock2')) {
            await os.exec('mount -w -t jffs2 -o remount /dev/mtdblock2 /mnt/factory');
        }

        // 修改 `/mnt/factory/device.conf`
        let basePath;
        if (await fs.exists('/mnt/factory')) {
            basePath = '/mnt/factory';
        }
        const deviceConfig = await config.load('device', basePath);

        /**
         * @param {string} name 
         * @param {any} value 
         * @returns {string|undefined}
         */
        function getString(name, value) {
            if (value == null || value == '') {
                value = deviceConfig.getString(name);
                if (value == null) {
                    return;
                }
            }

            return String(value);
        }

        /** @type FactoryInfo */
        const info = {};
        info.url = getString('wot.registry', options.url);
        info.did = getString('wot.did', options.did);
        info.secret = getString('wot.secret', options.secret);
        info.sn = getString('device.serial_number', options.sn);

        // wot
        deviceConfig.setItem('wot.registry', info.url);
        deviceConfig.setItem('wot.did', info.did);
        deviceConfig.setItem('wot.secret', info.secret);
        deviceConfig.setItem('device.serial_number', info.sn);

        // tuya
        if (info.did && info.did.startsWith('tuya')) {
            deviceConfig.setItem('tuya.uuid', info.did);
            deviceConfig.setItem('tuya.key', info.secret);
        }

        if (await deviceConfig.save()) {
            console.print('init:', 'Save settings to', deviceConfig.filename);
        }

        return options;
    },
    /**
     * 重新初始化设备信息
     * - 1. load factory config
     * - 2. load product config
     * - 3. update device config
     * - 4. load default network config
     * - 5. load default user config
     */
    async reload() {
        const manager = new FactoryManager();
        await manager.reloadFactoryConfig();
    }
};

export const command = {
    title: '管理出厂配置参数',
    subtitle: {
        info: '查看设备出厂配置信息',
        init: '修改设备出厂配置信息',
        reload: '重新加载设备出厂配置信息'
    },
    commands
};
