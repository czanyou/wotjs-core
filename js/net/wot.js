// @ts-check
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

        this._propertiesTopic = null;
        this._eventsTopic = null;
        this._resultTopic = null;
        this._messagesTopic = null;

        /** @type {MqttTransport} */
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
            console.log('_handleMessage', topic, message);
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

        /** @type {Servient} */
        this.servient = null;

        this.clientTopics = {};
    }

    /**
     * @param {string[]} topics 
     */
    async onSubscribe(topics) {
        let client = this.mqttClient;
        if (client) {
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
     * @param {mqtt.MQTTClientOptions} options
     * @param {Servient} servient
     * @returns {Promise<mqtt.MQTTClient>}
     */
    async createConnection(options, servient) {
        const self = this;

        let client = this.mqttClient;
        if (client) {
            return client;
        }

        client = mqtt.connect(options);
        const textDecoder = new TextDecoder();

        this.clientTopics = {};

        client.onmessage = function onMessage(event) {
            const message = event.data;
            const payload = textDecoder.decode(message.payload);

            // console.log('onmessage', data.topic, payload)
            try {
                self.handleMessage(message.topic, JSON.parse(payload));
            } catch (err) {
                console.log('onmessage', err);
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
        return client;
    }

    /**
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

        const exposedThing = this.servient?.getThing(did);
        if (exposedThing) {
            exposedThing._handleMessage(topic, message);

        } else {
            console.log('handleMessage:', topic, message);
        }
    }

    async destroy() {
        const mqttClient = this.mqttClient;
        if (mqttClient) {
            mqttClient.close();
        }
    }

    async sendMessage(topic, data) {
        const mqttClient = this.mqttClient;
        if (mqttClient) {
            return await mqttClient.publish(topic, data);
        }
    }
}

export class Servient extends EventTarget {
    constructor(options) {
        super();

        this.options = options;
        this.servers = {};
        this.clients = {};

        /** @type {{[key:string]: ExposedThing}} */
        this.exposedThings = {};
        this.mqttTransport = new MqttTransport();
        this.mqttTransport.servient = this;

        /** @type {mqtt.MQTTClient} */
        this.mqttClient = null;
    }

    get [Symbol.toStringTag]() {
        return 'Servient';
    }

    async connect(forms) {
        const options = this._getMqttOptions(forms);
        this.mqttClient = await this.mqttTransport.createConnection(options, this);
        return this.mqttClient;
    }

    isMqttConnected() {
        return this.mqttTransport.isConnected;
    }

    /**
     * 
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
     * 
     * @param {ExposedThing} thing 
     */
    expose(thing) {

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

    /**
     * @param {string} id 
     * @returns {ExposedThing}
     */
    getThing(id) {
        return this.exposedThings[id];
    }

    /**
     * @returns {{[key:string]: ExposedThing}}
     */
    getThings() {
        return this.exposedThings;
    }

    /**
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

        // @ts-ignore
        const topics = exposedThing._actionsTopics;
        if (!topics) {
            return;
        }

        const clientTopics = mqttTransport.clientTopics;
        for (let i = 0; i < topics.length; i++) {
            const topic = topics[i];
            if (clientTopics) {
                delete clientTopics[topic];
            }

            this.mqttClient.unsubscribe(topic);
        }

        return true;
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

        this._actionsTopics = null; // 要订阅的下行主题列表
        this._messagesTopic = null; // 默认上行主题

        this._exposeTimer = null;

        /** @type {Servient} */
        this.servient = $servient;
    }

    get [Symbol.toStringTag]() {
        return 'MQTTExposedThing';
    }

    async destroy() {
        this._transport = null;
        this.servient?.destroyThing(this.did);

        if (this._exposeTimer) {
            clearInterval(this._exposeTimer);
            this._exposeTimer = null;
        }

        this.servient = null;
    }

    async expose() {
        if (this._exposeTimer) {
            return;
        }

        // console.log('options', options.host, options.port, options.pathname);
        this._transport = this.servient?.mqttTransport;
        this.did = this.forms.did;

        // 订阅主题
        const topics = [];
        topics.push('actions/' + this.did);
        topics.push('$wot/devices/' + this.did + '/actions');

        this._actionsTopics = topics;
        this._transport?.onSubscribe(topics);

        // 上传主题
        const baseTopic = '$wot/devices/' + this.did + '/messages';
        this._messagesTopic = baseTopic;
        this._resultTopic = baseTopic + '/result';
        this._eventsTopic = baseTopic + '/events';
        this._propertiesTopic = baseTopic + '/properties';

        this.servient?.addThing(this);
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

    async _sendMessage(message) {
        let topic = null;
        if (message.type == 'stream' || message.type == 'property') {
            topic = this._propertiesTopic;

        } else if (message.type == 'event') {
            topic = this._eventsTopic;

        } else if (message.type == 'result') {
            topic = this._resultTopic;
        }

        if (!topic) {
            topic = this._messagesTopic;
        }

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
