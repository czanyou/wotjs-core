// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as mqtt from '@tjs/mqtt';
import * as util from '@tjs/util';

import { defineEventAttribute, EventTarget } from '@tjs/event-target';

/* global MessageEvent */

// ////////////////////////////////////////////////////////////
// ConsumedThing

export class ConsumedThing extends EventTarget {
    /**
     * 
     * @param {object} td 
     */
    constructor(td) {
        super();

        if (typeof td == 'string') {
            td = JSON.parse(td);
        }

        if (typeof td != 'object') {
            throw new Error('Invalid thing description');
        }

        this.actions = {};
        this.events = {};
        this.properties = {};
        this.services = {};
        this.metadata = {};

        this.thingDescription = td;
        this.did = null;

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

    getThingDescription() {
        return this.thingDescription;
    }

    async readProperty(name, options) {
        const property = this.properties[name];
        return property && property.value;
    }

    async readAllProperties(options) {
        const names = Object.keys(this.properties);
        return this.readMultipleProperties(names, options);
    }

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

    async writeProperty(name, value, options) {
        const property = this.properties[name];
        if (property) {
            property.value = value;
        }
    }

    async writeMultipleProperties(valueMap, options) {
        options = options || {};
        options.mode = 'multiple';

        for (const name in valueMap) {
            const value = valueMap[name];
            await this.writeProperty(name, value, options);
        }
    }

    async invokeAction(name, params, options) {

    }
}

// ////////////////////////////////////////////////////////////
// ExposedThing

export class ExposedThing extends ConsumedThing {
    constructor(td) {
        super(td);

        this.baseTopic = null;
        this._transport = null;
    }

    get [Symbol.toStringTag]() {
        return 'ExposedThing';
    }

    async expose() {

    }

    async destroy() {

    }

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
            did: this.did,
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
                const message = { did: this.did, type: 'property', data: values };

                this.dispatchEvent(new MessageEvent('property', { data: values }));
                this._sendMessage(message);
            }, 0);

        } else if (Array.isArray(name)) {
            this._emitTimer = setTimeout(async () => {
                this._emitTimer = null;

                const values = await this.readMultipleProperties(name);
                const message = { did: this.did, type: 'property', data: values };
                this._sendMessage(message);
            }, 0);

        } else {
            const property = this.properties[name];
            if (!property) {
                return;
            }

            this._emitTimer = setTimeout(async () => {
                this._emitTimer = null;

                const value = await this.readProperty(name);
                const message = { did: this.did, type: 'property', data: {} };
                message.data[name] = value;
                this._sendMessage(message);
            }, 0);
        }
    }

    getTransport() {
        return this._transport;
    }

    async invokeAction(name, params, options) {
        let action = this.actions[name];
        if (!action) {
            action = this.services[name];
        }

        const handler = action && action.handler;
        if (!handler) {
            return { code: 404, error: 'action handler not found' };
        }

        const result = await handler(params, options);
        return result || { code: 0 };
    }

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

    setActionHandler(name, handler) {
        const action = this.actions[name];
        if (action) {
            action.handler = handler;
        }
        return this;
    }

    setEventHandler(name, handler) {
        const event = this.events[name];
        if (event) {
            event.handler = handler;
        }
        return this;
    }

    setPropertyReadHandler(name, handler) {
        const property = this.properties[name];
        if (property) {
            property.readHandler = handler;
        }
        return this;
    }

    setPropertyWriteHandler(name, handler) {
        const property = this.properties[name];
        if (property) {
            property.writeHandler = handler;
        }
        return this;
    }

    setServiceHandler(name, handler) {
        const service = this.services[name];
        if (service) {
            service.handler = handler;
        }
        return this;
    }

    async writeProperty(name, value, options) {
        const property = this.properties[name];
        if (!property) {
            return;
        }

        property.value = value;
        if (options && options.skipHandler) {
            return;
        }

        const handler = property.writeHandler;
        if (handler) {
            await handler(value, options);
        }
    }

    async _sendMessage(message) {
        // TODO: 
    }

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
                values[name] = await this.invokeAction(name, params);
            }
        }

        const response = {
            did: this.did,
            mid: message.mid,
            type: 'result',
            data: values
        };

        await this._sendMessage(response);
    }

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
            const message = { did: this.did, type: 'property', data: values };
            await this._sendMessage(message);

        } else {
            console.log('wot: _handleMessage', topic, message);
        }
    }
}

