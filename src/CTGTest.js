import { isDeepStrictEqual } from "node:util";
import { performance } from "node:perf_hooks";
import CTGTestError from "./CTGTestError.js";
import CTGTestResult from "./CTGTestResult.js";
import CTGTestStep from "./CTGTestStep.js";
import CTGTestConsoleFormatter from "./formatters/CTGTestConsoleFormatter.js";
import CTGTestJsonFormatter from "./formatters/CTGTestJsonFormatter.js";
import CTGTestJunitFormatter from "./formatters/CTGTestJunitFormatter.js";

export default class CTGTest {

    static MAX_CHAIN_DEPTH = 64;
    static MAX_NESTING_DEPTH = 128;

    static VALID_CONFIG_KEYS = ["output", "haltOnFailure", "strict", "trace", "debug", "formatter"];
    static VALID_OUTPUT_MODES = ["console", "return", "return-json", "json", "junit"];
    static BOOLEAN_CONFIG_KEYS = ["haltOnFailure", "strict", "trace", "debug"];

    static DEFAULT_CONFIG = {
        output: "console",
        haltOnFailure: true,
        strict: true,
        trace: false,
        debug: false,
        formatter: null
    };

    static _cliConfig = null;

    constructor(name) {
        this._name = name.trim();
        this._steps = [];
        this._skips = [];
    }

    get name() { return this._name; }
    get steps() { return this._steps; }
    get skips() { return this._skips; }

    static init(name) {
        return new this(name);
    }

    static setCliConfig(config) {
        CTGTest._cliConfig = config;
    }

    static getCliConfig() {
        return CTGTest._cliConfig || {};
    }

    stage(name, fn, errorHandler = null) {
        this._steps.push(new CTGTestStep("stage", name, fn, null, errorHandler));
        return this;
    }

    assert(name, fn, expected, errorHandler = null) {
        this._steps.push(new CTGTestStep("assert", name, fn, expected, errorHandler));
        return this;
    }

    assertAny(name, fn, candidates, errorHandler = null) {
        this._steps.push(new CTGTestStep("assert-any", name, fn, candidates, errorHandler));
        return this;
    }

    chain(name, testInstance) {
        this._steps.push(new CTGTestStep("chain", name, testInstance, null, null));
        return this;
    }

    skip(stepName, predicate = null) {
        this._skips.push({ name: stepName, predicate });
        return this;
    }

    async start(subject, config = {}) {
        const resolved = this._resolveConfig(config);
        this._validateConfig(resolved);
        this._validateSteps();
        this._validateSkips();
        const { results: stepResults } = await this._executeSteps(subject, resolved, 0, this._steps, this._skips);
        const report = CTGTestResult.report(this._name, stepResults);
        return this._deliver(report, resolved);
    }

    // ── Config ───────────────────────────────────────────────

    _resolveConfig(config) {
        return { ...CTGTest.DEFAULT_CONFIG, ...config };
    }

    _validateConfig(config) {
        for (const key of Object.keys(config)) {
            if (!CTGTest.VALID_CONFIG_KEYS.includes(key)) {
                throw new CTGTestError("INVALID_CONFIG", `Unknown config key: ${key}`);
            }
        }

        if (!CTGTest.VALID_OUTPUT_MODES.includes(config.output)) {
            throw new CTGTestError("INVALID_CONFIG", `Invalid output mode: ${config.output}`);
        }

        for (const key of CTGTest.BOOLEAN_CONFIG_KEYS) {
            if (typeof config[key] !== "boolean") {
                throw new CTGTestError("INVALID_CONFIG", `${key} must be a boolean`);
            }
        }

        if (config.formatter !== null) {
            if (typeof config.formatter !== "function") {
                throw new CTGTestError("INVALID_CONFIG", "formatter must be a constructor function");
            }
            if (typeof config.formatter.format !== "function") {
                throw new CTGTestError("INVALID_CONFIG", "formatter must have a static format method");
            }
        }
    }

    // ── Step Validation ──────────────────────────────────────

    _validateSteps() {
        this._validateStepDefinitions(this._name, this._steps, new Set());
    }

