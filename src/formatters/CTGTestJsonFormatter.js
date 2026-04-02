// JSON formatter with BigInt replacer for safe serialization
export default class CTGTestJsonFormatter {

    /**
     *
     * Static Methods
     *
     */

    // :: STRING, * -> *
    // JSON replacer that converts BigInt values to string with "n" suffix.
    static bigIntReplacer(key, value) {
        if (typeof value === "bigint") {
            return `${value}n`;
        }
        return value;
    }

    // :: OBJECT, OBJECT? -> STRING
    // Pretty-printed JSON serialization of the full report structure.
    // NOTE: No trailing newline — delivery layer appends it.
    static format(report, config = {}) {
        return JSON.stringify(report, CTGTestJsonFormatter.bigIntReplacer, 2);
    }
}
