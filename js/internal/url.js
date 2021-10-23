// @ts-check
/* eslint-disable no-labels */

/* URL */

/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

(function (scope) {
    'use strict';

    const relative = Object.create(null);
    relative.ftp = 21;
    relative.file = 0;
    relative.gopher = 70;
    relative.http = 80;
    relative.https = 443;
    relative.mqtt = 1883;
    relative.mqtts = 1884;
    relative.rtsp = 554;
    relative.rtmp = 1935;
    relative.ws = 80;
    relative.wss = 443;

    const relativePathDotMapping = Object.create(null);
    relativePathDotMapping['%2e'] = '.';
    relativePathDotMapping['.%2e'] = '..';
    relativePathDotMapping['%2e.'] = '..';
    relativePathDotMapping['%2e%2e'] = '..';

    function isRelativeScheme(scheme) {
        return relative[scheme] !== undefined;
    }

    function invalid() {
        clear.call(this);
        this._isInvalid = true;
    }

    function IDNAToASCII(h) {
        if (h == '') {
            invalid.call(this);
        }
        // XXX
        return h.toLowerCase();
    }

    function percentEscape(c) {
        const unicode = c.charCodeAt(0);
        if (unicode > 0x20 &&
            unicode < 0x7F &&
            // " # < > ? `
            [0x22, 0x23, 0x3C, 0x3E, 0x3F, 0x60].indexOf(unicode) == -1
        ) {
            return c;
        }
        return encodeURIComponent(c);
    }

    function percentEscapeQuery(c) {
        // XXX This actually needs to encode c using encoding and then
        // convert the bytes one-by-one.

        const unicode = c.charCodeAt(0);
        if (unicode > 0x20 &&
            unicode < 0x7F &&
            // " # < > ` (do not escape '?')
            [0x22, 0x23, 0x3C, 0x3E, 0x60].indexOf(unicode) == -1
        ) {
            return c;
        }
        return encodeURIComponent(c);
    }

    const EOF = undefined;
    const ALPHA = /[a-zA-Z]/;
    const ALPHANUMERIC = /[a-zA-Z0-9\+\-\.]/;

    /**
     * @param {!string} input
     * @param {?string=} stateOverride
     * @param {(URL|string)=} base
     */
    function parse(input, stateOverride, base) {
        if (input == null) {
            return;
        }
        
        function err(message) {
            errors.push(message);
        }

        let state = stateOverride || 'scheme start';
        let cursor = 0;
        let buffer = '';
        let seenAt = false;
        let seenBracket = false;
        const errors = [];

        loop: while ((input[cursor - 1] != EOF || cursor == 0) && !this._isInvalid) {
            const c = input[cursor];
            switch (state) {
                case 'scheme start':
                    if (c && ALPHA.test(c)) {
                        buffer += c.toLowerCase(); // ASCII-safe
                        state = 'scheme';

                    } else if (!stateOverride) {
                        buffer = '';
                        state = 'no scheme';
                        continue;

                    } else {
                        err('Invalid scheme.');
                        break loop;
                    }
                    
                    break;

                case 'scheme':
                    if (c && ALPHANUMERIC.test(c)) {
                        buffer += c.toLowerCase(); // ASCII-safe

                    } else if (c == ':') {
                        this._scheme = buffer;
                        buffer = '';

                        if (stateOverride) {
                            break loop;
                        }

                        if (isRelativeScheme(this._scheme)) {
                            this._isRelative = true;
                        }

                        if (this._scheme == 'file') {
                            state = 'relative';

                        } else if (this._isRelative && base && base._scheme == this._scheme) {
                            state = 'relative or authority';

                        } else if (this._isRelative) {
                            state = 'authority first slash';

                        } else {
                            state = 'scheme data';
                        }

                    } else if (!stateOverride) {
                        buffer = '';
                        cursor = 0;
                        state = 'no scheme';
                        continue;

                    } else if (EOF == c) {
                        break loop;

                    } else {
                        err('Code point not allowed in scheme: ' + c);
                        break loop;
                    }

                    break;

                case 'scheme data':
                    if (c == '?') {
                        this._query = '?';
                        state = 'query';
                    } else if (c == '#') {
                        this._fragment = '#';
                        state = 'fragment';
                    } else {
                        // XXX error handling
                        if (EOF != c && c != '\t' && c != '\n' && c != '\r') {
                            this._schemeData += percentEscape(c);
                        }
                    }
                    break;

                case 'no scheme':
                    if (!base || !(isRelativeScheme(base._scheme))) {
                        err('Missing scheme.');
                        invalid.call(this);
                    } else {
                        state = 'relative';
                        continue;
                    }
                    break;

                case 'relative or authority':
                    if (c == '/' && input[cursor + 1] == '/') {
                        state = 'authority ignore slashes';
                    } else {
                        err('Expected /, got: ' + c);
                        state = 'relative';
                        continue;
                    }
                    break;

                case 'relative':
                    this._isRelative = true;
                    if (this._scheme != 'file') { this._scheme = base._scheme; }
                    if (EOF == c) {
                        this._host = base._host;
                        this._port = base._port;
                        this._path = base._path.slice();
                        this._query = base._query;
                        this._username = base._username;
                        this._password = base._password;
                        break loop;

                    } else if (c == '/' || c == '\\') {
                        if (c == '\\') { err('\\ is an invalid code point.'); }
                        state = 'relative slash';

                    } else if (c == '?') {
                        this._host = base._host;
                        this._port = base._port;
                        this._path = base._path.slice();
                        this._query = '?';
                        this._username = base._username;
                        this._password = base._password;
                        state = 'query';

                    } else if (c == '#') {
                        this._host = base._host;
                        this._port = base._port;
                        this._path = base._path.slice();
                        this._query = base._query;
                        this._fragment = '#';
                        this._username = base._username;
                        this._password = base._password;
                        state = 'fragment';

                    } else {
                        const nextC = input[cursor + 1];
                        const nextNextC = input[cursor + 2];
                        if (
                            this._scheme != 'file' || !ALPHA.test(c) ||
                            (nextC != ':' && nextC != '|') ||
                            (EOF != nextNextC && nextNextC != '/' && nextNextC != '\\' && nextNextC != '?' && nextNextC != '#')) {
                            this._host = base._host;
                            this._port = base._port;
                            this._username = base._username;
                            this._password = base._password;
                            this._path = base._path.slice();
                            this._path.pop();
                        }

                        state = 'relative path';
                        continue;
                    }
                    break;

                case 'relative slash':
                    if (c == '/' || c == '\\') {
                        if (c == '\\') {
                            err('\\ is an invalid code point.');
                        }

                        if (this._scheme == 'file') {
                            state = 'file host';

                        } else {
                            state = 'authority ignore slashes';
                        }

                    } else {
                        if (this._scheme != 'file') {
                            this._host = base._host;
                            this._port = base._port;
                            this._username = base._username;
                            this._password = base._password;
                        }
                        
                        state = 'relative path';
                        continue;
                    }

                    break;

                case 'authority first slash':
                    if (c == '/') {
                        state = 'authority second slash';

                    } else {
                        err("Expected '/', got: " + c);
                        state = 'authority ignore slashes';
                        continue;
                    }

                    break;

                case 'authority second slash':
                    state = 'authority ignore slashes';
                    if (c != '/') {
                        err("Expected '/', got: " + c);
                        continue;
                    }

                    break;

                case 'authority ignore slashes':
                    if (c != '/' && c != '\\') {
                        state = 'authority';
                        continue;

                    } else {
                        err('Expected authority, got: ' + c);
                    }

                    break;

                case 'authority':
                    if (c == '@') {
                        if (seenAt) {
                            err('@ already seen.');
                            buffer += '%40';
                        }

                        seenAt = true;
                        for (let i = 0; i < buffer.length; i++) {
                            const cp = buffer[i];
                            if (cp == '\t' || cp == '\n' || cp == '\r') {
                                err('Invalid whitespace in authority.');
                                continue;
                            }
                            // XXX check URL code points
                            if (cp == ':' && this._password === null) {
                                this._password = '';
                                continue;
                            }
                            const tempC = percentEscape(cp);
                            (this._password !== null) ? this._password += tempC : this._username += tempC;
                        }
                        buffer = '';

                    } else if (EOF == c || c == '/' || c == '\\' || c == '?' || c == '#') {
                        cursor -= buffer.length;
                        buffer = '';
                        state = 'host';
                        continue;

                    } else {
                        buffer += c;
                    }
                    break;

                case 'file host':
                    if (EOF == c || c == '/' || c == '\\' || c == '?' || c == '#') {
                        if (buffer.length == 2 && ALPHA.test(buffer[0]) && (buffer[1] == ':' || buffer[1] == '|')) {
                            state = 'relative path';

                        } else if (buffer.length == 0) {
                            state = 'relative path start';

                        } else {
                            this._host = IDNAToASCII.call(this, buffer);
                            buffer = '';
                            state = 'relative path start';
                        }

                        continue;

                    } else if (c == '\t' || c == '\n' || c == '\r') {
                        err('Invalid whitespace in file host.');

                    } else {
                        buffer += c;
                    }

                    break;

                case 'host':
                case 'hostname':
                    if (c == ':' && !seenBracket) {
                        // XXX host parsing
                        this._host = IDNAToASCII.call(this, buffer);
                        buffer = '';
                        state = 'port';
                        if (stateOverride == 'hostname') {
                            break loop;
                        }

                    } else if (EOF == c || c == '/' || c == '\\' || c == '?' || c == '#') {
                        this._host = IDNAToASCII.call(this, buffer);
                        buffer = '';
                        state = 'relative path start';
                        if (stateOverride) {
                            break loop;
                        }
                        continue;

                    } else if (c != '\t' && c != '\n' && c != '\r') {
                        if (c == '[') {
                            seenBracket = true;
                        } else if (c == ']') {
                            seenBracket = false;
                        }
                        buffer += c;

                    } else {
                        err('Invalid code point in host/hostname: ' + c);
                    }
                    break;

                case 'port':
                    if (/[0-9]/.test(c)) {
                        buffer += c;
                    } else if (EOF == c || c == '/' || c == '\\' || c == '?' || c == '#' || stateOverride) {
                        if (buffer != '') {
                            const temp = parseInt(buffer, 10);
                            if (temp != relative[this._scheme]) {
                                this._port = temp + '';
                            }
                            buffer = '';
                        }
                        if (stateOverride) {
                            break loop;
                        }
                        state = 'relative path start';
                        continue;

                    } else if (c == '\t' || c == '\n' || c == '\r') {
                        err('Invalid code point in port: ' + c);
                    } else {
                        invalid.call(this);
                    }
                    break;

                case 'relative path start':
                    if (c == '\\') { err("'\\' not allowed in path."); }
                    state = 'relative path';
                    if (c != '/' && c != '\\') {
                        continue;
                    }
                    break;

                case 'relative path':
                    if (EOF == c || c == '/' || c == '\\' || (!stateOverride && (c == '?' || c == '#'))) {
                        if (c == '\\') {
                            err('\\ not allowed in relative path.');
                        }

                        const tmp = relativePathDotMapping[buffer.toLowerCase()];
                        if (tmp) {
                            buffer = tmp;
                        }

                        if (buffer == '..') {
                            this._path.pop();
                            if (c != '/' && c != '\\') {
                                this._path.push('');
                            }

                        } else if (buffer == '.' && c != '/' && c != '\\') {
                            this._path.push('');

                        } else if (buffer != '.') {
                            if (this._scheme == 'file' && this._path.length == 0 && buffer.length == 2 && ALPHA.test(buffer[0]) && buffer[1] == '|') {
                                buffer = buffer[0] + ':';
                            }
                            this._path.push(buffer);
                        }

                        buffer = '';
                        if (c == '?') {
                            this._query = '?';
                            state = 'query';

                        } else if (c == '#') {
                            this._fragment = '#';
                            state = 'fragment';
                        }

                    } else if (c != '\t' && c != '\n' && c != '\r') {
                        buffer += percentEscape(c);
                    }

                    break;

                case 'query':
                    if (!stateOverride && c == '#') {
                        this._fragment = '#';
                        state = 'fragment';

                    } else if (EOF != c && c != '\t' && c != '\n' && c != '\r') {
                        this._query += percentEscapeQuery(c);
                    }

                    break;

                case 'fragment':
                    if (EOF != c && c != '\t' && c != '\n' && c != '\r') {
                        this._fragment += c;
                    }

                    break;
            }

            cursor++;
        }
    }

    function clear() {
        this._scheme = '';
        this._schemeData = '';
        this._username = '';
        this._password = null;
        this._host = '';
        this._port = '';
        this._path = [];
        this._query = '';
        this._fragment = '';
        this._isInvalid = false;
        this._isRelative = false;
    }

    // Does not process domain names or IP addresses.
    // Does not handle encoding for the query parameter.
    /**
     * @constructor
     * @implements {URL}
     * @param {!string} url
     * @param {(URL|string)=} base
     */
    function BaseURL(url, base /* , encoding */) {
        if (base !== undefined && !(base instanceof BaseURL)) { base = new BaseURL(String(base)); }

        this._url = '' + url;
        clear.call(this);

        const input = this._url.replace(/^[ \t\r\n\f]+|[ \t\r\n\f]+$/g, '');
        // encoding = encoding || 'utf-8'

        parse.call(this, input, null, base);
    }

    function isEmpty(value) {
        return value == null || value == '';
    }

    BaseURL.prototype = {
        toString: function () {
            return this.href;
        },
        get href() {
            if (this._isInvalid) { 
                return this._url;
            }

            let authority = '';
            if (!isEmpty(this._username)) {
                authority = this._username;
                if (!isEmpty(this._password)) {
                    authority += ':' + this._password;
                }

                authority += '@';
            }

            let href = this.protocol;
            if (this._isRelative) {
                href += '//' + authority + this.host;
            }

            href += this.pathname + this._query + this._fragment;
            return href;    
        },
        set href(href) {
            clear.call(this);
            parse.call(this, href);
        },

        get protocol() {
            return this._scheme + ':';
        },
        set protocol(protocol) {
            if (this._isInvalid) { return; }
            parse.call(this, protocol + ':', 'scheme start');
        },

        get username() {
            return this._username;
        },
        set username(username) {
            if (this._isInvalid) { return; }
            this._username = username;
            parse.call(this, username, 'username');
        },

        get password() {
            return this._password;
        },
        set password(password) {
            if (this._isInvalid) { return; }
            this._password = password;
            parse.call(this, password, 'password');
        },

        get host() {
            return this._isInvalid
                ? ''
                : this._port
                    ? this._host + ':' + this._port
                    : this._host;
        },
        set host(host) {
            if (this._isInvalid || !this._isRelative) { return; }
            parse.call(this, host, 'host');
        },

        get hostname() {
            return this._host;
        },
        set hostname(hostname) {
            if (this._isInvalid || !this._isRelative) { return; }
            parse.call(this, hostname, 'hostname');
        },

        get port() {
            return this._port;
        },
        set port(port) {
            if (this._isInvalid || !this._isRelative) { return; }
            parse.call(this, port, 'port');
        },

        get pathname() {
            return this._isInvalid
                ? ''
                : this._isRelative
                    ? '/' + this._path.join('/')
                    : this._schemeData;
        },
        set pathname(pathname) {
            if (this._isInvalid || !this._isRelative) { return; }
            this._path = [];
            parse.call(this, pathname, 'relative path start');
        },

        get search() {
            return this._isInvalid || !this._query || this._query == '?'
                ? ''
                : this._query;
        },
        set search(search) {
            if (this._isInvalid || !this._isRelative) { return; }
            this._query = '?';
            if (search[0] == '?') { search = search.slice(1); }
            parse.call(this, search, 'query');
        },

        get hash() {
            return this._isInvalid || !this._fragment || this._fragment == '#'
                ? ''
                : this._fragment;
        },
        set hash(hash) {
            if (this._isInvalid) { return; }
            if (!hash) {
                this._fragment = '';
                return;
            }
            this._fragment = '#';
            if (hash[0] == '#') { hash = hash.slice(1); }
            parse.call(this, hash, 'fragment');
        },

        get origin() {
            if (this._isInvalid || !this._scheme) {
                return '';
            }
            // javascript: Gecko returns String(""), WebKit/Blink String("null")
            // Gecko throws error for "data://"
            // data: Gecko returns "", Blink returns "data://", WebKit returns "null"
            // Gecko returns String("") for file: mailto:
            // WebKit/Blink returns String("SCHEME://") for file: mailto:
            switch (this._scheme) {
                case 'data':
                case 'file':
                case 'javascript':
                case 'mailto':
                    return 'null';
            }

            const host = this.host;
            if (!host) {
                return '';
            }
            return this._scheme + '://' + host;
        }
    };

    scope.URL = BaseURL;

})(global);