    _validateStepDefinitions(testName, steps, visited) {
        if (testName.trim().length === 0) {
            throw new CTGTestError("INVALID_STEP", "Test name must not be empty");
        }

        const names = new Set();
        for (const step of steps) {
            if (!["stage", "assert", "assert-any", "chain"].includes(step.type)) {
                throw new CTGTestError("INVALID_STEP", `Unknown step type: ${step.type}`);
            }

            const trimmed = step.name.trim();
            if (trimmed.length === 0) {
                throw new CTGTestError("INVALID_STEP", "Step name must not be empty");
            }
            if (names.has(trimmed)) {
                throw new CTGTestError("INVALID_STEP", `Duplicate step name: ${trimmed}`);
            }
            names.add(trimmed);

            if (step.type === "chain") {
                if (!(step.fn instanceof CTGTest)) {
                    throw new CTGTestError("INVALID_CHAIN", "Chain target must be a CTGTest instance");
                }
                // Recurse into chained test (guard against circular chain references)
                if (!visited.has(step.fn)) {
                    visited.add(step.fn);
                    this._validateStepDefinitions(step.fn.name, step.fn.steps, visited);
                    this._validateSkipDefinitions(step.fn.steps, step.fn.skips);
                }
            } else {
                if (typeof step.fn !== "function") {
                    throw new CTGTestError("INVALID_STEP", `Step fn must be a function, got ${typeof step.fn}`);
                }
            }

            if (step.errorHandler !== null && typeof step.errorHandler !== "function") {
                throw new CTGTestError("INVALID_STEP", "Error handler must be a function");
            }

            if (step.type === "assert") {
                if (typeof step.expected === "function") {
                    throw new CTGTestError("INVALID_EXPECTED", "Assert expected must not be a function");
                }
            }

            if (step.type === "assert-any") {
                if (!Array.isArray(step.expected)) {
                    throw new CTGTestError("INVALID_EXPECTED", "AssertAny expected must be an array");
                }
            }
        }
    }

    // ── Skip Validation ──────────────────────────────────────

    _validateSkips() {
        this._validateSkipDefinitions(this._steps, this._skips);
    }

    _validateSkipDefinitions(steps, skips) {
        const stepNames = new Set(steps.map((s) => s.name.trim()));
        const skipNames = new Set();

        for (const skip of skips) {
            const trimmed = skip.name.trim();
            if (trimmed.length === 0) {
                throw new CTGTestError("INVALID_SKIP", "Skip name must not be empty");
            }
            if (!stepNames.has(trimmed)) {
                throw new CTGTestError("INVALID_SKIP", `Skip target does not exist: ${trimmed}`);
            }
            if (skipNames.has(trimmed)) {
                throw new CTGTestError("INVALID_SKIP", `Duplicate skip directive: ${trimmed}`);
            }
            skipNames.add(trimmed);

            if (skip.predicate !== null && typeof skip.predicate !== "function") {
                throw new CTGTestError("INVALID_SKIP", "Skip predicate must be a function");
            }
        }
    }

    // ── Execution ────────────────────────────────────────────

    async _executeSteps(subject, config, depth, steps, skips) {
        const results = [];
        const skipMap = new Map();
        for (const skip of skips) {
            skipMap.set(skip.name.trim(), skip);
        }

        for (const step of steps) {
            const trimmedName = step.name.trim();
            const skipDirective = skipMap.get(trimmedName);

            // Check skip
            if (skipDirective) {
                const skipResult = await this._handleSkip(step, skipDirective, subject, config);
                if (skipResult !== null) {
                    results.push(skipResult);
                    if (config.haltOnFailure && (skipResult.status === "fail" || skipResult.status === "error")) {
                        break;
                    }
                    continue;
                }
            }

            let result;
            const debugSnapshot = config.debug ? this._snapshotSubject(subject, 0) : undefined;

            switch (step.type) {
                case "stage":
                    result = await this._executeStage(step, subject, config);
                    if (result.status === "pass" || result.status === "recovered") {
                        subject = result._newSubject;
                    }
                    delete result._newSubject;
                    break;
                case "assert":
                    result = await this._executeAssert(step, subject, config);
                    break;
                case "assert-any":
                    result = await this._executeAssertAny(step, subject, config);
                    break;
                default:
                    throw new CTGTestError("INVALID_STEP", `Unknown step type: ${step.type}`);
                case "chain":
                    result = await this._executeChain(step, subject, config, depth);
                    if (result._chainSubject !== undefined) {
                        subject = result._chainSubject;
                    }
                    delete result._chainSubject;
                    break;
            }

            if (config.debug) {
                result.subject = debugSnapshot;
            }

            results.push(result);

            if (config.haltOnFailure && (result.status === "fail" || result.status === "error")) {
                break;
            }
        }

        return { results, subject };
    }

