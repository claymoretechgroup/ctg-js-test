import { isDeepStrictEqual } from "node:util"; // Deep strict equality comparison
import { performance } from "node:perf_hooks"; // High-resolution timing

import CTGTestError from "./CTGTestError.js"; // Typed error class
import CTGTestResult from "./CTGTestResult.js"; // Result utilities
import CTGTestState from "./CTGTestState.js"; // Pipeline state
import StageStep from "./steps/StageStep.js"; // Stage step type
import AssertStep from "./steps/AssertStep.js"; // Assert step type
import AssertAnyStep from "./steps/AssertAnyStep.js"; // AssertAny step type
import ChainStep from "./steps/ChainStep.js"; // Chain step type
import SkipStep from "./steps/SkipStep.js"; // Skip step type

// Pipeline-based test engine. Sequences steps, evaluates outcomes,
// records results on state. Returns CTGTestState to the caller.
export default class CTGTest {

    /* Static Fields */

    static MAX_CHAIN_DEPTH = 64;
    static MAX_NESTING_DEPTH = 128;

    static VALID_CONFIG_KEYS = ["haltOnFailure", "strict", "timeout"];
    static BOOLEAN_CONFIG_KEYS = ["haltOnFailure", "strict"];

    static DEFAULT_CONFIG = {
        haltOnFailure: true,
        strict: true,
        timeout: 5000
    };

    // CONSTRUCTOR :: STRING -> this
    constructor(name) {
        this._name = name.trim();
        this._steps = [];
    }

    /**
     *
     * Properties
     *
     */

    get name() { return this._name; }
    get steps() { return this._steps; }

    /**
     *
     * Builder Methods
     *
     */

    // :: STRING, (CTGTestState -> CTGTestState), FUNCTION? -> this
    stage(name, fn, errorHandler = null) {
        this._steps.push(new StageStep(name, fn, errorHandler));
        return this;
    }

    // :: STRING, (CTGTestState -> *), *, FUNCTION? -> this
    assert(name, fn, expected, errorHandler = null) {
        this._steps.push(new AssertStep(name, fn, expected, errorHandler));
        return this;
    }

    // :: STRING, (CTGTestState -> *), [*], FUNCTION? -> this
    assertAny(name, fn, candidates, errorHandler = null) {
        this._steps.push(new AssertAnyStep(name, fn, candidates, errorHandler));
        return this;
    }

    // :: STRING, CTGTest -> this
    chain(name, pipeline) {
        this._steps.push(new ChainStep(name, pipeline));
        return this;
    }

    // :: STRING, STRING, (CTGTestState -> BOOL)? -> this
    skip(name, targetName, predicate = null) {
        this._steps.push(new SkipStep(name, targetName, predicate));
        return this;
    }

    // :: *, OBJECT? -> PROMISE(CTGTestState)
    // Executes the pipeline. Returns the final state.
    async start(subject, config = {}) {
        const resolved = this._resolveConfig(config);
        this._validateConfig(resolved);
        this._validateSteps();

        // Normalize input — wrap raw value in CTGTestState
        let state;
        if (subject instanceof CTGTestState) {
            state = subject;
        } else {
            state = new CTGTestState({ subject, config: resolved, name: this._name });
        }
        state.config = resolved;
        state.name = this._name;

        const timeout = resolved.timeout;

        // Execute steps sequentially
        for (const step of this._steps) {
            // Skip step sets skipTargets, no result produced
            if (step.producesResult === false) {
                state = await step.execute(state);
                continue;
            }

            // Check if this step is targeted for skipping
            const trimmedName = step.name.trim();
            if (state.skipTargets[trimmedName]) {
                state.results.push(
                    CTGTestResult.stepResult(step.type, trimmedName, "skip", 0));
                continue;
            }

            // Reset handoff fields
            state._lastStepStatus = null;
            state._lastStepMessage = null;
            state._chainResult = null;
            state.actual = undefined;

            // Execute with timeout
            const startTime = performance.now();
            if (timeout > 0) {
                state = await this._withTimeout(
                    () => step.execute(state), step.name, timeout);
            } else {
                state = await step.execute(state);
            }
            const durationMs = Math.round(performance.now() - startTime);

            // Pipeline evaluates outcome and builds result
            const result = this._evaluateStep(step, state, durationMs, resolved);
            state.results.push(result);

            // Halt check
            if (resolved.haltOnFailure
                && (result.status === "fail" || result.status === "error")) {
                break;
            }
        }

        // Clean up internal fields
        delete state._lastStepStatus;
        delete state._lastStepMessage;
        delete state._chainResult;

        return state;
    }

