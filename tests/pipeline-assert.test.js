import { describe, it, expect } from "vitest";
import CTGTest from "../src/CTGTest.js";
import CTGTestPredicate from "../src/CTGTestPredicate.js";
import CTGTestResult from "../src/CTGTestResult.js";
import CTGTestError from "../src/CTGTestError.js";

// Tests derived from spec.v2.2.md sections 2.5 (CTGTest), 2.3 (CTGTestPredicate), 4.3 (validation)
// realizes: Core Semantics > Procedures > ASSERT

const { STATUS } = CTGTestResult;

// ── Helpers ────────────────────────────────────────────────────────

// :: *, (* -> BOOL) -> CTGTestPredicate
const predicate = (expected, fn) => CTGTestPredicate.init(expected, fn);

// :: * -> CTGTestPredicate
// Convenience: predicate that checks strict equality against expected.
const equals = (expected) => predicate(expected, (v) => v === expected);

// ── 1. Passing Assertion ───────────────────────────────────────────

describe("assert: passing assertion", () => {

    it("predicate returns true — result status is PASS", async () => {
        const state = await CTGTest.init("pass test")
            .assert("is ten", (s) => s.subject, equals(10))
            .start(10);
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.PASS);
    });

    it("handler computes derived value — predicate evaluates computed", async () => {
        const state = await CTGTest.init("derived")
            .assert("length", (s) => s.subject.length, equals(3))
            .start("abc");
        expect(state.results[0].status).toBe(STATUS.PASS);
    });
});

// ── 2. Failing Assertion ───────────────────────────────────────────

describe("assert: failing assertion", () => {

    it("predicate returns false — result status is FAIL", async () => {
        const state = await CTGTest.init("fail test")
            .assert("is ten", (s) => s.subject, equals(10))
            .start(99, { haltOnFailure: false });
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.FAIL);
    });

    it("multiple failing asserts recorded when haltOnFailure is false", async () => {
        const state = await CTGTest.init("multi fail")
            .assert("first", (s) => s.subject, equals(1))
            .assert("second", (s) => s.subject, equals(2))
            .start(0, { haltOnFailure: false });
        expect(state.results).toHaveLength(2);
        expect(state.results[0].status).toBe(STATUS.FAIL);
        expect(state.results[1].status).toBe(STATUS.FAIL);
    });
});

// ── 3. Result Field Population ─────────────────────────────────────

describe("assert: result fields", () => {

    it("computedValue is the value returned by the handler", async () => {
        const state = await CTGTest.init("computed")
            .assert("len", (s) => s.subject.length, equals(5))
            .start("hello");
        expect(state.results[0].computedValue).toBe(5);
    });

    it("expectedOutcome comes from the predicate", async () => {
        const pred = predicate(42, (v) => v === 42);
        const state = await CTGTest.init("expected")
            .assert("check", (s) => s.subject, pred)
            .start(42);
        expect(state.results[0].expectedOutcome).toBe(42);
    });

    it("computedValue and expectedOutcome populated on FAIL", async () => {
        const pred = predicate("expected-value", (v) => v === "expected-value");
        const state = await CTGTest.init("fail fields")
            .assert("check", (s) => s.subject, pred)
            .start("actual-value", { haltOnFailure: false });
        expect(state.results[0].status).toBe(STATUS.FAIL);
        expect(state.results[0].computedValue).toBe("actual-value");
        expect(state.results[0].expectedOutcome).toBe("expected-value");
    });

    it("label array contains the assert label", async () => {
        const state = await CTGTest.init("label test")
            .assert("my assert", (s) => s.subject, equals(1))
            .start(1);
        expect(state.results[0].label).toContain("my assert");
    });

    it("error field is undefined on PASS", async () => {
        const state = await CTGTest.init("no error")
            .assert("ok", (s) => s.subject, equals(1))
            .start(1);
        expect(state.results[0].error).toBeUndefined();
    });
});