/* URLSearchParams */

/**
 *
 *
 * @author Jerry Bendy <jerry@icewingcc.com>
 * @licence MIT
 *
 */

(function (self) {
    'use strict';

    const nativeURLSearchParams = (self.URLSearchParams && self.URLSearchParams.prototype.get) ? self.URLSearchParams : null;
    const isSupportObjectConstructor = nativeURLSearchParams && (new nativeURLSearchParams({ a: 1 })).toString() === 'a=1';
    // There is a bug in safari 10.1 (and earlier) that incorrectly decodes `%2B` as an empty space and not a plus.
    const decodesPlusesCorrectly = nativeURLSearchParams && (new nativeURLSearchParams('s=%2B').get('s') === '+');
    const __URLSearchParams__ = '__URLSearchParams__';
    // Fix bug in Edge which cannot encode ' &' correctly
    const encodesAmpersandsCorrectly = nativeURLSearchParams
        ? (function () {
            const ampersandTest = new nativeURLSearchParams();
            ampersandTest.append('s', ' &');
            return ampersandTest.toString() === 's=+%26';
        })()
        : true;
    const prototype = URLSearchParamsPolyfill.prototype;
    const iterable = !!(self.Symbol && self.Symbol.iterator);

    if (nativeURLSearchParams && isSupportObjectConstructor && decodesPlusesCorrectly && encodesAmpersandsCorrectly) {
        return;
    }

    /**
     * Make a URLSearchParams instance
     *
     * @param {object|string|URLSearchParams} search
     * @constructor
     */
    function URLSearchParamsPolyfill(search) {
        search = search || '';

        // support construct object with another URLSearchParams instance
        if (search instanceof URLSearchParams || search instanceof URLSearchParamsPolyfill) {
            search = search.toString();
        }
        this[__URLSearchParams__] = parseToDict(search);
    }

    /**
     * Appends a specified key/value pair as a new search parameter.
     *
     * @param {string} name
     * @param {string} value
     */
    prototype.append = function (name, value) {
        appendTo(this[__URLSearchParams__], name, value);
    };

    /**
     * Deletes the given search parameter, and its associated value,
     * from the list of all search parameters.
     *
     * @param {string} name
     */
    prototype.delete = function (name) {
        delete this[__URLSearchParams__][name];
    };

    /**
     * Returns the first value associated to the given search parameter.
     *
     * @param {string} name
     * @returns {string|null}
     */
    prototype.get = function (name) {
        const dict = this[__URLSearchParams__];
        return name in dict ? dict[name][0] : null;
    };

    /**
     * Returns all the values association with a given search parameter.
     *
     * @param {string} name
     * @returns {Array}
     */
    prototype.getAll = function (name) {
        const dict = this[__URLSearchParams__];
        return name in dict ? dict[name].slice(0) : [];
    };

    /**
     * Returns a Boolean indicating if such a search parameter exists.
     *
     * @param {string} name
     * @returns {boolean}
     */
    prototype.has = function (name) {
        return name in this[__URLSearchParams__];
    };

    /**
     * Sets the value associated to a given search parameter to
     * the given value. If there were several values, delete the
     * others.
     *
     * @param {string} name
     * @param {string} value
     */
    prototype.set = function set(name, value) {
        this[__URLSearchParams__][name] = ['' + value];
    };

    /**
     * Returns a string containg a query string suitable for use in a URL.
     *
     * @returns {string}
     */
    prototype.toString = function () {
        const dict = this[__URLSearchParams__]; const query = []; let i; let key; let name; let value;
        for (key in dict) {
            name = encode(key);
            for (i = 0, value = dict[key]; i < value.length; i++) {
                query.push(name + '=' + encode(value[i]));
            }
        }
        return query.join('&');
    };

    // There is a bug in Safari 10.1 and `Proxy`ing it is not enough.
    const forSureUsePolyfill = !decodesPlusesCorrectly;
    const useProxy = (!forSureUsePolyfill && nativeURLSearchParams && !isSupportObjectConstructor && self.Proxy);
    /*
     * Apply polifill to global object and append other prototype into it
     */
    Object.defineProperty(self, 'URLSearchParams', {
        value: (useProxy
            // Safari 10.0 doesn't support Proxy, so it won't extend URLSearchParams on safari 10.0
            ? new Proxy(nativeURLSearchParams, {
                construct: function (target, args) {
                    return new target((new URLSearchParamsPolyfill(args[0]).toString()));
                }
            })
            : URLSearchParamsPolyfill)
    });

    const USPProto = self.URLSearchParams.prototype;

    USPProto.polyfill = true;

    /**
     *
     * @param {function} callback
     * @param {object} thisArg
     */
    USPProto.forEach = USPProto.forEach || function (callback, thisArg) {
        const dict = parseToDict(this.toString());
        Object.getOwnPropertyNames(dict).forEach(function (name) {
            dict[name].forEach(function (value) {
                callback.call(thisArg, value, name, this);
            }, this);
        }, this);
    };

    /**
     * Sort all name-value pairs
     */
    USPProto.sort = USPProto.sort || function () {
        const dict = parseToDict(this.toString()); const keys = []; let k; let i; let j;
        for (k in dict) {
            keys.push(k);
        }
        keys.sort();

        for (i = 0; i < keys.length; i++) {
            this.delete(keys[i]);
        }
        for (i = 0; i < keys.length; i++) {
            const key = keys[i]; const values = dict[key];
            for (j = 0; j < values.length; j++) {
                this.append(key, values[j]);
            }
        }
    };

    /**
     * Returns an iterator allowing to go through all keys of
     * the key/value pairs contained in this object.
     *
     * @returns {function}
     */
    USPProto.keys = USPProto.keys || function () {
        const items = [];
        this.forEach(function (item, name) {
            items.push(name);
        });
        return makeIterator(items);
    };

    /**
     * Returns an iterator allowing to go through all values of
     * the key/value pairs contained in this object.
     *
     * @returns {function}
     */
    USPProto.values = USPProto.values || function () {
        const items = [];
        this.forEach(function (item) {
            items.push(item);
        });
        return makeIterator(items);
    };

    /**
     * Returns an iterator allowing to go through all key/value
     * pairs contained in this object.
     *
     * @returns {function}
     */
    USPProto.entries = USPProto.entries || function () {
        const items = [];
        this.forEach(function (item, name) {
            items.push([name, item]);
        });
        return makeIterator(items);
    };

    if (iterable) {
        USPProto[self.Symbol.iterator] = USPProto[self.Symbol.iterator] || USPProto.entries;
    }

    function encode(str) {
        const replace = {
            '!': '%21',
            "'": '%27',
            '(': '%28',
            ')': '%29',
            '~': '%7E',
            '%20': '+',
            '%00': '\x00'
        };
        return encodeURIComponent(str).replace(/[!'\(\)~]|%20|%00/g, function (match) {
            return replace[match];
        });
    }

    function decode(str) {
        return str
            .replace(/[ +]/g, '%20')
            .replace(/(%[a-f0-9]{2})+/ig, function (match) {
                return decodeURIComponent(match);
            });
    }

    function makeIterator(arr) {
        const iterator = {
            next: function () {
                const value = arr.shift();
                return { done: value === undefined, value: value };
            }
        };

        if (iterable) {
            iterator[self.Symbol.iterator] = function () {
                return iterator;
            };
        }

        return iterator;
    }

    function parseToDict(search) {
        const dict = {};

        if (typeof search === 'object') {
            // if `search` is an array, treat it as a sequence
            if (isArray(search)) {
                for (let i = 0; i < search.length; i++) {
                    const item = search[i];
                    if (isArray(item) && item.length === 2) {
                        appendTo(dict, item[0], item[1]);
                    } else {
                        throw new TypeError("Failed to construct 'URLSearchParams': Sequence initializer must only contain pair elements");
                    }
                }

            } else {
                for (const key in search) {
                    if (search.hasOwnProperty(key)) {
                        appendTo(dict, key, search[key]);
                    }
                }
            }

        } else {
            // remove first '?'
            if (search.indexOf('?') === 0) {
                search = search.slice(1);
            }

            const pairs = search.split('&');
            for (let j = 0; j < pairs.length; j++) {
                const value = pairs[j];
                const index = value.indexOf('=');

                if (index > -1) {
                    appendTo(dict, decode(value.slice(0, index)), decode(value.slice(index + 1)));

                } else {
                    if (value) {
                        appendTo(dict, decode(value), '');
                    }
                }
            }
        }

        return dict;
    }

    function appendTo(dict, name, value) {
        const val = typeof value === 'string'
            ? value
            : (
                value !== null && value !== undefined && typeof value.toString === 'function' ? value.toString() : JSON.stringify(value)
            );

        if (name in dict) {
            dict[name].push(val);
        } else {
            dict[name] = [val];
        }
    }

    function isArray(val) {
        return !!val && Object.prototype.toString.call(val) === '[object Array]';
    }

})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));

/* URL.searchParams */

Object.defineProperty(URL.prototype, 'searchParams', {
    get(context) {
        const searchParams = new URLSearchParams(this.search);
        searchParams.set = (key, value) => {
            URLSearchParams.prototype.set.call(searchParams, key, value);
            this.search = `?${searchParams.toString()}`;
        };
        searchParams.delete = (key, value) => {
            URLSearchParams.prototype.delete.call(searchParams, key, value);
            this.search = `?${searchParams.toString()}`;
        };
        searchParams.append = (key, value) => {
            URLSearchParams.prototype.append.call(searchParams, key, value);
            this.search = `?${searchParams.toString()}`;
        };
        searchParams.sort = () => {
            URLSearchParams.prototype.sort.call(searchParams);
            this.search = `?${searchParams.toString()}`;
        };
        return searchParams;
    }
});
