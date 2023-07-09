export type DataSchemaValue = null | boolean | number | string | DataSchemaValue[] | { [name: string]: DataSchemaValue };

export type ThingDiscovery = any;

/**
 * Dictionary that represents the constraints for discovering Things as key-value pairs. 
 */
export interface ThingFilter {
	/**
	 * The method field represents the discovery type that should be used in the discovery process. The possible values are defined by the DiscoveryMethod enumeration that can be extended by string values defined by solutions (with no guarantee of interoperability). 
	 */
	method?: DiscoveryMethod | string; // default value "any", DOMString
	/**
	 * The url field represents additional information for the discovery method, such as the URL of the target entity serving the discovery request, such as a Thing Directory or a Thing.
	 */
	url?: string;
	/**
	 * The query field represents a query string accepted by the implementation, for instance a SPARQL query. 
	 */
	query?: string;
	/**
	 * The fragment field represents a template object used for matching against discovered Things.
	 */
	fragment?: object;
}

/** The DiscoveryMethod enumeration represents the discovery type to be used */
export enum DiscoveryMethod {
	/** does not restrict */
	"any",
	/** for discovering Things defined in the same Servient */
	"local",
	/** for discovery based on a service provided by a Thing Directory */
	"directory",
	/** for discovering Things in the same/reachable network by using a supported multicast protocol */
	"multicast"
}

export interface InteractionOptions {
	formIndex?: number;
	uriVariables?: object;
	skipHandler?: boolean;
}

/**
 * WoT provides a unified representation for data exchange between Things, standardized in the Wot Things Description specification.
 * In this version of the API, Thing Descriptions is expected to be a parsed JSON object.
 */
export type ThingDescription = { [key: string]: any; };


export type PropertyValueMap = { [key: string]: DataSchemaValue; };

export interface InteractionData {
	data?: DataView;
	mediaType?: string;
	encoding?: string;
	lang?: string;
	dataSchema?: DataSchema;
}

export type DataSchema = { [key: string]: any; };

/** 操作处理函数 */
export type ActionHandler = (params: DataSchemaValue, options?: InteractionOptions) => Promise<DataSchemaValue>;

/** 事件处理函数 */
export type EventListenerHandler = () => Promise<DataSchemaValue>;

/** 事件订阅处理函数 */
export type EventSubscriptionHandler = (options?: InteractionOptions) => Promise<void>;

/** 属性处理函数 */
export type PropertyReadHandler = (options?: InteractionOptions) => Promise<DataSchemaValue>;

/** 属性处理函数 */
export type PropertyWriteHandler = (value: DataSchemaValue, options?: InteractionOptions) => Promise<void>;

/** 错误回调函数 */
export type ErrorListener = (error: Error) => void;

/** 交互回调函数 */
export type InteractionListener = (data: DataSchemaValue) => void;

export interface Subscription {
	active: boolean;

	/** 停止订阅 */
	stop(options?: InteractionOptions): Promise<void>;
}

/**
 * Consumed Web thing
 */
export interface ConsumedThing extends EventTarget {
	id: string;

	/** 操作列表 */
	actions: { [name: string]: object };

	/** 事件列表 */
	events: { [name: string]: object };

	/** 属性列表 */
	properties: { [name: string]: object };

	/** 元数据 */
	metadata: { [name: string]: any };

	/** 返回事物描述 */
	getThingDescription(): ThingDescription;

	/** 执行指定的名称操作 */
	invokeAction(name: string, params: DataSchemaValue, options?: InteractionOptions): Promise<DataSchemaValue>;

	/** 读取指定名称的属性值 */
	readProperty(name: string, options?: InteractionOptions): Promise<DataSchemaValue>;

	/** 读取所有的属性值 */
	readAllProperties(options?: InteractionOptions): Promise<PropertyValueMap>;

	/** 读取多个指定名称的属性值 */
	readMultipleProperties(names: string[], options?: InteractionOptions): Promise<PropertyValueMap>;

	/** 观察属性 */
	observeProperty(name: string, listner: InteractionListener, onerror?: ErrorListener, options?: InteractionOptions): Promise<Subscription>;

