#!/bin/env tjs
//@ts-check
/// <reference path ="../../modules/types/index.d.ts" />

import * as os from '@tjs/os'
import * as fs from '@tjs/fs'
import * as path from '@tjs/path'
import * as native from '@tjs/native'

/**
 * 比较两个文件名是否匹配
 * @param {string} filename 文件名
 * @param {string} pattern 包含 * 或 ? 通配符的文件名
 * @returns {boolean}
 */
export function isNameMatch(filename, pattern) {
	if (filename == pattern) {
		return true;
	}

	const m = filename.length;
	const n = pattern.length;
	const dp = new Array(m + 1).fill(0).map(() => new Array(n + 1).fill(false));
	dp[0][0] = true;

	// 处理模式以 * 开头的情况
	for (let j = 1; j <= n; j++) {
		if (pattern[j - 1] === '*') {
			dp[0][j] = dp[0][j - 1];
		}
	}

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (pattern[j - 1] === '?' || filename[i - 1] === pattern[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1];
			} else if (pattern[j - 1] === '*') {
				dp[i][j] = dp[i - 1][j] || dp[i][j - 1];
			}
		}
	}

	return dp[m][n];
}


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

		const list = [];

		for (const file of files) {
			const listFiles = await this.listFiles(this.basepath, file);
			list.push(...listFiles);
		}

		for (const filename of list) {
			try {
				await this.compile(filename);

			} catch (e) {
				console.error('bundle:', filename, e);
			}
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
	 * @param {string} basename 
	 * @param {string} name 
	 */
	async listFiles(basename, name) {
		/** @type {string[]} */
		const result = [];
		if (!name) {
			return result;
		}

		const dirname = path.dirname(name);
		const filename = path.basename(name);

		const dirents = await fs.readdir(path.join(basename, dirname));
		for (const dirent of dirents) {
			if (dirent.type != 1) {
				continue;
			}

			if (isNameMatch(dirent.name, filename)) {
				result.push(path.join(dirname, dirent.name));
			}
		}

		return result;
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