    // :: *, *, BOOL -> BOOL
    // Comparison. The pipeline calls this; steps do not.
    compare(actual, expected, strict) {
        this._checkUncomparable(actual, "actual");
        this._checkUncomparable(expected, "expected");

        if (strict) {
            return isDeepStrictEqual(actual, expected);
        }

        return this._looseDeepEqual(actual, expected, [], 0);
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: STRING -> ctgTest
    static init(name) {
        return new this(name);
    }

    /**
     *
     * Private Methods
     *
     */

    // :: CTGTestStep, CTGTestState, INT, OBJECT -> OBJECT
    // Pipeline judges the step's outcome and builds the result object.
    // Dispatches on expectedOutcome (declared by the step) and chain results,
    // not on step type strings. Steps compute; the pipeline decides pass/fail.
    _evaluateStep(step, state, durationMs, config) {
        const name = step.name.trim();
        const outcome = step.expectedOutcome;

        // Chain results — composition with nested results
        if (state._chainResult) {
            const chainResult = state._chainResult;
            const counts = CTGTestResult.countSteps(chainResult.steps);
            return CTGTestResult.chainResult(
                chainResult.name, chainResult.status, durationMs,
                CTGTestResult.chainMessage(counts.failed, counts.errored, counts.total),
                null, chainResult.steps, counts);
        }

        // Error during execution — applies to any step type
        if (state._lastStepStatus === "error") {
            if (outcome && outcome.type === "value") {
                return CTGTestResult.assertResult(
                    name, "error", durationMs, state.actual,
                    outcome.expected, state._lastStepMessage);
            }
            if (outcome && outcome.type === "candidates") {
                return CTGTestResult.assertAnyResult(
                    name, "error", durationMs, state.actual,
                    outcome.candidates, state._lastStepMessage);
            }
            return CTGTestResult.stepResult(
                step.type, name, "error", durationMs, state._lastStepMessage);
        }

        // Recovery — error handler produced a value
        if (state._lastStepStatus === "recovered") {
            if (outcome && outcome.type === "value") {
                const matched = this.compare(state.actual, outcome.expected, config.strict);
                return CTGTestResult.assertResult(
                    name, matched ? "recovered" : "fail", durationMs,
                    state.actual, outcome.expected,
                    matched ? "error handler invoked" : null);
            }
            if (outcome && outcome.type === "candidates") {
                let matched = false;
                for (const c of outcome.candidates) {
                    if (this.compare(state.actual, c, config.strict)) { matched = true; break; }
                }
                return CTGTestResult.assertAnyResult(
                    name, matched ? "recovered" : "fail", durationMs,
                    state.actual, outcome.candidates);
            }
            return CTGTestResult.stepResult(
                step.type, name, "recovered", durationMs, "error handler invoked");
        }

        // Comparison — step declared an expected outcome
        if (outcome && outcome.type === "value") {
            const matched = this.compare(state.actual, outcome.expected, config.strict);
            return CTGTestResult.assertResult(
                name, matched ? "pass" : "fail", durationMs,
                state.actual, outcome.expected,
                matched ? null
                    : `expected ${CTGTestResult.formatValue(outcome.expected)} but got ${CTGTestResult.formatValue(state.actual)}`);
        }

        if (outcome && outcome.type === "candidates") {
            const candidates = outcome.candidates;
            if (candidates.length === 0) {
                return CTGTestResult.assertAnyResult(
                    name, "fail", durationMs, state.actual, candidates, "empty candidate set");
            }
            let matched = false;
            for (const c of candidates) {
                if (this.compare(state.actual, c, config.strict)) { matched = true; break; }
            }
            return CTGTestResult.assertAnyResult(
                name, matched ? "pass" : "fail", durationMs, state.actual, candidates);
        }

        // No comparison needed — transform step (stage, etc.)
        return CTGTestResult.stepResult(
            step.type, name, "pass", durationMs);
    }

    // :: OBJECT -> OBJECT
    _resolveConfig(config) {
        const resolved = { ...CTGTest.DEFAULT_CONFIG, ...config };
        if (typeof resolved.timeout !== "number" || !Number.isFinite(resolved.timeout)) {
            throw new CTGTestError("INVALID_CONFIG",
                `timeout must be a non-negative integer, got ${resolved.timeout}`);
        }
        resolved.timeout = Math.trunc(resolved.timeout);
        return resolved;
    }

    // :: OBJECT -> VOID
    _validateConfig(config) {
        for (const key of Object.keys(config)) {
            if (!CTGTest.VALID_CONFIG_KEYS.includes(key)) {
                throw new CTGTestError("INVALID_CONFIG", `Unknown config key: ${key}`);
            }
        }

        for (const key of CTGTest.BOOLEAN_CONFIG_KEYS) {
            if (typeof config[key] !== "boolean") {
                throw new CTGTestError("INVALID_CONFIG", `${key} must be a boolean`);
            }
        }

        if (config.timeout < 0) {
            throw new CTGTestError("INVALID_CONFIG",
                `timeout must be a non-negative integer, got ${config.timeout}`);
        }
    }

    // :: VOID -> VOID
    _validateSteps() {
        if (this._name.trim().length === 0) {
            throw new CTGTestError("INVALID_STEP", "Test name must not be empty");
        }

        const names = new Set();
        const skipTargets = new Map();
        const stepNames = new Set();
        const stepIndices = new Map();

        for (let i = 0; i < this._steps.length; i++) {
            const step = this._steps[i];
            step.validate();

            const trimmed = step.name.trim();
            if (names.has(trimmed)) {
                throw new CTGTestError("INVALID_STEP", `Duplicate step name: ${trimmed}`);
            }
            names.add(trimmed);

            if (step.type === "skip") {
                const target = step.targetName.trim();
                if (skipTargets.has(target)) {
                    throw new CTGTestError("INVALID_SKIP",
                        `Duplicate skip directive: ${target}`);
                }
                skipTargets.set(target, i);
            } else {
                stepNames.add(trimmed);
                stepIndices.set(trimmed, i);
            }
        }

        for (const [target, skipIndex] of skipTargets) {
            if (!stepNames.has(target)) {
                throw new CTGTestError("INVALID_SKIP",
                    `Skip target does not exist: ${target}`);
            }
            const targetIndex = stepIndices.get(target);
            if (skipIndex >= targetIndex) {
                throw new CTGTestError("INVALID_SKIP",
                    `Skip must appear before target: ${target}`);
            }
        }
    }

    // :: FUNCTION, STRING, INT -> PROMISE(*)
    // Races a callable against a timeout. Throws INVALID_STEP on timeout.
    async _withTimeout(callable, stepName, timeoutMs) {
        const callablePromise = Promise.resolve(callable());
        let timer;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(
                () => reject(new CTGTestError("INVALID_STEP",
                    `Step '${stepName}' timed out after ${timeoutMs}ms`,
                    { step: stepName, timeout: timeoutMs })),
                timeoutMs
            );
        });

