export default class CTGTestResult {

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

    static stepResult(type, name, status, durationMs, message = null, exception = null) {
        return { type, name, status, duration_ms: durationMs, message, exception };
    }

    static assertResult(name, status, durationMs, actual, expected, message = null, exception = null) {
        return { type: "assert", name, status, duration_ms: durationMs, actual, expected, message, exception };
    }

    static assertAnyResult(name, status, durationMs, actual, candidates, message = null, exception = null) {
        return { type: "assert-any", name, status, duration_ms: durationMs, actual, candidates, message, exception };
    }

    static chainResult(name, status, durationMs, message, exception, steps, counts) {
        return {
            type: "chain", name, status, duration_ms: durationMs, message, exception, steps,
            passed: counts.passed, failed: counts.failed, skipped: counts.skipped,
            recovered: counts.recovered, errored: counts.errored, total: counts.total
        };
    }

    static chainMessage(failed, errored, total) {
        if (failed === 0 && errored === 0) return null;
        return `${failed} failed, ${errored} errored in ${total} steps`;
    }

    static report(name, steps) {
        const counts = CTGTestResult.countSteps(steps);
        const status = CTGTestResult.aggregateStatus(steps);
        const durationMs = CTGTestResult.sumDuration(steps);
        return {
            name, status,
            passed: counts.passed, failed: counts.failed, skipped: counts.skipped,
            recovered: counts.recovered, errored: counts.errored, total: counts.total,
            duration_ms: durationMs, steps
        };
    }

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

    static sumDuration(steps) {
        let total = 0;
        for (const step of steps) {
            total += step.duration_ms || 0;
        }
        return total;
    }

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

        if (causedBy !== null && causedBy !== undefined) {
            result.caused_by = causedBy;
        }

        return result;
    }

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
