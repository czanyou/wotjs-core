
export function has(name: string): Promise<boolean>;
export function toggle(name: string): Promise<void>;
export function setOn(name: string): Promise<void>;
export function setOff(name: string): Promise<void>;

export function test(name: string): Promise<any>;