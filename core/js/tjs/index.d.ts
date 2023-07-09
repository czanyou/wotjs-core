
/**
 * 代表一个 MQTT 消息
 */
interface MQTTPacket {
	/** 消息类型 */
	type?: number;

	/** 消息长度 */
	length?: number;

	/** 消息 ID */
	packetId?: number; // PUBLISH, SUBACK, UNSUBACK, PUBACK

	count?: number; // SUBACK

	dup?: number; // PUBLISH, PUBACK
	payload?: ArrayBuffer; // PUBLISH
	qos?: number; // PUBLISH, SUBACK
	retained?: number; // PUBLISH
	topic?: string; // PUBLISH

	returnCode?: number; // CONNACK
	sessionPresent?: number; // CONNACK
}

/**
 * 代表一个 MQTT 请求消息
 */
interface MQTTRequest {
	type?: number;
	topic?: string;
	payload?: string | ArrayBuffer;
	qos?: number;
	retained?: number;
	dup?: number;
	pid?: number;
}
