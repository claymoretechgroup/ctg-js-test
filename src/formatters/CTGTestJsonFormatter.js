export default class CTGTestJsonFormatter {

    static bigIntReplacer(key, value) {
        if (typeof value === "bigint") {
            return `${value}n`;
        }
        return value;
    }

    static format(report, config = {}) {
        return JSON.stringify(report, CTGTestJsonFormatter.bigIntReplacer, 2);
    }
}
