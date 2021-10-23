// @ts-check
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
 * @param {number} options.hints  One or more supported getaddrinfo flags. 
 * @param {number} options.family The record family. Must be 4, 6, or 0. 
 * @param {object} options.all
 * 
 * @returns {Promise<any>}
 */
export async function lookup(hostname, options) {
    let hints = 0;
    let family = -1;

    // Parse arguments
    if (typeof hostname != 'string') {
        throw TypeError('invalid argument: hostname must be a string');
    }

    if (typeof options == 'number') {
        family = ~~options; // to integer or 0

    } else {
        hints = options?.hints >>> 0; // to uint32_t or 0
        family = options?.family >>> 0;

        if (hints < 0 || hints > (ADDRCONFIG | V4MAPPED)) {
            throw new TypeError('invalid argument: invalid hints flags');
        }
    }

    if (family !== 0 && family !== 4 && family !== 6) {
        throw new TypeError('invalid argument: family must be 4 or 6');
    }

    // console.log('hostname', hostname, family, hints);
    if (!hostname) {
        return;
    }

    /* @param {AddressInfo} result */
    function getAddress(result) {
        result = result && result.address;
        if (!result) {
            return;
        }

        const address = { ip: result.ip, address: result.ip };
        address.family = result.family;

        if (result.family == 2) {
            address.family = 4;

        } else if (result.family == 10) {
            address.family = 6;
        }

        return address;
    }

    try {
        const params = { ai_family: family, hints };
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
        throw err;
    }
};
