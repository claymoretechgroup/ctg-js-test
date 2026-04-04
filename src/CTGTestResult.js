// Static result factory methods, aggregation utilities, and value formatting
export default class CTGTestResult {

    /* Static Fields */

    static STATUS_PASS      = "pass";
    static STATUS_FAIL      = "fail";
    static STATUS_ERROR     = "error";
    static STATUS_RECOVERED = "recovered";
    static STATUS_SKIP      = "skip";

    static SEVERITY = {
        "error":     5,
        "fail":      4,
        "recovered": 3,
        "pass":      2,
        "skip":      1
    };

    /**
     *
     * Static Methods
     *
     */

    // :: STRING, STRING, STRING, INT, STRING?, OBJECT? -> OBJECT
    // Creates a stage-type result structure.
    static stepResult(type, name, status, durationMs, message = null, exception = null) {
        return { type, name, status, durationMs: durationMs, message, exception };
    }

    // :: STRING, STRING, INT, *, *, STRING?, OBJECT? -> OBJECT
    // Creates an assert result with actual and expected fields.
    static assertResult(name, status, durationMs, actual, expected, message = null, exception = null) {
        return { type: "assert", name, status, durationMs: durationMs, actual, expected, message, exception };
    }

    // :: STRING, STRING, INT, *, [*], STRING?, OBJECT? -> OBJECT
    // Creates an assert-any result with actual and candidates fields.
    static assertAnyResult(name, status, durationMs, actual, candidates, message = null, exception = null) {
        return { type: "assert-any", name, status, durationMs: durationMs, actual, candidates, message, exception };
    }

    // :: STRING, STRING, INT, STRING?, OBJECT?, [OBJECT], OBJECT -> OBJECT
    // Creates a chain result with nested step results and aggregate counts.
    static chainResult(name, status, durationMs, message, exception, steps, counts) {
        return {
            type: "chain", name, status, durationMs: durationMs, message, exception, steps,
            passed: counts.passed, failed: counts.failed, skipped: counts.skipped,
            recovered: counts.recovered, errored: counts.errored, total: counts.total
        };
    }

    // :: INT, INT, INT -> STRING|VOID
    // Generates canonical chain message from child counts.
    // NOTE: Returns null if no failures or errors.
    static chainMessage(failed, errored, total) {
        if (failed === 0 && errored === 0) return null;
        return `${failed} failed, ${errored} errored in ${total} steps`;
    }

    // :: STRING, [OBJECT] -> OBJECT
    // Assembles root report. Calls countSteps, aggregateStatus, sumDuration internally.
    static report(name, steps) {
        const counts = CTGTestResult.countSteps(steps);
        const status = CTGTestResult.aggregateStatus(steps);
        const durationMs = CTGTestResult.sumDuration(steps);
        return {
            name, status,
            passed: counts.passed, failed: counts.failed, skipped: counts.skipped,
            recovered: counts.recovered, errored: counts.errored, total: counts.total,
            durationMs: durationMs, steps
        };
    }

    // :: [OBJECT] -> STRING
    // Derives worst status from child steps using severity ordering.
    // NOTE: Empty list returns "pass".
    static aggregateStatus(steps) {
        if (steps.length === 0) return "pass";
        let maxSeverity = 0;
        let maxStatus = "pass";
        for (const step of steps) {
            const sev = CTGTestResult.SEVERITY[step.status] || 0;
            if (sev > maxSeverity) {
                maxSeverity = sev;
                maxStatus = step.status;
            }
        }
        return maxStatus;
    }

    // :: [OBJECT] -> OBJECT
    // Counts steps by status at current level only (no recursion into chains).
    static countSteps(steps) {
        const counts = { passed: 0, failed: 0, skipped: 0, recovered: 0, errored: 0, total: 0 };
        for (const step of steps) {
            counts.total++;
            switch (step.status) {
                case "pass":      counts.passed++;    break;
                case "fail":      counts.failed++;    break;
                case "skip":      counts.skipped++;   break;
                case "recovered": counts.recovered++; break;
                case "error":     counts.errored++;   break;
            }
        }
        return counts;
    }

    // :: [OBJECT] -> INT
    // Sums durationMs across steps at current level.
    static sumDuration(steps) {
        let total = 0;
        for (const step of steps) {
            total += step.durationMs || 0;
        }
        return total;
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
