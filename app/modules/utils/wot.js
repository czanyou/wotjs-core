// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as mqtt from '@tjs/mqtt';
import * as jsonrpc from '@tjs/jsonrpc';
import { defineEventAttribute } from '@tjs/event-target';

const TAG = 'wot:';

/**
 * @typedef {{op?: string, protocol?: string, did?: string, subscription?: string, forwards?: string, clientId?: string, url?: string, href?: string, username?: string, password?: string}} ServientOptions
 */

// ////////////////////////////////////////////////////////////
// ConsumedThing

export class ConsumedThing extends EventTarget {
    /** @param {*} td */
    constructor(td) {
        super();

        if (typeof td == 'string') {
            td = JSON.parse(td);
        }

        if (typeof td != 'object') {
            throw new Error('Invalid thing description');
        }

        /** @type {{ [name: string]: object }} */
        this.actions = {};

        /** @type {{ [name: string]: object }} */
        this.events = {};

        /** @type {{ [name: string]: object }} */
        this.properties = {};

        /** @type {{ [name: string]: object }} */
        this.services = {};

        /** @type {{ [name: string]: any }} */
        this.metadata = {};

        /** @type string */
        this.thingDescription = td;

        /** @type string | undefined */
        this._id = td?.did || td?.id;

        const properties = td.properties || {};
        for (const name in properties) {
            this.properties[name] = {};
        }

        const actions = td.actions || {};
        for (const name in actions) {
            this.actions[name] = {};
        }

        const events = td.events || {};
        for (const name in events) {
            this.events[name] = {};
        }

        const services = td.services || {};
        for (const name in services) {
            this.services[name] = {};
        }
    }

    get [Symbol.toStringTag]() {
        return 'ConsumedThing';
    }

    get id() {
        return this._id;
    }

    getThingDescription() {
        return this.thingDescription;
    }

    /**
     * 
     * @param {string} name 
     * @param {*} [options] 
     * @returns 
     */
    async readProperty(name, options) {
        const property = this.properties[name];
        return property && property.value;
    }

    /**
     * 
     * @param {*} [options] 
     * @returns 
     */
    async readAllProperties(options) {
        const names = Object.keys(this.properties);
        return this.readMultipleProperties(names, options);
    }

    /**
     * 
     * @param {string|string[]} names 
     * @param {*} [options] 
     * @returns 
     */
    async readMultipleProperties(names, options) {
        if (typeof names == 'string') {
            names = names.split(',');

        } else if (!Array.isArray(names)) {
            return;
        }

        options = options || {};
        options.mode = 'multiple';

        const values = {};
        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            values[name] = await this.readProperty(name, options);
        }

        return values;
    }

    /**
     * 
     * @param {string} name 
     * @param {*} value 
     * @param {*} [options] 
     */
    async writeProperty(name, value, options) {
        const property = this.properties[name];
        if (property) {
            property.value = value;
        }
    }

    /**
     * 
     * @param {*} valueMap 
     * @param {*} [options] 
     */
    async writeMultipleProperties(valueMap, options) {
        options = options || {};
        options.mode = 'multiple';

        for (const name in valueMap) {
            const property = this.properties[name];
            if (property == null) {
                continue;
            }

            const value = valueMap[name];
            await this.writeProperty(name, value, options);
        }
    }

    /**
     * 
     * @param {string} name 
     * @param {*} params 
     * @param {*} [options] 
     */
    async invokeAction(name, params, options) {

    }
}

// ////////////////////////////////////////////////////////////
// ExposedThing

export class ExposedThing extends ConsumedThing {
    /** @param {*} td */
    constructor(td) {
        super(td);

        /** @type {Object<string,any>|undefined} */
        this.forms = undefined; // 协议绑定参数

        this._transport = undefined;
        this._exposeTimer = undefined;

        this._notify_values = new Map();
        this._notify_timer = undefined;

        // console.log(TAG, 'ExposedThing', this.id, td);
    }

