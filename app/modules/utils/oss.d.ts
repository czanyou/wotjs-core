
type OSSRequestInit = { method?: string, bucket?: string, object?: string, body?: string | ArrayBuffer, type?: string, format?: string, callback?: string }
type OSSOptions = { accessKeyId?: string, accessKeySecret?: string, headerEncoding?: string, host?: string, bucket?: string }
type OSSResult = { status: number, statusText: string, body: any, headers: { [key: string]: any } };

interface OSSBucket {
	list(prefix: string): Promise<any>;
	object(object: string): OSSObject;
}

interface OSSObject {
	delete(): Promise<OSSResult>;
	get(format?: string): Promise<OSSResult>;
	post(body: string | ArrayBuffer, type?: string, callback?: string): Promise<OSSResult>;
	put(body: string | ArrayBuffer, type?: string, callback?: string): Promise<OSSResult>;
	stat(): Promise<OSSResult>;
}

export function parseXmlString(data: string): { [key: string]: any };
export function signature(accessKeySecret: string, canonicalString: string, headerEncoding?: string): string;
export function authorization(method: string, resource: string, parameters: { [key: string]: any }, headers: { [key: string]: any }, options: OSSOptions): string;

export function request(init: OSSRequestInit, options?: OSSOptions): Promise<OSSResult>;
export function upload(bucket: string, object: string, body: string, type: string, options?: OSSOptions): Promise<OSSResult>;
export function buckets(options: OSSOptions): Promise<OSSResult>;
export function bucket(bucket: string, options: OSSOptions): OSSBucket;