// ── 4. Handler Error ───────────────────────────────────────────────

describe("assert: handler throws", () => {

    it("handler exception produces ERROR status", async () => {
        const state = await CTGTest.init("handler error")
            .assert("boom", () => { throw new Error("handler exploded"); }, equals(1))
            .start(1, { haltOnFailure: false });
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.ERROR);
    });

    it("error field contains the thrown exception", async () => {
        const thrown = new Error("specific error");
        const state = await CTGTest.init("error field")
            .assert("boom", () => { throw thrown; }, equals(1))
            .start(1, { haltOnFailure: false });
        expect(state.results[0].error).toBe(thrown);
    });

    it("handler error with non-Error value still produces ERROR", async () => {
        const state = await CTGTest.init("non-error throw")
            .assert("string throw", () => { throw "not an error"; }, equals(1))
            .start(1, { haltOnFailure: false });
        expect(state.results[0].status).toBe(STATUS.ERROR);
    });
});

// ── 5. Predicate Error ─────────────────────────────────────────────

describe("assert: predicate.evaluate() throws", () => {

    it("predicate exception produces ERROR status", async () => {
        const badPred = predicate(1, () => { throw new Error("predicate broke"); });
        const state = await CTGTest.init("pred error")
            .assert("check", (s) => s.subject, badPred)
            .start(1, { haltOnFailure: false });
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.ERROR);
    });

    it("predicate error field contains the thrown exception", async () => {
        const thrown = new Error("eval failed");
        const badPred = predicate(1, () => { throw thrown; });
        const state = await CTGTest.init("pred error field")
            .assert("check", (s) => s.subject, badPred)
            .start(1, { haltOnFailure: false });
        expect(state.results[0].error).toBe(thrown);
    });
});

// ── 6. Subject Unchanged ───────────────────────────────────────────

describe("assert: does not modify subject", () => {

    it("subject is the same before and after assert", async () => {
        const original = { value: 42 };
        const state = await CTGTest.init("subject unchanged")
            .assert("check", (s) => s.subject.value, equals(42))
            .start(original);
        expect(state.subject).toBe(original);
        expect(state.subject.value).toBe(42);
    });

    it("subject unchanged after failing assert", async () => {
        const state = await CTGTest.init("subject on fail")
            .assert("wrong", (s) => s.subject, equals(999))
            .start(5, { haltOnFailure: false });
        expect(state.subject).toBe(5);
    });

    it("subject unchanged after handler error", async () => {
        const state = await CTGTest.init("subject on error")
            .assert("boom", () => { throw new Error("oops"); }, equals(1))
            .start(5, { haltOnFailure: false });
        expect(state.subject).toBe(5);
    });

    it("multiple asserts do not alter subject", async () => {
        const state = await CTGTest.init("multi assert subject")
            .assert("first", (s) => s.subject + 1, equals(6))
            .assert("second", (s) => s.subject * 2, equals(10))
            .start(5);
        expect(state.subject).toBe(5);
    });
});

// ── 7. Async Handlers ──────────────────────────────────────────────

describe("assert: async handlers", () => {

    it("async handler returning promise — PASS", async () => {
        const state = await CTGTest.init("async pass")
            .assert("async check", async (s) => s.subject, equals(10))
            .start(10);
        expect(state.results[0].status).toBe(STATUS.PASS);
    });

    it("async handler returning promise — FAIL", async () => {
        const state = await CTGTest.init("async fail")
            .assert("async check", async (s) => s.subject, equals(10))
            .start(99, { haltOnFailure: false });
        expect(state.results[0].status).toBe(STATUS.FAIL);
    });

    it("async handler that rejects — ERROR", async () => {
        const state = await CTGTest.init("async error")
            .assert("async boom", async () => { throw new Error("async fail"); }, equals(1))
            .start(1, { haltOnFailure: false });
        expect(state.results[0].status).toBe(STATUS.ERROR);
    });

    it("async handler computed value deposited on state.computed", async () => {
        const state = await CTGTest.init("async computed")
            .assert("async len", async (s) => s.subject.length, equals(3))
            .start("abc");
        expect(state.results[0].computedValue).toBe(3);
    });
});