    get [Symbol.toStringTag]() {
        return 'ExposedThing';
    }

    async expose() {
        if (this._exposeTimer) {
            return;

        } else if (!this.id) {
            console.warn(TAG, 'Expose: Invalid id');
            return;
        }

        // console.log('options', options.host, options.port, options.pathname);
        const transport = $servient?.getTransport();
        this._transport = transport;

        const forms = this.forms;
        const options = {};
        options.subscription = forms?.subscription;
        
        transport?.subscribe(this.id, options);

        // console.log('wot: expose', this.id, this._transport);
        // const description = this.getThingDescription();
        // console.log(TAG, 'expose', this.id, description);
        // await transport?.register(this.id, description);

        await $servient?.addThing(this);
    }

    async destroy() {
        const transport = this._transport;
        this._transport = null;

        const did = this.id;
        if (did) {
            await transport?.unsubscribe(did, {});
            await $servient?.destroyThing(did);
        }

        if (this._exposeTimer) {
            clearInterval(this._exposeTimer);
            this._exposeTimer = null;
        }

        this.removeAllEventListeners();
    }

    /**
     * 
     * @param {string} name 
     * @param {*} data 
     */
    async emitEvent(name, data) {
        const event = this.events[name];
        const handler = event && event.handler;

        if (event) {
            event.data = data;
        }

        if (handler) {
            await handler(name, data);
        }

        const message = {
            did: this.id,
            type: 'event',
            data: {}
        };

        message.timestamp = Date.now();
        message.data[name] = data;
        await this._sendMessage(message);
    }

    /** @param {string|string[]} name */
    async emitPropertyChange(name) {
        if (this._emitTimer) {
            return;
        }

        if (name == '@all') {
            this._emitTimer = setTimeout(async () => {
                this._emitTimer = null;

                const values = await this.readAllProperties();
                this.dispatchEvent(new MessageEvent('property', { data: values }));

                const message = { did: this.id, type: 'property', data: values };
                this._sendMessage(message);
            }, 0);

        } else if (Array.isArray(name)) {
            this._emitTimer = setTimeout(async () => {
                this._emitTimer = null;

                const values = await this.readMultipleProperties(name);
                const message = { did: this.id, type: 'property', data: values };
                this._sendMessage(message);
            }, 0);

        } else {
            const property = this.properties[name];
            if (!property) {
                return;
            }

            this._emitTimer = setTimeout(async () => {
                this._emitTimer = null;

                const values = {};
                values[name] = await this.readProperty(name);
                const message = { did: this.id, type: 'property', data: values };
                this._sendMessage(message);
            }, 0);
        }
    }

    getTransport() {
        return this._transport;
    }

    /**
     * 
     * @param {string} name 
     * @param {*} params 
     * @param {*} options 
     * @returns 
     */
    async invokeAction(name, params, options) {
        let action = this.actions[name];
        if (!action) {
            action = this.services[name];
        }

        let flags = null;

        if (!action) {
            action = this.actions.execute;

            // 兼容老的消息格式 name: { key: {} }
            if (action) {
                const input = params || {};
                const keys = Object.keys(input);
                const key = keys[0];
                if (key) {
                    flags = key;
                    params = {
                        method: name + '.' + key,
                        params: input[key],
                        id: options && options.mid
                    };
                }
            }
        }

        const handler = action && action.handler;
        if (!handler) {
            return { code: 404, error: 'action handler not found' };
        }

        const result = await handler(params, options) || { code: 0 };
        if (flags) {
            const ret = {};
            ret[flags] = result.result || { code: 0 };
            return ret;
        }

        return result;
    }

    /**
     * 
     * @param {string} name 
     * @param {*} [options] 
     * @returns 
     */
    async readProperty(name, options) {
        const property = this.properties[name];
        if (property) {
            const handler = property.readHandler;
            if (handler) {
                property.value = await handler(options);
            }
            return property.value;
        }
    }

