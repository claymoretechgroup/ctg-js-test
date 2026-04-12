import { describe, it, expect } from "vitest";
import CTGTest from "../src/CTGTest.js";
import CTGTestPredicate from "../src/CTGTestPredicate.js";
import CTGTestPredicates from "../src/CTGTestPredicates.js";
import CTGTestResult from "../src/CTGTestResult.js";
import CTGTestError from "../src/CTGTestError.js";

// Tests derived from spec.v2.2.md sections 2.5 (Config), 4.3 (Phase 1 validation), 4.4 (Config Validation Details)
// realizes: Core Semantics > Procedures > CONFIG
// realizes: Left to Language-Specific Specs > Config object validation details

const STATUS = CTGTestResult.STATUS;

// ── Helpers ────────────────────────────────────────────────────────

// :: *, (* -> BOOL) -> CTGTestPredicate
const predicate = (expected, fn) => CTGTestPredicate.init(expected, fn);

// :: * -> CTGTestPredicate
const equals = (expected) => predicate(expected, (v) => v === expected);

// :: * -> CTGTestPredicate
// Always fails — used to produce FAIL results for haltOnFailure tests.
const alwaysFails = () => predicate("never", () => false);

// ── 1. Default Config Behavior ────────────────────────────────────

describe("pipeline config: default config behavior", () => {

    it("DEFAULT_CONFIG has haltOnFailure true", () => {
        expect(CTGTest.DEFAULT_CONFIG.haltOnFailure).toBe(true);
    });

    it("DEFAULT_CONFIG has timeout 5000", () => {
        expect(CTGTest.DEFAULT_CONFIG.timeout).toBe(5000);
    });

    it("DEFAULT_CONFIG is a plain object with exactly two keys", () => {
        const keys = Object.keys(CTGTest.DEFAULT_CONFIG);
        expect(keys).toHaveLength(2);
        expect(keys).toContain("haltOnFailure");
        expect(keys).toContain("timeout");
    });
});

// ── 2. haltOnFailure: true ────────────────────────────────────────

describe("pipeline config: haltOnFailure true (default)", () => {

    it("stops after first FAIL result", async () => {
        const state = await CTGTest.init("halt on fail")
            .assert("will fail", (s) => s.subject, alwaysFails())
            .assert("never reached", (s) => s.subject, equals(1))
            .start(1);
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.FAIL);
    });

    it("stops after first ERROR result", async () => {
        const state = await CTGTest.init("halt on error")
            .stage("throws", () => { throw new Error("boom"); })
            .stage("never reached", (s) => s.subject + 1)
            .start(0);
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.ERROR);
    });

    it("explicit haltOnFailure true stops on FAIL", async () => {
        const state = await CTGTest.init("explicit halt")
            .assert("will fail", (s) => s.subject, alwaysFails())
            .stage("never reached", (s) => s.subject + 1)
            .start(1, { haltOnFailure: true });
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.FAIL);
    });

    it("does not halt on PASS results", async () => {
        const state = await CTGTest.init("passes through")
            .stage("first", (s) => s.subject + 1)
            .stage("second", (s) => s.subject + 1)
            .start(0);
        expect(state.results).toHaveLength(2);
        expect(state.results[0].status).toBe(STATUS.PASS);
        expect(state.results[1].status).toBe(STATUS.PASS);
    });
});

// ── 3. haltOnFailure: false ───────────────────────────────────────

