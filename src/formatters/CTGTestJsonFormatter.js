// JSON formatter with BigInt replacer for safe serialization.
// Accepts CTGTestState and produces pretty-printed JSON string.
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

    // :: CTGTestState -> STRING
    // Pretty-printed JSON serialization of the state.
    // NOTE: No trailing newline — caller appends it.
    static format(state) {
        return JSON.stringify(state, CTGTestJsonFormatter.bigIntReplacer, 2);
    }
}