    /**
     * 
     * @param {string} name 
     * @param {*} handler 
     * @returns 
     */
    setActionHandler(name, handler) {
        const action = this.actions[name];
        if (action) {
            action.handler = handler;
        }
        return this;
    }

    /**
     * 
     * @param {string} name 
     * @param {*} handler 
     * @returns 
     */
    setEventHandler(name, handler) {
        const event = this.events[name];
        if (event) {
            event.handler = handler;
        }
        return this;
    }

    /**
     * 
     * @param {string} name 
     * @param {*} handler 
     * @returns 
     */
    setPropertyReadHandler(name, handler) {
        const property = this.properties[name];
        if (property) {
            property.readHandler = handler;
        }
        return this;
    }

    /**
     * 
     * @param {string} name 
     * @param {*} handler 
     * @returns 
     */
    setPropertyWriteHandler(name, handler) {
        const property = this.properties[name];
        if (property) {
            property.writeHandler = handler;
        }
        return this;
    }

    /**
     * 
     * @param {string} name 
     * @param {*} handler 
     * @returns 
     */
    setServiceHandler(name, handler) {
        const service = this.services[name];
        if (service) {
            service.handler = handler;
        }
        return this;
    }

    /**
     * 
     * @param {string} name 
     * @param {any} value 
     * @param {Object<string,any>=} options 
     * @returns 
     */
    async writeProperty(name, value, options) {
        const property = this.properties[name];
        if (property == null) {
            throw new Error(`wot: no property found for "${name}"`);

        } else if (value == null) {
            return;

        } else if (property.value === value) {
            if (options?.checkChange) {
                return;
            }
        }

        property.value = value;

        if (options?.skipHandler) {
            return;
        }

        const writeHandler = property.writeHandler;
        if (writeHandler) {
            await writeHandler(value, options);
        }

        this._handleNotification(name, value);
    }

    /**
     * 
     * @param {WotMessage} message 
     * @param {*} [options] 
     * @returns 
     */
    async _sendMessage(message, options) {
        const transport = this.getTransport();
        if (!transport) {
            // console.warn('wot: transport is null');
            return;
        }

        if (!options) {
            options = {};
        }

        if (!options.baseTopic) {
            options.baseTopic = `$wot/devices/${this.id}/`;
        }

        // console.log(TAG, message, options);

        await transport.sendMessage(message, options);

        const event = new MessageEvent('send', { data: message });
        this.dispatchEvent(event);
    }

    /**
     * 
     * @param {*} message 
     * @param {*} topic 
     */
    async _handleActionMessage(message, topic) {
        const values = {};
        const data = message.data || {};

        const methodClount = Object.getOwnPropertyNames(data).length;
        if (methodClount <= 0) {
            values.code = 400;
            values.error = 'bad reqeust';

        } else {
            for (const name in data) {
                const params = data[name];
                values[name] = await this.invokeAction(name, params, { mid: message.mid });
            }
        }

        const response = {
            did: this.id,
            mid: message.mid,
            type: 'result',
            data: values
        };

        // console.log('response', message, response)

        const options = {};
        if (topic.startsWith('actions/')) {
            options.topic = 'messages/' + this.id;
        }

        await this._sendMessage(response, options);
    }

    /**
     * 
     * @param {string} topic 
     * @param {*} message 
     * @returns 
     */
    async _handleMessage(topic, message) {
        if (!message) {
            return;
        }

        const type = message.type;
        const data = message.data || message.result;
        if (!data) {
            return;
        }

        if (type == 'action' || type == 'requestAction') {
            await this._handleActionMessage(message, topic);

        } else if (type == 'setProperty') {
            await this.writeMultipleProperties(data);

        } else if (type == 'getProperty') {
            const values = await this.readMultipleProperties(data);
            const message = { did: this.id, type: 'property', data: values };
            await this._sendMessage(message);

        } else {
            console.log('wot: _handleMessage', topic, message);
        }
    }