describe("pipeline config: haltOnFailure false", () => {

    it("continues through FAIL results", async () => {
        const state = await CTGTest.init("continue on fail")
            .assert("fails", (s) => s.subject, alwaysFails())
            .assert("also fails", (s) => s.subject, alwaysFails())
            .start(1, { haltOnFailure: false });
        expect(state.results).toHaveLength(2);
        expect(state.results[0].status).toBe(STATUS.FAIL);
        expect(state.results[1].status).toBe(STATUS.FAIL);
    });

    it("continues through ERROR results", async () => {
        const state = await CTGTest.init("continue on error")
            .stage("throws", () => { throw new Error("first"); })
            .stage("also throws", () => { throw new Error("second"); })
            .start(0, { haltOnFailure: false });
        expect(state.results).toHaveLength(2);
        expect(state.results[0].status).toBe(STATUS.ERROR);
        expect(state.results[1].status).toBe(STATUS.ERROR);
    });

    it("continues through mixed FAIL and ERROR results", async () => {
        const state = await CTGTest.init("mixed failures")
            .stage("throws", () => { throw new Error("error"); })
            .assert("fails", (s) => s.subject, alwaysFails())
            .stage("throws again", () => { throw new Error("another"); })
            .start(0, { haltOnFailure: false });
        expect(state.results).toHaveLength(3);
        expect(state.results[0].status).toBe(STATUS.ERROR);
        expect(state.results[1].status).toBe(STATUS.FAIL);
        expect(state.results[2].status).toBe(STATUS.ERROR);
    });

    it("all results are recorded in order", async () => {
        const state = await CTGTest.init("ordered results")
            .stage("pass", (s) => s.subject + 1)
            .assert("fail", (s) => s.subject, alwaysFails())
            .stage("error", () => { throw new Error("oops"); })
            .stage("pass again", (s) => s.subject + 1)
            .start(0, { haltOnFailure: false });
        expect(state.results).toHaveLength(4);
        expect(state.results[0].status).toBe(STATUS.PASS);
        expect(state.results[1].status).toBe(STATUS.FAIL);
        expect(state.results[2].status).toBe(STATUS.ERROR);
        expect(state.results[3].status).toBe(STATUS.PASS);
    });
});

// ── 4. Config Validation Errors ───────────────────────────────────