// ////////////////////////////////////////////////////////////
// MQTT transport

export class MqttTransport {
    constructor() {
        /** @type {mqtt.MQTTClient} */
        this.mqttClient = null;
        this.isConnected = false;
        this.isOpen = false;
        this.clientTopics = {};
    }

    /**
     * 创建 MQTT 连接
     * @param {mqtt.MQTTClientOptions} options
     * @param {Servient} servient
     * @returns {Promise<this>}
     */
    async start(options, servient) {
        const self = this;

        let client = this.mqttClient;
        if (client) {
            return this;
        }

        client = mqtt.connect(options);
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
            this.mqttClient = null;

            mqttClient.close();
        }
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

        const exposedThing = $servient?.getThing(did);
        if (exposedThing) {
            exposedThing._handleMessage(topic, message);

        } else {
            console.log('wot: handleMessage:', topic, message);
        }
    }

    /**
     * 发送消息
     * @param {string} topic 
     * @param {*} data 
     * @returns 
     */
    async sendMessage(topic, data) {
        const mqttClient = this.mqttClient;
        if (!mqttClient) {
            return;
        }

        // console.log('wot: send:', topic, data);
        return await mqttClient.publish(topic, data);
    }

    /**
     * 订阅主题
     * @param {string[]} topics 
     */
    async subscribe(topics) {
        const client = this.mqttClient;
        if (!client) {
            return client;
        }

        const clientTopics = this.clientTopics;
        for (let i = 0; i < topics.length; i++) {
            const topic = topics[i];
            if (clientTopics && !clientTopics[topic]) {
                clientTopics[topic] = 1;
                await client.subscribe(topic);
            }
        }
    }

    /**
     * 取消订阅主题
     * @param {string[]} topics 
     */
    async unsubscribe(topics) {
        const client = this.mqttClient;
        if (!client) {
            return client;
        }

        const clientTopics = this.clientTopics;
        for (let i = 0; i < topics.length; i++) {
            const topic = topics[i];
            if (clientTopics) {
                delete clientTopics[topic];
            }

            client.unsubscribe(topic);
        }
    }

    _getMqttOptions(forms) {
        const baseUrl = forms && forms.href;
        if (!baseUrl) {
            throw new Error('Invalid thing description format: forms.href is empty');
        }

        const uri = new URL(baseUrl);
        const host = uri.host;
        const port = Number.parseInt(uri.port) || 1883;

        const options = { host, port };

        if (forms) {
            options.username = forms.username;
            options.password = forms.password;
            options.clientId = forms.clientId;
        }

        // console.log('options', options);
        return options;
    }
}

export class Servient extends EventTarget {
    constructor(options) {
        super();

        this.options = options;

        /** @type {{[key:string]: ExposedThing}} */
        this.exposedThings = {};

        this.mqttTransport = new MqttTransport();
    }

    get [Symbol.toStringTag]() {
        return 'Servient';
    }

    /**
     * 添加指定的事物
     * @param {ExposedThing} thing 
     */
    addThing(thing) {
        const did = thing.did;
        this.exposedThings[did] = thing;
    }

    async destroy() {
        this.mqttTransport?.destroy();
    }

    /**
     * 销毁指定 ID 的事物
     * @param {string} thingId 
     * @returns {Promise<boolean>}
     */
    async destroyThing(thingId) {
        const exposedThings = this.exposedThings;
        const exposedThing = exposedThings[thingId];
        if (!exposedThing) {
            return;
        }

        delete exposedThings[thingId];

        const mqttTransport = this.mqttTransport;
        if (!mqttTransport) {
            return;
        }

        if (!exposedThing.baseTopic) {
            return;
        }

        const topics = [exposedThing.baseTopic + 'actions'];
        mqttTransport?.unsubscribe(topics);
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
        const transport = this.mqttTransport;
        return {
            /**
             * @param {string} topic 
             * @param {*} data 
             */
            async sendMessage(topic, data) {
                return await transport.sendMessage(topic, data);
            },
            /**
             * @param {string[]} topics 
             */
            async subscribe(topics) {
                return await transport.subscribe(topics);
            }
        };
    }

