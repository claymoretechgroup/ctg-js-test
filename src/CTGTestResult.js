// Result value object and static utilities for status aggregation and formatting.
// Results are constructed via factory methods only — the constructor is not public API.
export default class CTGTestResult {

    /* Static Fields */

    static STATUS = Object.freeze({
        PASS:  0,
        FAIL:  1,
        ERROR: 2
    });

    static STATUS_LABELS = Object.freeze({
        0: "pass",
        1: "fail",
        2: "error"
    });

    static SEVERITY = Object.freeze({
        2: 3,  // ERROR — worst
        1: 2,  // FAIL
        0: 1   // PASS
    });

    // CONSTRUCTOR :: [STRING], BOOL, INT?, *, *, Error? -> this
    // Private — use factory methods. Fields are public and read-only (frozen).
    constructor(label, skipped, status, computedValue, expectedOutcome, error) {
        this.label = label;
        this.skipped = skipped;
        this.status = status;
        this.computedValue = computedValue;
        this.expectedOutcome = expectedOutcome;
        this.error = error;
        Object.freeze(this);
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: [STRING], INT, Error? -> ctgTestResult
    // Creates a stage result (PASS or ERROR). computedValue and expectedOutcome are undefined.
    static stageResult(label, status, error) {
        return new CTGTestResult(
            label,
            false,
            status,
            undefined,
            undefined,
            error !== undefined ? error : undefined
        );
    }

    // Static Factory Method :: [STRING], INT, *, *, Error? -> ctgTestResult
    // Creates an assert result (PASS, FAIL, or ERROR).
    static assertResult(label, status, computedValue, expectedOutcome, error) {
        return new CTGTestResult(
            label,
            false,
            status,
            computedValue,
            expectedOutcome,
            error !== undefined ? error : undefined
        );
    }

    // Static Factory Method :: [STRING] -> ctgTestResult
    // Creates a skipped result. All evaluation fields are undefined.
    static skippedResult(label) {
        return new CTGTestResult(
            label,
            true,
            undefined,
            undefined,
            undefined,
            undefined
        );
    }

    // :: INT -> STRING
    // Resolves a status code to its human-readable label.
    static statusLabel(code) {
        return CTGTestResult.STATUS_LABELS[code];
    }

    // :: [ctgTestResult] -> INT
    // Derives worst status from results using severity ordering.
    // NOTE: Empty list returns STATUS.PASS. Skipped results are ignored.
    static aggregateStatus(results) {
        const S = CTGTestResult.STATUS;
        if (results.length === 0) return S.PASS;
        let maxSeverity = 0;
        let maxStatus = S.PASS;
        for (const result of results) {
            if (result.skipped) continue;
            const status = typeof result === "object" && result !== null && "status" in result
                ? result.status
                : result;
            const sev = CTGTestResult.SEVERITY[status] || 0;
            if (sev > maxSeverity) {
                maxSeverity = sev;
                maxStatus = status;
            }
        }
        return maxStatus;
    }

    // :: [ctgTestResult] -> { passed: INT, failed: INT, errored: INT, skipped: INT, total: INT }
    // Counts results by category.
    static countResults(results) {
        const S = CTGTestResult.STATUS;
        const counts = { passed: 0, failed: 0, errored: 0, skipped: 0, total: 0 };
        for (const result of results) {
            counts.total++;
            if (result.skipped) {
                counts.skipped++;
            } else {
                switch (result.status) {
                    case S.PASS:  counts.passed++;  break;
                    case S.FAIL:  counts.failed++;  break;
                    case S.ERROR: counts.errored++; break;
                }
            }
        }
        return counts;
    }

    // :: [ctgTestResult] -> INT
    // Sums durationMs across results at current level.
    static sumDuration(results) {
        let total = 0;
        for (const result of results) {
            total += result.durationMs || 0;
        }
        return total;
    }

    // :: STRING, [ctgTestResult] -> OBJECT
    // Assembles root report. Calls countResults, aggregateStatus internally.
    static report(name, results) {
        const counts = CTGTestResult.countResults(results);
        const status = CTGTestResult.aggregateStatus(results);
        return { name, status, ...counts, results };
    }

    // :: Error, BOOL, OBJECT? -> OBJECT
    // Serializes an exception to a structured map.
    // NOTE: causedBy is a pre-formatted exception map, not a raw Error.
    static formatException(exception, includeTrace, causedBy = null) {
        const result = {
            class: exception.constructor.name,
            message: exception.message
        };

        if (exception.code !== undefined && exception.code !== null) {
            result.code = exception.code;
        } else {
            result.code = null;
        }

        if (includeTrace) {
            result.trace = exception.stack;
        }

        if (exception.data !== undefined && exception.data !== null) {
            result.data = exception.data;
        }

        if (causedBy !== null && causedBy !== undefined) {
            result.caused_by = causedBy;
        }

        return result;
    }

    // :: * -> STRING
    // Serializes any value to a human-readable string.
    static formatValue(value) {
        if (value === null) return "null";
        if (value === undefined) return "null";

        const t = typeof value;

        if (t === "boolean") return value ? "true" : "false";

        if (t === "number") {
            if (Number.isNaN(value)) return "NaN";
            if (value === Infinity) return "Infinity";
            if (value === -Infinity) return "-Infinity";
            return String(value);
        }

        if (t === "bigint") return `${value}n`;

        if (t === "string") {
            const escaped = value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            return `'${escaped}'`;
        }

        if (t === "function") return "[Closure]";

        if (t === "symbol") return `symbol(${value.description})`;

        if (Array.isArray(value)) return `array(${value.length})`;

        if (value instanceof Map) return `Map(${value.size})`;

        if (value instanceof Set) return `Set(${value.size})`;

        return `object(${value.constructor.name})`;
    }
}
