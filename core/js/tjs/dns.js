// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';
const dns = native.dns;

export const ADDRCONFIG = dns.AI_ADDRCONFIG;
export const V4MAPPED = dns.AI_V4MAPPED;

/**
 * Address
 * @typedef AddressInfo
 * @property {number} family
 * @property {number} ip
 * @property {number} address
 * @property {number} port
 */

/**
 * @param {string} hostname 
 * @param {object} options
 * @param {number} options.flags  One or more supported getaddrinfo flags. 
 * @param {number} options.family The record family. Must be 4, 6, or 0. 
 * @param {boolean} options.all
 * 
 * @returns {Promise<any>}
 */
export async function lookup(hostname, options) {
    let flags = 0;
    let family = -1;

    const PF_INET = 2;
    const PF_INET6 = 10;

    // Parse arguments
    if (typeof hostname != 'string') {
        throw TypeError('hostname argument must be a string');
    }

    if (typeof options == 'number') {
        family = ~~options; // to integer or 0

    } else {
        flags = options?.flags >>> 0; // to uint32_t or 0
        family = options?.family >>> 0;

        if (flags < 0 || flags > (ADDRCONFIG | V4MAPPED)) {
            throw new TypeError('invalid argument: invalid flags options');
        }
    }

    if (family !== 0 && family !== 4 && family !== 6) {
        throw new TypeError('family options must be 4 or 6');
    }

    if (family == 4) {
        family = PF_INET;
        
    } else if (family == 6) {
        family = PF_INET6;
    }

    // console.log('hostname', hostname, family, hints);
    if (!hostname) {
        return;
    }

    /** @param {native.dns.AddressInfo} result */
    function getAddress(result) {
        const addressInfo = result && result.address;
        if (!addressInfo) {
            return;
        }

        const address = { address: addressInfo.address };
        address.family = addressInfo.family;
        return address;
    }

    try {
        const params = { family, flags };
        const result = await dns.getaddrinfo(hostname, params);
        if (!result) {
            return;
        }

        if (options?.all) {
            const addresses = [];
            for (let i = 0; i < result.length; i++) {
                addresses.push(getAddress(result[i]));
            }

            return addresses;

        } else {
            return getAddress(result[0]);
        }

    } catch (err) {
        err.message = err.message + ': ' + hostname;
        err.hostname = hostname;
        throw err;
    }
};