    isConnected() {
        return this.mqttTransport.isConnected;
    }

    async start(forms) {
        const transport = this.mqttTransport;
        const options = transport._getMqttOptions(forms);
        await transport.start(options, this);
        return this;
    }
}

const $servient = new Servient();

export const STATE_UNREGISTER = 0;
export const STATE_REGISTER = 1;

class MQTTExposedThing extends ExposedThing {
    constructor(td, forms) {
        super(td);

        this.did = null; // 设备 ID
        this.forms = forms; // 协议绑定参数
        this.things = null; // 表示是否是网关
        this._exposeTimer = null;
        this._transport = null;

        this.baseTopic = forms && forms.topic;
    }

    get [Symbol.toStringTag]() {
        return 'MQTTExposedThing';
    }

    async destroy() {
        this._transport = null;
        $servient?.destroyThing(this.did);

        if (this._exposeTimer) {
            clearInterval(this._exposeTimer);
            this._exposeTimer = null;
        }
    }

    async expose() {
        if (this._exposeTimer) {
            return;
        }

        // console.log('options', options.host, options.port, options.pathname);
        this._transport = $servient?.getTransport();
        this.did = this.forms.did;

        // 主题
        if (!this.baseTopic) {
            this.baseTopic = '$wot/devices/' + this.did + '/';
        }

        // 订阅主题
        const topics = [this.baseTopic + 'actions'];
        this._transport?.subscribe(topics);

        $servient?.addThing(this);
    }

    /**
     * 
     * @param {string} name 
     * @param {ExposedThing} thing 
     * @returns {ExposedThing} this
     */
    setThing(name, thing) {
        if (!name || !thing) {
            return this;
        }

        if (!this.things) {
            this.things = {};
        }

        this.things[name] = thing;

        return this;
    }

    getSignData(message) {
        const textEncoder = new TextEncoder();
        const raw = `${message.did}:${this.forms.secret}`;
        const hash = util.hash(textEncoder.encode(raw), 'md5') + ':md5';
        return hash;
    }

    /**
     * @param {*} message 
     */
    async _sendMessage(message) {
        let topic = null;
        if (message.type == 'stream' || message.type == 'property') {
            topic = this.baseTopic + 'messages/properties';

        } else if (message.type == 'event') {
            topic = this.baseTopic + 'messages/events';

        } else if (message.type == 'result') {
            topic = this.baseTopic + 'messages/actions';
        }

        if (!topic) {
            topic = this.baseTopic + 'messages';
        }

        // console.log('wot: send message:', topic, message);

        const mqttTransport = this.getTransport();
        if (mqttTransport) {
            const data = JSON.stringify(message);
            await mqttTransport.sendMessage(topic, data);

            const event = new MessageEvent('send', { data });
            // @ts-ignore
            event.topic = topic;
            this.dispatchEvent(event);
        }
    }
}

defineEventAttribute(MQTTExposedThing.prototype, 'register');
defineEventAttribute(MQTTExposedThing.prototype, 'connect');

/**
 * 
 * @param {string|object} td 
 * @returns {Promise<ConsumedThing>}
 */
export async function consume(td) {
    const thing = new ConsumedThing(td);
    return thing;
}

/**
 * 
 * @param {string|object} td 
 * @returns {Promise<ExposedThing>}
 */
export async function produce(td) {
    if (!td) {
        throw new Error('Invalid thing description format');
    }

    let forms = td.forms;
    if (Array.isArray(forms)) {
        forms = forms[0];
    }

    if (typeof forms != 'object') {
        forms = {};
    }

    const thing = new MQTTExposedThing(td, forms);
    return thing;
}

export async function discover(filter) {

}

export function servient() {
    return $servient;
}
