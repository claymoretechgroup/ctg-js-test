// Typed error class with bidirectional name/code lookup for test framework errors
export default class CTGTestError extends Error {

    /* Static Fields */

    static ERROR_TYPES = {
        INVALID_OPERATION:        1000,
        INVALID_CHAIN:            1001,
        INVALID_CONFIG:           1002,
        INVALID_EXPECTED_OUTCOME: 1003,
        INVALID_SKIP:             1004,
        FORMATTER_ERROR:          2000,
        RUNNER_ERROR:             2001,
        CHAIN_DEPTH_EXCEEDED:     1100
    };

    // CONSTRUCTOR :: STRING|INT, STRING?, * -> this
    // Accepts type name or numeric code. Resolves both via bidirectional lookup.
    // NOTE: Unknown types or codes throw a native TypeError immediately.
    constructor(typeOrCode, msg, data) {
        const resolved = CTGTestError._resolve(typeOrCode);
        const message = msg !== undefined && msg !== null ? msg : resolved.type;
        super(message);
        this._type = resolved.type;
        this._code = resolved.code;
        this._msg = message;
        this._data = data !== undefined ? data : undefined;
        this.name = "CTGTestError";
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> STRING
    get type() { return this._type; }

    // GETTER :: VOID -> INT
    get code() { return this._code; }

    // GETTER :: VOID -> STRING
    get msg() { return this._msg; }

    // GETTER :: VOID -> *
    get data() { return this._data; }

    /**
     *
     * Static Methods
     *
     */

    // :: STRING|INT -> INT|STRING
    // Bidirectional lookup. String input returns code; integer input returns type name.
    // NOTE: Throws TypeError for unknown types or codes.
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

    // :: STRING|INT -> {type: STRING, code: INT}
    // Resolves type name and code from either direction.
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