describe("pipeline config: validation errors", () => {

    describe("unknown keys", () => {

        it("throws INVALID_CONFIG for a single unknown key", async () => {
            const pipeline = CTGTest.init("unknown key")
                .stage("step", (s) => s.subject);
            await expect(pipeline.start(1, { unknownKey: true }))
                .rejects.toThrow(CTGTestError);
            try {
                await pipeline.start(1, { unknownKey: true });
            } catch (err) {
                expect(err.type).toBe("INVALID_CONFIG");
                expect(err.code).toBe(1002);
                expect(err.data.key).toBe("unknownKey");
            }
        });

        it("throws INVALID_CONFIG for unknown key alongside valid keys", async () => {
            const pipeline = CTGTest.init("mixed keys")
                .stage("step", (s) => s.subject);
            await expect(pipeline.start(1, { haltOnFailure: true, extra: 42 }))
                .rejects.toThrow(CTGTestError);
            try {
                await pipeline.start(1, { haltOnFailure: true, extra: 42 });
            } catch (err) {
                expect(err.type).toBe("INVALID_CONFIG");
                expect(err.code).toBe(1002);
            }
        });
    });

    describe("haltOnFailure wrong type", () => {

        it("throws INVALID_CONFIG when haltOnFailure is a string", async () => {
            const pipeline = CTGTest.init("string halt")
                .stage("step", (s) => s.subject);
            try {
                await pipeline.start(1, { haltOnFailure: "true" });
                expect.unreachable("should have thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.type).toBe("INVALID_CONFIG");
                expect(err.code).toBe(1002);
                expect(err.data.key).toBe("haltOnFailure");
                expect(err.data.value).toBe("true");
                expect(err.data.expected).toBe("boolean");
            }
        });

        it("throws INVALID_CONFIG when haltOnFailure is a number", async () => {
            const pipeline = CTGTest.init("number halt")
                .stage("step", (s) => s.subject);
            try {
                await pipeline.start(1, { haltOnFailure: 1 });
                expect.unreachable("should have thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.type).toBe("INVALID_CONFIG");
                expect(err.code).toBe(1002);
                expect(err.data.key).toBe("haltOnFailure");
                expect(err.data.value).toBe(1);
                expect(err.data.expected).toBe("boolean");
            }
        });

        it("throws INVALID_CONFIG when haltOnFailure is null", async () => {
            const pipeline = CTGTest.init("null halt")
                .stage("step", (s) => s.subject);
            try {
                await pipeline.start(1, { haltOnFailure: null });
                expect.unreachable("should have thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.type).toBe("INVALID_CONFIG");
                expect(err.code).toBe(1002);
                expect(err.data.key).toBe("haltOnFailure");
            }
        });

        it("throws INVALID_CONFIG when haltOnFailure is undefined", async () => {
            const pipeline = CTGTest.init("undefined halt")
                .stage("step", (s) => s.subject);
            try {
                await pipeline.start(1, { haltOnFailure: undefined });
                expect.unreachable("should have thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.type).toBe("INVALID_CONFIG");
                expect(err.code).toBe(1002);
                expect(err.data.key).toBe("haltOnFailure");
            }
        });
    });

    describe("timeout wrong type", () => {

        it("throws INVALID_CONFIG when timeout is a string", async () => {
            const pipeline = CTGTest.init("string timeout")
                .stage("step", (s) => s.subject);
            try {
                await pipeline.start(1, { timeout: "5000" });
                expect.unreachable("should have thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.type).toBe("INVALID_CONFIG");
                expect(err.code).toBe(1002);
                expect(err.data.key).toBe("timeout");
                expect(err.data.value).toBe("5000");
                expect(err.data.expected).toBe("non-negative integer");
            }
        });

        it("throws INVALID_CONFIG when timeout is a boolean", async () => {
            const pipeline = CTGTest.init("boolean timeout")
                .stage("step", (s) => s.subject);
            try {
                await pipeline.start(1, { timeout: true });
                expect.unreachable("should have thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.type).toBe("INVALID_CONFIG");
                expect(err.code).toBe(1002);
                expect(err.data.key).toBe("timeout");
            }
        });

        it("throws INVALID_CONFIG when timeout is null", async () => {
            const pipeline = CTGTest.init("null timeout")
                .stage("step", (s) => s.subject);
            try {
                await pipeline.start(1, { timeout: null });
                expect.unreachable("should have thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.type).toBe("INVALID_CONFIG");
                expect(err.code).toBe(1002);
                expect(err.data.key).toBe("timeout");
            }
        });

        it("throws INVALID_CONFIG when timeout is NaN", async () => {
            const pipeline = CTGTest.init("NaN timeout")
                .stage("step", (s) => s.subject);
            try {
                await pipeline.start(1, { timeout: NaN });
                expect.unreachable("should have thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.type).toBe("INVALID_CONFIG");
                expect(err.code).toBe(1002);
                expect(err.data.key).toBe("timeout");
                expect(err.data.value).toBeNaN();
                expect(err.data.expected).toBe("non-negative integer");
            }
        });

        it("throws INVALID_CONFIG when timeout is Infinity", async () => {
            const pipeline = CTGTest.init("Infinity timeout")
                .stage("step", (s) => s.subject);
            try {
                await pipeline.start(1, { timeout: Infinity });
                expect.unreachable("should have thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.type).toBe("INVALID_CONFIG");
                expect(err.code).toBe(1002);
                expect(err.data.key).toBe("timeout");
                expect(err.data.value).toBe(Infinity);
                expect(err.data.expected).toBe("non-negative integer");
            }
        });

        it("throws INVALID_CONFIG when timeout is negative Infinity", async () => {
            const pipeline = CTGTest.init("neg Infinity timeout")
                .stage("step", (s) => s.subject);
            try {
                await pipeline.start(1, { timeout: -Infinity });
                expect.unreachable("should have thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.type).toBe("INVALID_CONFIG");
                expect(err.code).toBe(1002);
                expect(err.data.key).toBe("timeout");
            }
        });
    });

    describe("timeout negative", () => {

        it("throws INVALID_CONFIG when timeout is negative", async () => {
            const pipeline = CTGTest.init("negative timeout")
                .stage("step", (s) => s.subject);
            try {
                await pipeline.start(1, { timeout: -1 });
                expect.unreachable("should have thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.type).toBe("INVALID_CONFIG");
                expect(err.code).toBe(1002);
                expect(err.data.key).toBe("timeout");
                expect(err.data.value).toBe(-1);
                expect(err.data.constraint).toBe(">= 0");
            }
        });

        it("throws INVALID_CONFIG when timeout is -0.5 (negative fractional)", async () => {
            const pipeline = CTGTest.init("neg fractional timeout")
                .stage("step", (s) => s.subject);
            try {
                await pipeline.start(1, { timeout: -0.5 });
                expect.unreachable("should have thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.type).toBe("INVALID_CONFIG");
                expect(err.code).toBe(1002);
                expect(err.data.key).toBe("timeout");
                expect(err.data.value).toBe(-0.5);
            }
        });
    });
});

// ── 5. Timeout Value of 0 ─────────────────────────────────────────

describe("pipeline config: timeout 0 disables timeout", () => {

    it("timeout 0 is a valid config value", async () => {
        const state = await CTGTest.init("zero timeout")
            .stage("identity", (s) => s.subject)
            .start(42, { timeout: 0 });
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.PASS);
    });

    it("timeout 0 does not throw INVALID_CONFIG", async () => {
        const pipeline = CTGTest.init("zero ok")
            .stage("step", (s) => s.subject);
        await expect(pipeline.start(1, { timeout: 0 })).resolves.toBeDefined();
    });
});

// ── 6. Fractional Timeout Truncation ──────────────────────────────

describe("pipeline config: fractional timeout truncation", () => {

    it("fractional timeout is truncated via Math.trunc, not rejected", async () => {
        // 5000.9 should be truncated to 5000, not rejected
        const state = await CTGTest.init("fractional timeout")
            .stage("identity", (s) => s.subject)
            .start(1, { timeout: 5000.9 });
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.PASS);
    });

    it("0.7 truncates to 0 (disables timeout)", async () => {
        const state = await CTGTest.init("small fraction")
            .stage("identity", (s) => s.subject)
            .start(1, { timeout: 0.7 });
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.PASS);
    });

    it("1.999 truncates to 1 (valid non-zero timeout)", async () => {
        const state = await CTGTest.init("truncate to 1")
            .stage("identity", (s) => s.subject)
            .start(1, { timeout: 1.999 });
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.PASS);
    });
});

// ── 7. Empty Config and Omitted Config ────────────────────────────

describe("pipeline config: empty and omitted config use defaults", () => {

    it("empty object {} uses all defaults", async () => {
        // haltOnFailure defaults to true — pipeline should halt after first failure
        const state = await CTGTest.init("empty config")
            .assert("will fail", (s) => s.subject, alwaysFails())
            .assert("never reached", (s) => s.subject, equals(1))
            .start(1, {});
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.FAIL);
    });

    it("omitting config entirely uses all defaults", async () => {
        // haltOnFailure defaults to true — pipeline should halt after first failure
        const state = await CTGTest.init("no config")
            .assert("will fail", (s) => s.subject, alwaysFails())
            .assert("never reached", (s) => s.subject, equals(1))
            .start(1);
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.FAIL);
    });

    it("empty config pipeline passes all stages normally", async () => {
        const state = await CTGTest.init("empty config pass")
            .stage("first", (s) => s.subject + 1)
            .stage("second", (s) => s.subject + 1)
            .start(0, {});
        expect(state.results).toHaveLength(2);
        expect(state.results[0].status).toBe(STATUS.PASS);
        expect(state.results[1].status).toBe(STATUS.PASS);
        expect(state.subject).toBe(2);
    });

    it("omitted config pipeline passes all stages normally", async () => {
        const state = await CTGTest.init("omitted config pass")
            .stage("first", (s) => s.subject + 1)
            .stage("second", (s) => s.subject + 1)
            .start(0);
        expect(state.results).toHaveLength(2);
        expect(state.results[0].status).toBe(STATUS.PASS);
        expect(state.results[1].status).toBe(STATUS.PASS);
        expect(state.subject).toBe(2);
    });
});