        try {
            const result = await Promise.race([callablePromise, timeoutPromise]);
            clearTimeout(timer);
            return result;
        } catch (err) {
            clearTimeout(timer);
            callablePromise.catch(() => {});
            throw err;
        }
    }

    // :: *, STRING -> VOID
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

    // :: *, *, [ARRAY], INT -> BOOL
    _looseDeepEqual(actual, expected, seen, depth) {
        if (depth > CTGTest.MAX_NESTING_DEPTH) {
            throw new CTGTestError("INVALID_STEP", "Comparison exceeds max nesting depth");
        }

        if (typeof actual === "number" && typeof expected === "number") {
            if (Number.isNaN(actual) && Number.isNaN(expected)) return true;
        }

        if (actual == null && expected == null) return true;
        if (actual == null || expected == null) return actual == expected;

        const typeA = typeof actual;
        const typeB = typeof expected;

        if (this._isPrimitive(typeA) && this._isPrimitive(typeB)) {
            return actual == expected;
        }

        const isDate = (v) => v instanceof Date;
        const isRegExp = (v) => v instanceof RegExp;
        const isTypedArray = (v) => ArrayBuffer.isView(v) && !(v instanceof DataView);
        const isDataView = (v) => v instanceof DataView;
        const isArray = (v) => Array.isArray(v);

        if (isDate(actual) || isDate(expected)) {
            if (!isDate(actual) || !isDate(expected)) return false;
            return actual.getTime() === expected.getTime();
        }

        if (isRegExp(actual) || isRegExp(expected)) {
            if (!isRegExp(actual) || !isRegExp(expected)) return false;
            return actual.toString() === expected.toString();
        }

        if (isTypedArray(actual) || isTypedArray(expected)) {
            if (!isTypedArray(actual) || !isTypedArray(expected)) return false;
            if (actual.length !== expected.length) return false;
            for (let i = 0; i < actual.length; i++) {
                if (!(actual[i] == expected[i])) return false;
            }
            return true;
        }

        if (isDataView(actual) || isDataView(expected)) {
            if (!isDataView(actual) || !isDataView(expected)) return false;
            if (actual.byteLength !== expected.byteLength) return false;
            for (let i = 0; i < actual.byteLength; i++) {
                if (actual.getUint8(i) !== expected.getUint8(i)) return false;
            }
            return true;
        }

        if (isArray(actual) || isArray(expected)) {
            if (!isArray(actual) || !isArray(expected)) return false;
        }

        if (typeA === "object" && typeB === "object") {
            for (const pair of seen) {
                if (pair[0] === actual && pair[1] === expected) {
                    throw new CTGTestError("INVALID_STEP",
                        "Cyclic reference detected during loose comparison");
                }
            }
            seen.push([actual, expected]);
        }

        if (isArray(actual)) {
            if (actual.length !== expected.length) { seen.pop(); return false; }
            for (let i = 0; i < actual.length; i++) {
                if (!this._looseDeepEqual(actual[i], expected[i], seen, depth + 1)) {
                    seen.pop(); return false;
                }
            }
            seen.pop();
            return true;
        }

        if (typeA === "object" && typeB === "object") {
            const keysA = Object.keys(actual);
            const keysB = Object.keys(expected);
            if (keysA.length !== keysB.length) { seen.pop(); return false; }
            for (const key of keysA) {
                if (!Object.prototype.hasOwnProperty.call(expected, key)) {
                    seen.pop(); return false;
                }
                if (!this._looseDeepEqual(actual[key], expected[key], seen, depth + 1)) {
                    seen.pop(); return false;
                }
            }
            seen.pop();
            return true;
        }

        return actual == expected;
    }

    // :: STRING -> BOOL
    _isPrimitive(type) {
        return type === "string" || type === "number"
            || type === "boolean" || type === "bigint";
    }
}