    /**
     * 处理要通知改变的属性值 
     * @param {string} name 属性名
     * @param {*} value 属性值
     * @returns 
     */
    async _handleNotification(name, value) {
        this._notify_values[name] = value;

        if (this._notify_timer) {
            return;
        }

        this._notify_timer = setTimeout(() => {
            this._notify_timer = null;

            const values = this._notify_values;
            this._notify_values = new Map();

            // console.log(TAG, 'Property notification:', values);
            const message = { did: this.id, type: 'property', data: values };
            this._sendMessage(message);
        }, 0);
    }
}

defineEventAttribute(ExposedThing.prototype, 'register');
defineEventAttribute(ExposedThing.prototype, 'connect');

// ////////////////////////////////////////////////////////////
// Web of Things transport

/**
 * @typedef WotMessage
 * @property {string=} did
 * @property {string=} type
 * @property {any=} data
 * 
 */

/**
 * 代表传输层
 */
export class WotTransport {
    constructor() {
        this.isConnected = false;

    }

    /**
     * 创建连接
     * @param {*} options
     * @param {Servient} servient
     * @returns {Promise<this>}
     */
    async connect(options, servient) {
        // console.log('wot: start', options);
        return this;
    }

    /**
     * 销毁
     */
    async destroy() {
        // console.log('wot: destroy');
    }

    /**
     * 重连
     */
    async reconnect() {

    }

    /**
     * 注册
     * @param {string} did 
     * @param {*} description 
     */
    async register(did, description) {
        // console.log('wot: register', did, description);
        return this;
    }

    /**
     * 发送消息
     * @param {WotMessage} data 
     * @param {*} [options] 
     * @returns {Promise<any>}
     */
    async sendMessage(data, options) {
        // console.log('wot: sendMessage', data, options);
        return undefined;
    }

    /**
     * 订阅主题
     * @param {string} did 
     * @param {*} [options] 
     */
    async subscribe(did, options) {
        // console.log('wot: subscribe', did);
        return this;
    }

    /**
    * 取消订阅主题
    * @param {string} did 
    * @param {*} [options] 
    */
    async unsubscribe(did, options) {
        // console.log('wot: unsubscribe', did);
        return this;
    }
}

// ////////////////////////////////////////////////////////////
// MQTT transport

/**
 * MQTT transport
 * forms:
 * - forms.jsonrpc: `mqtt`
 * - forms.url:
 * - forms.usernaame:
 * - forms.password:
 * - forms.clientId: 
 */
export class MqttTransport extends WotTransport {
    constructor() {
        super();

        /** @type {mqtt.MQTTClient|undefined} */
        this.mqttClient = undefined;
        this.isConnected = false;
        this.isOpen = false;
        this.clientTopics = {};
    }

    /**
     * 创建连接
     * @param {mqtt.MQTTClientOptions} options
     * @param {Servient} servient
     * @returns {Promise<this>}
     */
    async connect(options, servient) {
        const self = this;

        let client = this.mqttClient;
        if (client) {
            return this;
        }

        client = await mqtt.connect(options);
        if (!client) {
            return this;
        }

        this.clientTopics = {};

        const textDecoder = new TextDecoder();

        client.onmessage = function onMessage(event) {
            const message = event.data;
            const payload = textDecoder.decode(message.payload);

            // console.log('onmessage', data.topic, payload)
            try {
                self.handleMessage(message.topic, JSON.parse(payload));

            } catch (err) {
                console.log('wot: onmessage', err);
            }
        };

        client.onconnect = async function onConnect() {
            self.isConnected = true;
        };

        client.onopen = async function onConnect() {
            self.isOpen = true;
            servient?.dispatchEvent(new Event('online'));
        };

        client.onoffline = function onDisconnect() {
            if (self.isConnected) {
                servient?.dispatchEvent(new Event('offline'));
            }

            self.isConnected = false;
        };

        this.mqttClient = client;
        return this;
    }

    async destroy() {
        const mqttClient = this.mqttClient;
        if (mqttClient) {
            this.mqttClient = undefined;

            mqttClient.close();
        }
    }

