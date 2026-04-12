import CTGTestError from "./CTGTestError.js"; // Typed error class
import CTGTestResult from "./CTGTestResult.js"; // Result factories and utilities
import CTGTestState from "./CTGTestState.js"; // Pipeline state
import CTGTestPredicate from "./CTGTestPredicate.js"; // Predicate type

// Pipeline-based test engine. Sequences operations, evaluates outcomes,
// records results on state. Returns CTGTestState to the caller.
export default class CTGTest {

    /* Static Fields */

    static MAX_CHAIN_DEPTH = 64;

    static VALID_CONFIG_KEYS = ["haltOnFailure", "timeout"];

    static DEFAULT_CONFIG = {
        haltOnFailure: true,
        timeout: 5000
    };

    // Internal operation kind tags.
    static _OP_STAGE = "stage";
    static _OP_ASSERT = "assert";
    static _OP_CHAIN = "chain";
    static _OP_SKIP = "skip";

    // CONSTRUCTOR :: STRING -> this
    // Creates a new pipeline with the given label.
    constructor(label) {
        this._label = typeof label === "string" ? label.trim() : label;
        this._operations = [];
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> STRING
    // Returns the pipeline label.
    get label() { return this._label; }

    /**
     *
     * Instance Methods
     *
     */

    // :: STRING, (CTGTestState -> *) -> this
    // Appends a stage operation. The handler returns the new subject value.
    stage(label, fn) {
        this._operations.push({
            type: CTGTest._OP_STAGE,
            label: typeof label === "string" ? label.trim() : label,
            fn
        });
        return this;
    }

    // :: STRING, (CTGTestState -> *), CTGTestPredicate -> this
    // Appends an assert operation. The handler returns the computed value.
    assert(label, fn, predicate) {
        this._operations.push({
            type: CTGTest._OP_ASSERT,
            label: typeof label === "string" ? label.trim() : label,
            fn,
            predicate
        });
        return this;
    }

    // :: STRING, CTGTest -> this
    // Appends a chain operation targeting a sub-pipeline.
    chain(label, pipeline) {
        this._operations.push({
            type: CTGTest._OP_CHAIN,
            label: typeof label === "string" ? label.trim() : label,
            pipeline
        });
        return this;
    }

    // :: STRING, (CTGTestState -> BOOL)? -> this
    // Appends a skip directive. Gates the target operation by label.
    skip(targetLabel, condition) {
        this._operations.push({
            type: CTGTest._OP_SKIP,
            targetLabel: typeof targetLabel === "string" ? targetLabel.trim() : targetLabel,
            condition: condition !== undefined ? condition : null
        });
        return this;
    }

    // :: CTGTestState | *, OBJECT? -> PROMISE(CTGTestState)
    // Executes the pipeline. Validates config and operations synchronously,
    // then runs operations async. Returns the final CTGTestState.
    async start(subject, config = {}) {
        const resolved = CTGTest._resolveConfig(config);
        CTGTest._validateConfig(resolved);
        CTGTest._validatePipeline(this, 0);

        // Normalize input
        let state;
        if (subject instanceof CTGTestState) {
            state = subject;
        } else {
            state = CTGTestState.init(this._label, subject);
        }
        state.label = this._label;

        await CTGTest._executePipeline(this, state, resolved, []);
        return state;
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: STRING -> ctgTest
    // Creates a new pipeline with the given label.
    static init(label) {
        return new this(label);
    }

    // :: OBJECT -> OBJECT
    // Merges caller config with DEFAULT_CONFIG. Normalizes timeout to integer.
    static _resolveConfig(config) {
        const resolved = { ...CTGTest.DEFAULT_CONFIG, ...config };
        // Check negative before truncation — -0.5 must reject, not truncate to 0
        if (typeof resolved.timeout === "number" && Number.isFinite(resolved.timeout)
            && resolved.timeout >= 0) {
            resolved.timeout = Math.trunc(resolved.timeout);
        }
        return resolved;
    }

    // :: OBJECT -> VOID
    // Validates config keys, boolean types, and timeout value.
    static _validateConfig(config) {
        for (const key of Object.keys(config)) {
            if (!CTGTest.VALID_CONFIG_KEYS.includes(key)) {
                throw new CTGTestError("INVALID_CONFIG",
                    `Unknown config key: ${key}`, { key });
            }
        }

        if (typeof config.haltOnFailure !== "boolean") {
            throw new CTGTestError("INVALID_CONFIG",
                `haltOnFailure must be a boolean, got ${typeof config.haltOnFailure}`,
                { key: "haltOnFailure", value: config.haltOnFailure, expected: "boolean" });
        }

        if (typeof config.timeout !== "number" || !Number.isFinite(config.timeout)) {
            throw new CTGTestError("INVALID_CONFIG",
                `timeout must be a non-negative integer, got ${config.timeout}`,
                { key: "timeout", value: config.timeout, expected: "non-negative integer" });
        }

        if (config.timeout < 0) {
            throw new CTGTestError("INVALID_CONFIG",
                `timeout must be a non-negative integer, got ${config.timeout}`,
                { key: "timeout", value: config.timeout, constraint: ">= 0" });
        }
    }

    // :: CTGTest, INT -> VOID
    // Recursively validates a pipeline. Depth is the current chain nesting depth.
    static _validatePipeline(pipeline, depth) {
        if (depth > CTGTest.MAX_CHAIN_DEPTH) {
            throw new CTGTestError("CHAIN_DEPTH_EXCEEDED",
                `Chain nesting depth exceeds maximum of ${CTGTest.MAX_CHAIN_DEPTH}`,
                { label: pipeline._label, depth, max: CTGTest.MAX_CHAIN_DEPTH });
        }

        const label = pipeline._label;
        if (typeof label !== "string" || label === "") {
            throw new CTGTestError("INVALID_OPERATION",
                "Pipeline label must not be empty",
                { label: "" });
        }

        const seenLabels = new Map();
        const skipTargets = new Map();

        for (let i = 0; i < pipeline._operations.length; i++) {
            const op = pipeline._operations[i];

            if (op.type === CTGTest._OP_SKIP) {
                // Skip validation
                const target = op.targetLabel;
                if (typeof target !== "string" || target === "") {
                    throw new CTGTestError("INVALID_SKIP",
                        "Skip target label must not be empty",
                        { targetLabel: "" });
                }
                if (op.condition !== null && typeof op.condition !== "function") {
                    throw new CTGTestError("INVALID_SKIP",
                        `Skip condition must be a function or null, got ${typeof op.condition}`,
                        { targetLabel: target, got: typeof op.condition });
                }
                if (skipTargets.has(target)) {
                    throw new CTGTestError("INVALID_SKIP",
                        `Duplicate skip directive for target: ${target}`,
                        { targetLabel: target });
                }
                skipTargets.set(target, i);
                continue;
            }

            // Labeled operation validation (stage, assert, chain)
            const opLabel = op.label;
            if (typeof opLabel !== "string" || opLabel === "") {
                throw new CTGTestError("INVALID_OPERATION",
                    "Operation label must not be empty",
                    { label: "", operationIndex: i });
            }
            if (seenLabels.has(opLabel)) {
                throw new CTGTestError("INVALID_OPERATION",
                    `Duplicate operation label: ${opLabel}`,
                    { label: opLabel, firstIndex: seenLabels.get(opLabel), duplicateIndex: i });
            }
            seenLabels.set(opLabel, i);

            if (op.type === CTGTest._OP_STAGE) {
                if (typeof op.fn !== "function") {
                    throw new CTGTestError("INVALID_OPERATION",
                        `Stage fn must be a function, got ${typeof op.fn}`,
                        { label: opLabel, got: typeof op.fn });
                }
            } else if (op.type === CTGTest._OP_ASSERT) {
                if (typeof op.fn !== "function") {
                    throw new CTGTestError("INVALID_OPERATION",
                        `Assert fn must be a function, got ${typeof op.fn}`,
                        { label: opLabel, got: typeof op.fn });
                }
                if (!(op.predicate instanceof CTGTestPredicate)) {
                    const got = typeof op.predicate === "function" ? "function" : typeof op.predicate;
                    const data = { label: opLabel, got };
                    if (typeof op.predicate === "function") {
                        data.hint = "Use CTGTestPredicate.init() or CTGTestPredicates";
                    }
                    throw new CTGTestError("INVALID_EXPECTED_OUTCOME",
                        `Assert predicate must be CTGTestPredicate, got ${got}`,
                        data);
                }
            } else if (op.type === CTGTest._OP_CHAIN) {
                if (!(op.pipeline instanceof CTGTest)) {
                    throw new CTGTestError("INVALID_CHAIN",
                        `Chain target must be CTGTest, got ${typeof op.pipeline}`,
                        { label: opLabel, got: typeof op.pipeline });
                }
                CTGTest._validatePipeline(op.pipeline, depth + 1);
            }
        }

        // Validate skip targets exist
        for (const [target] of skipTargets) {
            if (!seenLabels.has(target)) {
                throw new CTGTestError("INVALID_SKIP",
                    `Skip target does not exist: ${target}`,
                    { targetLabel: target, available: [...seenLabels.keys()] });
            }
        }
    }

    // :: CTGTest, CTGTestState, OBJECT, [STRING] -> PROMISE(VOID)
    // Internal executor. Runs a pipeline's operations against the given state.
    // labelPrefix is the path of parent chain labels to prepend.
    static async _executePipeline(pipeline, state, config, labelPrefix) {
        const S = CTGTestResult.STATUS;
        const timeout = config.timeout;

        // Build skip lookup map
        const skipMap = new Map();
        for (const op of pipeline._operations) {
            if (op.type === CTGTest._OP_SKIP) {
                skipMap.set(op.targetLabel, op.condition);
            }
        }

        // Execute non-skip operations in order
        for (const op of pipeline._operations) {
            if (op.type === CTGTest._OP_SKIP) continue;

            state.computed = undefined;
            const fullLabel = [...labelPrefix, op.label];

            // Check skip map
            if (skipMap.has(op.label)) {
                const condition = skipMap.get(op.label);
                try {
                    if (condition === null || await condition(state)) {
                        state.addResult(CTGTestResult.skippedResult(fullLabel));
                        continue;
                    }
                    // condition returned false — operation runs normally
                } catch (err) {
                    state.addResult(CTGTestResult.stageResult(fullLabel, S.ERROR, err));
                    if (config.haltOnFailure) return;
                    continue;
                }
            }

            // Snapshot framework-owned slots for timeout rollback
            const snapshotSubject = state.subject;
            const snapshotComputed = state.computed;

            if (op.type === CTGTest._OP_STAGE) {
                try {
                    const executeFn = async () => {
                        const value = await op.fn(state);
                        state.subject = value;
                    };
                    if (timeout > 0) {
                        await CTGTest._withTimeout(executeFn, op.label, timeout,
                            state, snapshotSubject, snapshotComputed);
                    } else {
                        await executeFn();
                    }
                    state.addResult(CTGTestResult.stageResult(fullLabel, S.PASS));
                } catch (err) {
                    if (err._isTimeout) {
                        state.subject = snapshotSubject;
                        state.computed = snapshotComputed;
                        state.addResult(CTGTestResult.stageResult(fullLabel, S.ERROR, err));
                    } else {
                        state.addResult(CTGTestResult.stageResult(fullLabel, S.ERROR, err));
                    }
                    if (config.haltOnFailure) return;
                    continue;
                }
            } else if (op.type === CTGTest._OP_ASSERT) {
                let handlerSucceeded = false;
                try {
                    const executeFn = async () => {
                        const value = await op.fn(state);
                        state.computed = value;
                        handlerSucceeded = true;
                        const passed = op.predicate.evaluate(state.computed);
                        return passed;
                    };

                    let passed;
                    if (timeout > 0) {
                        passed = await CTGTest._withTimeout(executeFn, op.label, timeout,
                            state, snapshotSubject, snapshotComputed);
                    } else {
                        passed = await executeFn();
                    }

                    state.addResult(CTGTestResult.assertResult(
                        fullLabel,
                        passed ? S.PASS : S.FAIL,
                        state.computed,
                        op.predicate.expectedOutcome
                    ));

                    if (!passed && config.haltOnFailure) return;
                } catch (err) {
                    if (err._isTimeout) {
                        state.subject = snapshotSubject;
                        state.computed = snapshotComputed;
                        state.addResult(CTGTestResult.assertResult(
                            fullLabel, S.ERROR, undefined, undefined, err));
                    } else if (handlerSucceeded) {
                        // Handler ran, predicate threw
                        state.addResult(CTGTestResult.assertResult(
                            fullLabel, S.ERROR,
                            state.computed,
                            op.predicate.expectedOutcome,
                            err));
                    } else {
                        // Handler threw
                        state.addResult(CTGTestResult.assertResult(
                            fullLabel, S.ERROR, undefined, undefined, err));
                    }
                    if (config.haltOnFailure) return;
                    continue;
                }
            } else if (op.type === CTGTest._OP_CHAIN) {
                const newPrefix = [...labelPrefix, op.label];
                await CTGTest._executePipeline(op.pipeline, state, config, newPrefix);

                // Check if chain produced a halting result
                if (config.haltOnFailure && state.results.length > 0) {
                    const last = state.results[state.results.length - 1];
                    if (!last.skipped && (last.status === S.FAIL || last.status === S.ERROR)) {
                        return;
                    }
                }
            }
        }
    }

    // :: (() -> PROMISE(*)), STRING, INT, CTGTestState, *, * -> PROMISE(*)
    // Races a callable against a timeout. Throws on timeout with _isTimeout flag.
    static async _withTimeout(callable, opLabel, timeoutMs, state, snapSubject, snapComputed) {
        let timer;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => {
                const err = new Error(`Operation '${opLabel}' timed out after ${timeoutMs}ms`);
                err._isTimeout = true;
                reject(err);
            }, timeoutMs);
        });

        try {
            const result = await Promise.race([
                Promise.resolve(callable()),
                timeoutPromise
            ]);
            clearTimeout(timer);
            return result;
        } catch (err) {
            clearTimeout(timer);
            throw err;
        }
    }
}