    async _handleSkip(step, skipDirective, subject, config) {
        if (skipDirective.predicate === null) {
            return this._skipResult(step);
        }

        const start = performance.now();
        try {
            const shouldSkip = await skipDirective.predicate(subject);
            if (shouldSkip) {
                return this._skipResult(step);
            }
            return null; // don't skip
        } catch (err) {
            const durationMs = Math.round(performance.now() - start);
            const exception = CTGTestResult.formatException(err, config.trace);
            return this._errorResultForStep(step, durationMs, err.message, exception);
        }
    }

    _skipResult(step) {
        switch (step.type) {
            case "stage":
                return CTGTestResult.stepResult("stage", step.name, "skip", 0, null, null);
            case "assert":
                return CTGTestResult.assertResult(step.name, "skip", 0, null, step.expected, null, null);
            case "assert-any":
                return CTGTestResult.assertAnyResult(step.name, "skip", 0, null, step.expected, null, null);
            case "chain":
                return CTGTestResult.chainResult(
                    step.name, "skip", 0, null, null, [],
                    { passed: 0, failed: 0, skipped: 0, recovered: 0, errored: 0, total: 0 }
                );
        }
    }

    _errorResultForStep(step, durationMs, message, exception) {
        switch (step.type) {
            case "stage":
                return CTGTestResult.stepResult("stage", step.name, "error", durationMs, message, exception);
            case "assert":
                return CTGTestResult.assertResult(step.name, "error", durationMs, null, step.expected, message, exception);
            case "assert-any":
                return CTGTestResult.assertAnyResult(step.name, "error", durationMs, null, step.expected, message, exception);
            case "chain":
                return CTGTestResult.chainResult(
                    step.name, "error", durationMs, message, exception, [],
                    { passed: 0, failed: 0, skipped: 0, recovered: 0, errored: 0, total: 0 }
                );
        }
    }

    async _executeStage(step, subject, config) {
        const start = performance.now();
        try {
            const newSubject = await step.fn(subject);
            const durationMs = Math.round(performance.now() - start);
            const result = CTGTestResult.stepResult("stage", step.name, "pass", durationMs);
            result._newSubject = newSubject;
            return result;
        } catch (err) {
            return this._handleStepError(step, "stage", err, subject, config, start);
        }
    }

    async _executeAssert(step, subject, config) {
        const start = performance.now();
        try {
            const actual = await step.fn(subject);
            const matched = this.compare(actual, step.expected, config.strict);
            const durationMs = Math.round(performance.now() - start);
            if (matched) {
                return CTGTestResult.assertResult(step.name, "pass", durationMs, actual, step.expected);
            }
            const msg = `expected ${CTGTestResult.formatValue(step.expected)} but got ${CTGTestResult.formatValue(actual)}`;
            return CTGTestResult.assertResult(step.name, "fail", durationMs, actual, step.expected, msg);
        } catch (err) {
            return this._handleAssertError(step, err, subject, config, start);
        }
    }

    async _executeAssertAny(step, subject, config) {
        const start = performance.now();
        try {
            const actual = await step.fn(subject);
            const candidates = step.expected;

            if (candidates.length === 0) {
                const durationMs = Math.round(performance.now() - start);
                return CTGTestResult.assertAnyResult(
                    step.name, "fail", durationMs, actual, candidates,
                    `expected any of 0 candidates, but candidate set is empty`
                );
            }

            for (const candidate of candidates) {
                if (this.compare(actual, candidate, config.strict)) {
                    const durationMs = Math.round(performance.now() - start);
                    return CTGTestResult.assertAnyResult(step.name, "pass", durationMs, actual, candidates);
                }
            }

            const durationMs = Math.round(performance.now() - start);
            const formatted = candidates.map((c) => CTGTestResult.formatValue(c)).join(", ");
            return CTGTestResult.assertAnyResult(
                step.name, "fail", durationMs, actual, candidates,
                `expected any of [${formatted}] but got ${CTGTestResult.formatValue(actual)}`
            );
        } catch (err) {
            return this._handleAssertAnyError(step, err, subject, config, start);
        }
    }