// ── 8. Validation ──────────────────────────────────────────────────

describe("assert: validation — predicate must be CTGTestPredicate", () => {

    it("non-predicate value throws INVALID_EXPECTED_OUTCOME (1003)", async () => {
        try {
            await CTGTest.init("bad predicate")
                .assert("check", (s) => s.subject, 42)
                .start(1);
            expect.unreachable("should have thrown");
        } catch (err) {
            expect(err).toBeInstanceOf(CTGTestError);
            expect(err.code).toBe(1003);
            expect(err.type).toBe("INVALID_EXPECTED_OUTCOME");
        }
    });

    it("bare function throws INVALID_EXPECTED_OUTCOME (1003)", async () => {
        try {
            await CTGTest.init("bare fn")
                .assert("check", (s) => s.subject, (v) => v === 1)
                .start(1);
            expect.unreachable("should have thrown");
        } catch (err) {
            expect(err).toBeInstanceOf(CTGTestError);
            expect(err.code).toBe(1003);
            expect(err.type).toBe("INVALID_EXPECTED_OUTCOME");
        }
    });

    it("bare function error data includes hint about CTGTestPredicate.init()", async () => {
        try {
            await CTGTest.init("bare fn hint")
                .assert("check", (s) => s.subject, (v) => v === 1)
                .start(1);
            expect.unreachable("should have thrown");
        } catch (err) {
            expect(err.data).toBeDefined();
            expect(err.data.got).toBe("function");
            expect(err.data.hint).toEqual(expect.stringContaining("CTGTestPredicate"));
        }
    });

    it("null predicate throws INVALID_EXPECTED_OUTCOME (1003)", async () => {
        try {
            await CTGTest.init("null pred")
                .assert("check", (s) => s.subject, null)
                .start(1);
            expect.unreachable("should have thrown");
        } catch (err) {
            expect(err).toBeInstanceOf(CTGTestError);
            expect(err.code).toBe(1003);
        }
    });

    it("undefined predicate throws INVALID_EXPECTED_OUTCOME (1003)", async () => {
        try {
            await CTGTest.init("undef pred")
                .assert("check", (s) => s.subject, undefined)
                .start(1);
            expect.unreachable("should have thrown");
        } catch (err) {
            expect(err).toBeInstanceOf(CTGTestError);
            expect(err.code).toBe(1003);
        }
    });

    it("string predicate throws INVALID_EXPECTED_OUTCOME (1003)", async () => {
        try {
            await CTGTest.init("string pred")
                .assert("check", (s) => s.subject, "not a predicate")
                .start(1);
            expect.unreachable("should have thrown");
        } catch (err) {
            expect(err).toBeInstanceOf(CTGTestError);
            expect(err.code).toBe(1003);
        }
    });

    it("plain object with predicate-like shape throws INVALID_EXPECTED_OUTCOME", async () => {
        const fake = { expectedOutcome: 1, evaluate: (v) => v === 1 };
        try {
            await CTGTest.init("fake pred")
                .assert("check", (s) => s.subject, fake)
                .start(1);
            expect.unreachable("should have thrown");
        } catch (err) {
            expect(err).toBeInstanceOf(CTGTestError);
            expect(err.code).toBe(1003);
        }
    });
});

// ── 9. Combined Stage + Assert Pipelines ───────────────────────────

