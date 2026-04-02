export default class CTGTestError extends Error {

    static ERROR_TYPES = {
        INVALID_STEP:     1000,
        INVALID_CHAIN:    1001,
        INVALID_CONFIG:   1002,
        INVALID_EXPECTED: 1003,
        INVALID_SKIP:     1004,
        FORMATTER_ERROR:  2000,
        RUNNER_ERROR:     2001
    };

    constructor(typeOrCode, msg, data) {
        const resolved = CTGTestError._resolve(typeOrCode);
        const message = msg !== undefined && msg !== null ? msg : resolved.type;
        super(message);
        this._type = resolved.type;
        this._code = resolved.code;
        this._msg = message;
        this._data = data !== undefined ? data : null;
        this.name = "CTGTestError";
    }

    get type() { return this._type; }
    get code() { return this._code; }
    get msg() { return this._msg; }
    get data() { return this._data; }

    static lookup(key) {
        if (typeof key === "string") {
            if (!(key in CTGTestError.ERROR_TYPES)) {
                throw new TypeError(`Unknown error type: ${key}`);
            }
            return CTGTestError.ERROR_TYPES[key];
        }
        if (typeof key === "number") {
            for (const [name, code] of Object.entries(CTGTestError.ERROR_TYPES)) {
                if (code === key) return name;
            }
            throw new TypeError(`Unknown error code: ${key}`);
        }
        throw new TypeError(`lookup expects string or number, got ${typeof key}`);
    }

    static _resolve(typeOrCode) {
        if (typeof typeOrCode === "string") {
            if (!(typeOrCode in CTGTestError.ERROR_TYPES)) {
                throw new TypeError(`Unknown error type: ${typeOrCode}`);
            }
            return { type: typeOrCode, code: CTGTestError.ERROR_TYPES[typeOrCode] };
        }
        if (typeof typeOrCode === "number") {
            for (const [name, code] of Object.entries(CTGTestError.ERROR_TYPES)) {
                if (code === typeOrCode) return { type: name, code };
            }
            throw new TypeError(`Unknown error code: ${typeOrCode}`);
        }
        throw new TypeError(`CTGTestError expects string type or numeric code, got ${typeof typeOrCode}`);
    }
}