    async _executeChain(step, subject, config, depth) {
        if (depth >= CTGTest.MAX_CHAIN_DEPTH) {
            throw new CTGTestError("INVALID_CHAIN", `Chain depth exceeds maximum of ${CTGTest.MAX_CHAIN_DEPTH}`);
        }

        const start = performance.now();
        const testInstance = step.fn;
        const { results: childResults, subject: chainSubject } = await this._executeSteps(
            subject, config, depth + 1, testInstance.steps, testInstance.skips
        );
        const durationMs = Math.round(performance.now() - start);
        const counts = CTGTestResult.countSteps(childResults);
        const status = CTGTestResult.aggregateStatus(childResults);
        const message = CTGTestResult.chainMessage(counts.failed, counts.errored, counts.total);

        const result = CTGTestResult.chainResult(step.name, status, durationMs, message, null, childResults, counts);
        result._chainSubject = chainSubject;
        return result;
    }

    // ── Error Handling ───────────────────────────────────────

    async _handleStepError(step, type, err, subject, config, start) {
        if (step.errorHandler) {
            const originalException = CTGTestResult.formatException(err, config.trace);
            try {
                const recovered = await step.errorHandler(err);
                const durationMs = Math.round(performance.now() - start);
                const result = CTGTestResult.stepResult(type, step.name, "recovered", durationMs,
                    `error handler invoked, produced ${CTGTestResult.formatValue(recovered)}`, originalException);
                result._newSubject = recovered;
                return result;
            } catch (handlerErr) {
                const durationMs = Math.round(performance.now() - start);
                const handlerException = CTGTestResult.formatException(handlerErr, config.trace, originalException);
                return CTGTestResult.stepResult(type, step.name, "error", durationMs, handlerErr.message, handlerException);
            }
        }
        const durationMs = Math.round(performance.now() - start);
        const exception = CTGTestResult.formatException(err, config.trace);
        return CTGTestResult.stepResult(type, step.name, "error", durationMs, err.message, exception);
    }

    async _handleAssertError(step, err, subject, config, start) {
        if (step.errorHandler) {
            const originalException = CTGTestResult.formatException(err, config.trace);
            try {
                const recovered = await step.errorHandler(err);
                const durationMs = Math.round(performance.now() - start);
                const matched = this.compare(recovered, step.expected, config.strict);
                if (matched) {
                    return CTGTestResult.assertResult(step.name, "recovered", durationMs,
                        recovered, step.expected,
                        `error handler invoked, produced ${CTGTestResult.formatValue(recovered)}`, originalException);
                }
                const msg = `expected ${CTGTestResult.formatValue(step.expected)} but got ${CTGTestResult.formatValue(recovered)}`;
                return CTGTestResult.assertResult(step.name, "fail", durationMs,
                    recovered, step.expected, msg);
            } catch (handlerErr) {
                const durationMs = Math.round(performance.now() - start);
                const handlerException = CTGTestResult.formatException(handlerErr, config.trace, originalException);
                return CTGTestResult.assertResult(step.name, "error", durationMs,
                    null, step.expected, handlerErr.message, handlerException);
            }
        }
        const durationMs = Math.round(performance.now() - start);
        const exception = CTGTestResult.formatException(err, config.trace);
        return CTGTestResult.assertResult(step.name, "error", durationMs,
            null, step.expected, err.message, exception);
    }