	/** 订阅事件 */
	subscribeEvent(name: string, listner: InteractionListener, onerror?: ErrorListener, options?: InteractionOptions): Promise<Subscription>;

	/** 修改指定名称的属性值 */
	writeProperty(name: string, value: DataSchemaValue, options?: InteractionOptions): Promise<void>;

	/** 修改多个指定名称的属性值 */
	writeMultipleProperties(valueMap: PropertyValueMap, options?: InteractionOptions): Promise<void>;
}

/**
 * Exposed Web thing
 */
export interface ExposedThing extends ConsumedThing {

	/** 暴露这个 Web thing, 用于被其他应用调用 */
	expose(): Promise<void>;

	/** 销毁这个 Web thing */
	destroy(): Promise<void>;

	/** 发布事件 */
	emitEvent(name: string, data: DataSchemaValue): Promise<void>;

	/** 发布属性状态改变 */
	emitPropertyChange(name: string | string[]): Promise<void>;

	/** 设置 Action 处理函数 */
	setActionHandler(name: string, handler: ActionHandler): Promise<void>;

	/** 设置 Event 事件处理函数 */
	setEventHandler(name: string, handler: EventListenerHandler): Promise<void>;
	setEventSubscribeHandler(name: string, handler: EventSubscriptionHandler): Promise<void>;
	setEventUnsubscribeHandler(name: string, handler: EventSubscriptionHandler): Promise<void>;

	/** 设置属性读取操作处理函数 */
	setPropertyReadHandler(name: string, handler: PropertyReadHandler): Promise<void>;

	/** 设置属性修改操作处理函数 */
	setPropertyWriteHandler(name: string, handler: PropertyWriteHandler): Promise<void>;
}

/** 使用指定的 Web Thing */
export function consume(td: ThingDescription): Promise<ConsumedThing>;

/** 创建一个 Web Thing */
export function produce(td: ThingDescription): Promise<ExposedThing>;

/** 发现 Web Things */
export function discover(filter?: ThingFilter): Promise<ThingDiscovery>;

/** 连接选择 */
export interface ServientOptions {
	/** 操作类型 */
	op?: string,

	/** 通信协议 */
	protocol?: string,

	/** 设备 ID */
	did?: string,

	/** 客户端 ID */
	clientId?: string,

	/** 访问地址 */
	url?: string,

	/** 访问用户名 */
	username?: string,

	/** 访问密码 */
	password?: string
}

/**
 * 
 */
export interface Transport {
	/**
	 * 
	 * @param message message
	 * - type
	 * - did
	 * - data
	 * @param options options
	 * - topic
	 * - baseTopic
	 */
	sendMessage(message: any, options: any): Promise<any>;

	/**
	 * 
	 * @param did 
	 * @param options 
	 */
	subscribe(did: string, options: any): Promise<any>;

	/**
	 * 
	 * @param did 
	 * @param options 
	 */
	register(did: string, options: any): Promise<any>;

	/**
	 * 
	 * @param did 
	 * @param options 
	 */
	unsubscribe(did: string, options: any): Promise<any>;
}

/**
 * 代表 WebThing 运行环境
 */
export class Servient extends EventTarget {
	/**
	 * 销毁这个客户端
	 */
	destroy(): Promise<this>;

	/**
	 * 添加一个新事物
	 * @param thing 
	 */
	addThing(thing: ExposedThing): boolean;

	/**
	 * 销毁指定的 ID 的事物
	 * @param id 
	 */
	destroyThing(id: string): Promise<boolean>;

	/**
	 * 返回指定名称的事物
	 * @param id 
	 */
	getThing(id: string): ExposedThing;

	/**
	 * 返回所有注册的事物
	 */
	getThings(): object;

	/**
	 * 
	 */
	getTransport(): Transport;

	/**
	 * 是否已连接
	 */
	isConnected(): boolean;

	/**
	 * 重连
	 */
	reconnect(): Promise<void>;

	/**
	 * 开始连接
	 * @param options 
	 */
	start(options: ServientOptions): Promise<this>;
}

export function servient(): Servient;