#!/bin/env tjs
//@ts-check
/// <reference path ="../../modules/types/index.d.ts" />

import * as os from '@tjs/os'
import * as fs from '@tjs/fs'
import * as path from '@tjs/path'
import * as native from '@tjs/native'

/**
 * 打包器
 */
export class Bundler {
	/** @type {string} JS 文件所在目录 */
	basepath = '';

	/** @type {string} 可执行文件路径 */
	exepath = '';

	/** @type {string[]} 要打包的 JS 文件列表 */
	files = [];

	/** @type {string} 模块名称前缀 */
	libname = '@app';

	/** @type {{name: string, data: Uint8Array}[]} 模块列表 */
	modules = [];

	/** @type {string} 输出文件 */
	outpath = 'build/tjs';

	/**
	 * 检查模块
	 * @param {string} name 
	 * @returns 
	 */
	async check(name) {
		const module = this.modules.find((item) => item.name === name);
		if (!module) {
			console.error('module not found', name);
			return;
		}

		const buffer = module.data;
		const view = new DataView(buffer.buffer);

		const tagHeaderSize = 8;
		const tagSize = view.getUint32(0);
		const nameSize = view.getUint8(7);

		console.log(tagSize, nameSize);

		const offset = tagHeaderSize + nameSize;
		const length = tagSize - nameSize;
		const ret = native.runtime.evalByteCode(buffer.buffer, offset, length);
		console.log(ret);
	}

	/**
	 * 打包
	 * @param {string[]} files 
	 */
	async bundle(files) {
		if (!this.exepath) {
			this.exepath = native.exepath();
		}

		if (!this.basepath) {
			this.basepath = os.cwd();
		}

		for (const file of files) {
			await this.compile(file);
		}

		await this.pack();
	}

	/**
	 * 编译模块
	 * @param {string} pathname 
	 * @returns 
	 */
	async compile(pathname) {
		const textEncoder = new TextEncoder();
		const filename = path.join(this.basepath, pathname);
		const filedata = await fs.readFile(filename);
		if (filedata == null) {
			return;
		}

		const name = path.join(this.libname, pathname);
		const data = native.runtime.compile(filedata.buffer, name);

		const tagName = textEncoder.encode(name);
		const tagSize = tagName.byteLength + data.byteLength;
		const tagHeaderSize = 8;

		const buffer = new Uint8Array(tagSize + tagHeaderSize);
		const view = new DataView(buffer.buffer);
		view.setUint32(0, tagSize);
		view.setUint8(7, tagName.byteLength);
		buffer.set(tagName, tagHeaderSize);
		buffer.set(new Uint8Array(data), tagHeaderSize + tagName.byteLength)

		this.modules.push({ name, data: buffer });
	}

	/**
	 * 打包
	 * @returns 
	 */
	async pack() {
		const exepath = this.exepath;

		const exedata = await fs.readFile(exepath);
		if (exedata == null) {
			return;
		}

		const fileEndSize = 16;

		const modules = this.modules;
		let modulesSize = 0;
		for (const module of modules) {
			modulesSize += module.data.byteLength;
		}

		const outputSize = exedata.byteLength + modulesSize + fileEndSize;
		const outputBuffer = new Uint8Array(outputSize);
		outputBuffer.set(exedata, 0);

		// modules
		let offset = exedata.byteLength;
		for (const module of modules) {
			outputBuffer.set(module.data, offset);
			offset += module.data.byteLength;
			console.print(`module: ${module.name}, size=${module.data.byteLength}`);
		}

		console.print(`exesize: ${exedata.byteLength}, modulesize: ${modulesSize}, outsize: ${outputSize}`);

		// magic code
		const textEncoder = new TextEncoder();
		const magicCode = textEncoder.encode('@tjs/modules');
		offset = exedata.byteLength + modulesSize;
		outputBuffer.set(magicCode, offset);

		// offset
		const bufferView = new DataView(outputBuffer.buffer);
		bufferView.setUint32(offset + 12, exedata.byteLength);

		// output
		await fs.writeFile(this.outpath, outputBuffer);

		console.print(`Write to ${this.outpath}`);
	}
}