    async _handleAssertAnyError(step, err, subject, config, start) {
        if (step.errorHandler) {
            const originalException = CTGTestResult.formatException(err, config.trace);
            try {
                const recovered = await step.errorHandler(err);
                const durationMs = Math.round(performance.now() - start);
                for (const candidate of step.expected) {
                    if (this.compare(recovered, candidate, config.strict)) {
                        return CTGTestResult.assertAnyResult(step.name, "recovered", durationMs,
                            recovered, step.expected,
                            `error handler invoked, produced ${CTGTestResult.formatValue(recovered)}`, originalException);
                    }
                }
                const formatted = step.expected.map((c) => CTGTestResult.formatValue(c)).join(", ");
                const msg = `expected any of [${formatted}] but got ${CTGTestResult.formatValue(recovered)}`;
                return CTGTestResult.assertAnyResult(step.name, "fail", durationMs,
                    recovered, step.expected, msg);
            } catch (handlerErr) {
                const durationMs = Math.round(performance.now() - start);
                const handlerException = CTGTestResult.formatException(handlerErr, config.trace, originalException);
                return CTGTestResult.assertAnyResult(step.name, "error", durationMs,
                    null, step.expected, handlerErr.message, handlerException);
            }
        }
        const durationMs = Math.round(performance.now() - start);
        const exception = CTGTestResult.formatException(err, config.trace);
        return CTGTestResult.assertAnyResult(step.name, "error", durationMs,
            null, step.expected, err.message, exception);
    }

    // ── Comparison ───────────────────────────────────────────

    compare(actual, expected, strict) {
        // Uncomparable checks
        this._checkUncomparable(actual, "actual");
        this._checkUncomparable(expected, "expected");

        if (strict) {
            return isDeepStrictEqual(actual, expected);
        }

        return this._looseDeepEqual(actual, expected, [], 0);
    }

    _checkUncomparable(value, label) {
        if (typeof value === "function") {
            throw new CTGTestError("INVALID_STEP", `Cannot compare closures (${label})`);
        }
        if (value instanceof Map) {
            throw new CTGTestError("INVALID_STEP", `Cannot compare Map instances (${label})`);
        }
        if (value instanceof Set) {
            throw new CTGTestError("INVALID_STEP", `Cannot compare Set instances (${label})`);
        }
    }

    _looseDeepEqual(actual, expected, seen, depth) {
        if (depth > CTGTest.MAX_NESTING_DEPTH) {
            throw new CTGTestError("INVALID_STEP", "Comparison exceeds max nesting depth");
        }

        // NaN
        if (typeof actual === "number" && typeof expected === "number") {
            if (Number.isNaN(actual) && Number.isNaN(expected)) return true;
        }

        // Primitives (including BigInt == number via JS ==)
        if (actual == null && expected == null) return true;
        if (actual == null || expected == null) return actual == expected;

        const typeA = typeof actual;
        const typeB = typeof expected;

        // Primitive loose comparison (handles BigInt == number, string == number, etc.)
        if (this._isPrimitive(typeA) && this._isPrimitive(typeB)) {
            // eslint-disable-next-line eqeqeq
            return actual == expected;
        }

        // Category-specific comparisons — if one side matches a special type,
        // both must match or they are unequal (no fallthrough to generic keys)
        const isDate = (v) => v instanceof Date;
        const isRegExp = (v) => v instanceof RegExp;
        const isTypedArray = (v) => ArrayBuffer.isView(v) && !(v instanceof DataView);
        const isDataView = (v) => v instanceof DataView;
        const isArray = (v) => Array.isArray(v);

        // Date
        if (isDate(actual) || isDate(expected)) {
            if (!isDate(actual) || !isDate(expected)) return false;
            return actual.getTime() === expected.getTime();
        }

        // RegExp
        if (isRegExp(actual) || isRegExp(expected)) {
            if (!isRegExp(actual) || !isRegExp(expected)) return false;
            return actual.toString() === expected.toString();
        }

        // Typed arrays — element-by-element with ==
        if (isTypedArray(actual) || isTypedArray(expected)) {
            if (!isTypedArray(actual) || !isTypedArray(expected)) return false;
            if (actual.length !== expected.length) return false;
            for (let i = 0; i < actual.length; i++) {
                // eslint-disable-next-line eqeqeq
                if (!(actual[i] == expected[i])) return false;
            }
            return true;
        }

        // DataView — compare byte-by-byte
        if (isDataView(actual) || isDataView(expected)) {
            if (!isDataView(actual) || !isDataView(expected)) return false;
            if (actual.byteLength !== expected.byteLength) return false;
            for (let i = 0; i < actual.byteLength; i++) {
                if (actual.getUint8(i) !== expected.getUint8(i)) return false;
            }
            return true;
        }

        // Array
        if (isArray(actual) || isArray(expected)) {
            if (!isArray(actual) || !isArray(expected)) return false;
        }

        // Cycle detection for objects — track (actual, expected) pairs on current path
        if (typeA === "object" && typeB === "object") {
            for (const pair of seen) {
                if (pair[0] === actual && pair[1] === expected) {
                    throw new CTGTestError("INVALID_STEP", "Cyclic reference detected during loose comparison");
                }
            }
            seen.push([actual, expected]);
        }

        // Array
        if (isArray(actual)) {
            if (actual.length !== expected.length) { seen.pop(); return false; }
            for (let i = 0; i < actual.length; i++) {
                if (!this._looseDeepEqual(actual[i], expected[i], seen, depth + 1)) { seen.pop(); return false; }
            }
            seen.pop();
            return true;
        }

        // Plain objects / class instances
        if (typeA === "object" && typeB === "object") {
            const keysA = Object.keys(actual);
            const keysB = Object.keys(expected);
            if (keysA.length !== keysB.length) { seen.pop(); return false; }
            for (const key of keysA) {
                if (!Object.prototype.hasOwnProperty.call(expected, key)) { seen.pop(); return false; }
                if (!this._looseDeepEqual(actual[key], expected[key], seen, depth + 1)) { seen.pop(); return false; }
            }
            seen.pop();
            return true;
        }

        // Fallback
        // eslint-disable-next-line eqeqeq
        return actual == expected;
    }