describe("assert: combined stage + assert pipelines", () => {

    it("stage transforms subject, assert verifies it", async () => {
        const state = await CTGTest.init("stage then assert")
            .stage("double", (s) => s.subject * 2)
            .assert("is twenty", (s) => s.subject, equals(20))
            .start(10);
        expect(state.results).toHaveLength(2);
        expect(state.results[0].status).toBe(STATUS.PASS);
        expect(state.results[1].status).toBe(STATUS.PASS);
        expect(state.subject).toBe(20);
    });

    it("stage then failing assert — subject reflects stage transform", async () => {
        const state = await CTGTest.init("stage then fail")
            .stage("add one", (s) => s.subject + 1)
            .assert("is ten", (s) => s.subject, equals(10))
            .start(5, { haltOnFailure: false });
        expect(state.subject).toBe(6);
        expect(state.results[0].status).toBe(STATUS.PASS);
        expect(state.results[1].status).toBe(STATUS.FAIL);
        expect(state.results[1].computedValue).toBe(6);
    });

    it("multiple stages and asserts in sequence", async () => {
        const state = await CTGTest.init("multi stage assert")
            .stage("set to array", () => [1, 2, 3])
            .assert("has three elements", (s) => s.subject.length, equals(3))
            .stage("append", (s) => [...s.subject, 4])
            .assert("has four elements", (s) => s.subject.length, equals(4))
            .start(null);
        expect(state.results).toHaveLength(4);
        expect(state.results.every((r) => r.status === STATUS.PASS)).toBe(true);
        expect(state.subject).toEqual([1, 2, 3, 4]);
    });

    it("assert does not leak computed into next stage", async () => {
        const state = await CTGTest.init("computed isolation")
            .assert("compute something", (s) => s.subject * 100, equals(500))
            .stage("identity", (s) => s.subject)
            .start(5);
        // stage receives the original subject (5), not the computed value (500)
        expect(state.subject).toBe(5);
    });
});

// ── haltOnFailure Behavior ─────────────────────────────────────────

describe("assert: haltOnFailure", () => {

    it("haltOnFailure true — stops after FAIL", async () => {
        const state = await CTGTest.init("halt on fail")
            .assert("will fail", (s) => s.subject, equals(999))
            .assert("never reached", (s) => s.subject, equals(5))
            .start(5, { haltOnFailure: true });
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.FAIL);
    });

    it("haltOnFailure true — stops after ERROR", async () => {
        const state = await CTGTest.init("halt on error")
            .assert("will error", () => { throw new Error("boom"); }, equals(1))
            .assert("never reached", (s) => s.subject, equals(5))
            .start(5, { haltOnFailure: true });
        expect(state.results).toHaveLength(1);
        expect(state.results[0].status).toBe(STATUS.ERROR);
    });

    it("haltOnFailure true — PASS does not halt", async () => {
        const state = await CTGTest.init("pass no halt")
            .assert("first", (s) => s.subject, equals(5))
            .assert("second", (s) => s.subject, equals(5))
            .start(5, { haltOnFailure: true });
        expect(state.results).toHaveLength(2);
        expect(state.results.every((r) => r.status === STATUS.PASS)).toBe(true);
    });
});

// ── state.computed Reset ───────────────────────────────────────────

describe("assert: state.computed reset before each operation", () => {

    it("computed is reset to undefined before each assert", async () => {
        let secondComputedBefore;
        const state = await CTGTest.init("computed reset")
            .assert("first", (s) => {
                return 42;
            }, equals(42))
            .assert("second", (s) => {
                secondComputedBefore = s.computed;
                return 99;
            }, equals(99))
            .start(0);
        // state.computed was reset to undefined before the second assert ran
        expect(secondComputedBefore).toBeUndefined();
    });

    it("computed is reset to undefined before stage after assert", async () => {
        let stageComputedBefore;
        const state = await CTGTest.init("computed reset stage")
            .assert("assert first", (s) => 42, equals(42))
            .stage("stage second", (s) => {
                stageComputedBefore = s.computed;
                return s.subject;
            })
            .start(0);
        expect(stageComputedBefore).toBeUndefined();
    });
});