    /**
     * 
     * @param {*} message 
     * @param {*} options 
     * @returns 
     */
    getTopic(message, options) {
        if (options.topic) {
            return options.topic;
        }

        let baseTopic = options.baseTopic || '';
        if (baseTopic && !baseTopic.endsWith('/')) {
            baseTopic += '/';
        }

        let topic = null;
        if (message.type == 'stream' || message.type == 'property') {
            topic = baseTopic + 'messages/properties';

        } else if (message.type == 'event') {
            topic = baseTopic + 'messages/events';

        } else if (message.type == 'result') {
            topic = baseTopic + 'messages/actions';
        }

        if (!topic) {
            topic = baseTopic + 'messages';
        }

        return topic;
    }

    /**
     * 处理 MQTT 消息
     * @param {string} topic 
     * @param {{[key:string]: any}} message 
     * @returns 
     */
    async handleMessage(topic, message) {
        if (!topic) {
            return;
        }

        let did = message.did;
        if (!did) {
            const tokens = topic.split('/');
            did = tokens[2];
        }

        // console.log('topic', topic, did)
        const exposedThing = $servient?.getThing(did);
        if (exposedThing) {
            exposedThing._handleMessage(topic, message);

        } else {
            console.log('wot: handleMessage:', topic, message);
        }
    }

    /**
     * 
     * @param {ServientOptions} forms 
     * @returns {mqtt.MQTTClientOptions}
     */
    parseOptions(forms) {
        const url = forms.url || forms.href;
        if (!url) {
            throw new Error('Invalid thing description format: forms.url is empty');
        }

        const uri = new URL(url);
        const host = uri.host;
        const port = Number.parseInt(uri.port) || 1883;

        const options = { host, port };
        options.username = forms.username;
        options.password = forms.password;
        options.clientId = forms.clientId;

        // console.log('options', options);
        return options;
    }

    /**
     * 发送消息
     * @param {WotMessage} message 
     * @param {*} [options] 
     * @returns 
     */
    async sendMessage(message, options) {
        const mqttClient = this.mqttClient;
        if (!mqttClient) {
            return;
        }

        const topic = this.getTopic(message, options);
        const data = JSON.stringify(message);

        // console.log(TAG, 'Publish:', topic, data);
        try {
            await mqttClient.publish(topic, data);

        } catch (e) {
            console.log(TAG, 'Publish:', topic, e);
        }
    }

    /**
     * @typedef {{ baseTopic?: string, subscription?: string }} SubscribeOptions
     */

    /**
     * 订阅主题
     * @param {string} did 
     * @param {SubscribeOptions} options 
     */
    async subscribe(did, options) {
        if (!did) {
            console.warn(TAG, 'mqtt subscribe: Invalid DID.');
            return this;
        }

        // 主题
        if (!options.baseTopic) {
            options.baseTopic = `$wot/devices/${did}/`;
        }

        // 订阅主题
        const topics = [];
        if (options?.subscription) {
            topics.push(options?.subscription);

        } else {
            topics.push(options.baseTopic + 'actions');
        }

        const client = this.mqttClient;
        if (!client) {
            return this;
        }

        const clientTopics = this.clientTopics;
        for (let i = 0; i < topics.length; i++) {
            const topic = topics[i];
            if (clientTopics && !clientTopics[topic]) {
                clientTopics[topic] = 1;

                console.warn(TAG, 'Subscribe', topic);
                try {
                    await client.subscribe(topic);
                } catch (e) {
                    console.warn(TAG, 'Subscribe ', topic, e);
                }
            }
        }

        return this;
    }

    /**
     * 取消订阅主题
     * @param {string} did 
     * @param {*} options 
     */
    async unsubscribe(did, options) {
        // 主题
        if (!options.baseTopic) {
            options.baseTopic = `$wot/devices/${did}/`;
        }

        const topics = [options.baseTopic + 'actions', 'actions/' + did];

        const client = this.mqttClient;
        if (!client) {
            return this;
        }

        const clientTopics = this.clientTopics;
        for (let i = 0; i < topics.length; i++) {
            const topic = topics[i];
            if (clientTopics) {
                delete clientTopics[topic];
            }

            client.unsubscribe(topic);
        }

        return this;
    }

}