    _isPrimitive(type) {
        return type === "string" || type === "number" || type === "boolean" || type === "bigint";
    }

    // ── Debug Snapshots ──────────────────────────────────────

    _snapshotSubject(subject, depth, seen) {
        if (!seen) seen = new WeakSet();

        if (depth > CTGTest.MAX_NESTING_DEPTH) {
            return "[Truncated: max depth]";
        }

        if (subject === null || subject === undefined) return subject;

        const t = typeof subject;

        if (t === "string" || t === "number" || t === "boolean") return subject;

        if (t === "bigint") return `${subject}n`;

        if (t === "function") return "[Closure]";

        if (t === "symbol") return `symbol(${subject.description})`;

        // Non-serializable built-ins
        if (subject instanceof WeakMap || subject instanceof WeakSet ||
            subject instanceof WeakRef || subject instanceof Promise) {
            return `[${subject.constructor.name}]`;
        }

        if (typeof subject !== "object") return subject;

        // Cycle detection
        if (seen.has(subject)) {
            return `[Circular: ${subject.constructor.name}]`;
        }
        seen.add(subject);

        // Arrays
        if (Array.isArray(subject)) {
            return subject.map((item) => this._snapshotSubject(item, depth + 1, seen));
        }

        // Objects
        const snap = { __class: subject.constructor.name };
        for (const key of Object.keys(subject)) {
            const descriptor = Object.getOwnPropertyDescriptor(subject, key);
            if (!descriptor || !("value" in descriptor)) continue; // skip getters
            snap[key] = this._snapshotSubject(descriptor.value, depth + 1, seen);
        }
        return snap;
    }

    // ── Delivery ─────────────────────────────────────────────

    _deliver(report, config) {
        if (config.output === "return-json") {
            return report;
        }

        let FormatterClass;
        if (config.formatter) {
            FormatterClass = config.formatter;
        } else {
            switch (config.output) {
                case "console":
                case "return":
                    FormatterClass = CTGTestConsoleFormatter;
                    break;
                case "json":
                    FormatterClass = CTGTestJsonFormatter;
                    break;
                case "junit":
                    FormatterClass = CTGTestJunitFormatter;
                    break;
            }
        }

        let formatted;
        try {
            formatted = FormatterClass.format(report, config);
            if (typeof formatted !== "string") {
                throw new TypeError(`Formatter must return a string, got ${typeof formatted}`);
            }
        } catch (err) {
            if (err instanceof CTGTestError) throw err;
            throw new CTGTestError("FORMATTER_ERROR", err.message, {
                formatter: FormatterClass.name,
                exception: CTGTestResult.formatException(err, config.trace),
                report
            });
        }

        if (config.output === "return") {
            return formatted;
        }

        // console, json, junit — write to stdout
        process.stdout.write(formatted + "\n");
        return undefined;
    }
}