// ////////////////////////////////////////////////////////////
// JSON-RPC transport

/**
 * JSON-RPC transport
 * forms:
 * - forms.jsonrpc: `jsonrpc`
 * - forms.url: `tcp://x.x.x.x:p`
 */
export class JsonrpcTransport extends WotTransport {
    constructor() {
        super();

        /** @type {jsonrpc.JsonrpcClient|undefined} */
        this.jsonrpcClient = undefined;
        this.isConnected = false;
        this.isOpen = false;
        this.clientTopics = {};
    }

    /**
     * 创建连接
     * @param {*} options
     * @param {Servient} servient
     * @returns {Promise<this>}
     */
    async connect(options, servient) {
        // console.log('wot: start', options);
        if (this.jsonrpcClient) {
            return this;
        }

        const url = options.url;
        const client = jsonrpc.connect(url);
        this.jsonrpcClient = client;

        client.expose('thing.events', function (...params) {
            console.log('@notify', 'thing.events', params);
        });

        client.expose('thing.properties', async function (message) {
            console.log('@notify', 'thing.properties', message);
        });

        client.expose('thing.actions', function (...params) {
            console.log('@notify', 'thing.actions', params);
        });

        client.addEventListener('open', (event) => {
            console.log('wot: JSON-RPC client opened');

            this.isConnected = true;
            this.isOpen = true;
            servient?.dispatchEvent(new Event('online'));
        });

        client.addEventListener('close', (event) => {
            console.log('wot: JSON-RPC client closed');

            this.isConnected = false;
            this.isOpen = false;
            servient?.dispatchEvent(new Event('offline'));
        });

        client.addEventListener('statechange', (event) => {
            // console.log('wot: statechange', client.readyState);
        });

        return this;
    }

    /**
     * 关闭连接
     */
    async destroy() {
        const client = this.jsonrpcClient;
        if (client) {
            this.jsonrpcClient = undefined;

            await client.close();
        }
    }

    /**
     * 重连
     */
    async reconnect() {
        const client = this.jsonrpcClient;
        if (client) {
            await client.reconnect();
        }
    }

    /**
     * register
     * @param {string} did 
     * @param {*} description 
     * @returns 
     */
    async register(did, description) {
        // console.log('wot: register', description);
        // const message = { did, type: 'register', data: description };
        // console.log('register:', did, message);

        // await this.sendMessage(message);
        // console.log('register:', did, result);
        return this;
    }

    /**
     * 发送消息
     * @param {WotMessage} message 
     * @param {*} [options] 
     */
    async sendMessage(message, options) {
        /**
         * 
         * @param {jsonrpc.JsonrpcClient} client 
         * @param {string} name 
         * @param  {...any} params 
         * @returns 
         */
        async function call(client, name, ...params) {
            const func = client.method(name);
            const result = await func(...params);
            if (result?.error) {
                console.warn(name + ':', result.error);
                return result;
            }

            // console.log(name + ':', result);
            return result;
        }

        const type = message?.type;
        const client = this.jsonrpcClient;
        if (!client) {
            return;
        }

        if (type == 'property') {
            return await call(client, 'shadow.update', message.did, message.data);

        } else if (type == 'register') {
            // return await call(client, 'shadow.add', message.did, {}, message.data);

        } else {
            console.warn('unsupported method:', type);
        }
    }
}

// ////////////////////////////////////////////////////////////
// Servient 

export class Servient extends EventTarget {
    /** @param {*} [options] */
    constructor(options) {
        super();

        /** @type {any} */
        this.options = options;

        /** @type {{[key:string]: ExposedThing}} */
        this.exposedThings = {};

        /** @type {WotTransport|undefined} */
        this.wotTransport = undefined;

        /** @type {string|undefined} */
        this.protocol = undefined;
    }

    get [Symbol.toStringTag]() {
        return 'Servient';
    }

    /**
     * 添加指定的事物
     * @param {ExposedThing} thing 
     */
    async addThing(thing) {
        const id = thing.id;
        if (id) {
            this.exposedThings[id] = thing;
        }
    }

    /**
     * 销毁并释放相关的资源
     */
    async destroy() {
        const wotTransport = this.wotTransport;
        if (wotTransport) {
            wotTransport.destroy();
            this.wotTransport = undefined;
        }
    }

    /**
     * 销毁指定 ID 的事物
     * @param {string=} thingId 
     * @returns {Promise<boolean>}
     */
    async destroyThing(thingId) {
        if (!thingId) {
            return false;
        }

        const exposedThings = this.exposedThings;
        const exposedThing = exposedThings[thingId];
        if (!exposedThing) {
            return false;
        }

        delete exposedThings[thingId];
        return true;
    }

    /**
     * 返回指定的 ID 的事物
     * @param {string} id 
     * @returns {ExposedThing}
     */
    getThing(id) {
        return this.exposedThings[id];
    }

    /**
     * 返回所有事物
     * @returns {{[key:string]: ExposedThing}}
     */
    getThings() {
        return this.exposedThings;
    }

    getTransport() {
        const transport = this.wotTransport;
        return {
            /**
             * @param {WotMessage} data 
             * @param {*} [options] 
             */
            async sendMessage(data, options) {
                return await transport?.sendMessage(data, options);
            },

            /**
             * @param {string} did 
             * @param {*} [options] 
             */
            async register(did, options) {
                return await transport?.register(did, options);
            },

            /**
             * @param {string} did 
             * @param {*} [options] 
             */
            async subscribe(did, options) {
                return await transport?.subscribe(did, options);
            },

            /**
             * @param {string} did 
             * @param {*} [options] 
             */
            async unsubscribe(did, options) {
                return await transport?.unsubscribe(did, options);
            }
        };
    }

    isConnected() {
        return this.wotTransport?.isConnected || false;
    }

    /**
     * 开始
     * @param {ServientOptions} forms 
     * @returns 
     */
    async start(forms) {
        if (forms.protocol == 'jsonrpc') {
            const transport = new JsonrpcTransport();
            this.wotTransport = transport;

            await transport.connect(forms, this);

        } else {
            this.protocol = 'mqtt';
            const transport = new MqttTransport();
            const options = transport.parseOptions(forms);
            this.wotTransport = transport;

            await transport.connect(options, this);
        }

        return this;
    }

    async reconnect() {
        const transport = this.wotTransport;
        return transport?.reconnect();
    }
}

const $servient = new Servient();

export const STATE_UNREGISTER = 0;
export const STATE_REGISTER = 1;

/**
 * 消费
 * @param {string|{[key:string]:any}} td 
 * @returns {Promise<ConsumedThing>}
 */
export async function consume(td) {
    const thing = new ConsumedThing(td);
    return thing;
}

/**
 * 创建
 * @param {string|{[key:string]:any}} td 
 * @returns {Promise<ExposedThing>}
 */
export async function produce(td) {
    if (!td) {
        throw new Error('Invalid thing description format');
    }

    let description = null;
    if (typeof td == 'string') {
        description = JSON.parse(td);
    } else {
        description = td;
    }

    let forms = description.forms;
    if (Array.isArray(forms)) {
        forms = forms[0];
    }

    if (typeof forms != 'object') {
        forms = {};
    }

    const thing = new ExposedThing(description);
    thing.forms = forms;

    if (forms.did) {
        thing._id = forms.did;
    }

    return thing;
}

/**
 * 发现
 * @param {string} filter 
 * @returns 
 */
export async function discover(filter) {

}

/**
 * servient
 * @param {string} name 
 * @returns {Servient}
 */
export function servient(name) {
    return $servient;
}
