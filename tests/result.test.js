import { describe, it, expect } from "vitest";
import CTGTestResult from "../src/CTGTestResult.js";

// Tests derived from spec.v2.2.md section 2.2 — CTGTestResult
// realizes: Core Semantics > Primitives > RESULT

describe("CTGTestResult", () => {

    // ── STATUS Constants ────────────────────────────────────────────

    describe("STATUS", () => {

        it("PASS is 0", () => {
            expect(CTGTestResult.STATUS.PASS).toBe(0);
        });

        it("FAIL is 1", () => {
            expect(CTGTestResult.STATUS.FAIL).toBe(1);
        });

        it("ERROR is 2", () => {
            expect(CTGTestResult.STATUS.ERROR).toBe(2);
        });

        it("has exactly three entries", () => {
            expect(Object.keys(CTGTestResult.STATUS).length).toBe(3);
        });

        it("is frozen", () => {
            expect(Object.isFrozen(CTGTestResult.STATUS)).toBe(true);
        });
    });

    // ── STATUS_LABELS Constants ─────────────────────────────────────

    describe("STATUS_LABELS", () => {

        it("maps 0 to 'pass'", () => {
            expect(CTGTestResult.STATUS_LABELS[0]).toBe("pass");
        });

        it("maps 1 to 'fail'", () => {
            expect(CTGTestResult.STATUS_LABELS[1]).toBe("fail");
        });

        it("maps 2 to 'error'", () => {
            expect(CTGTestResult.STATUS_LABELS[2]).toBe("error");
        });

        it("has exactly three entries", () => {
            expect(Object.keys(CTGTestResult.STATUS_LABELS).length).toBe(3);
        });

        it("is frozen", () => {
            expect(Object.isFrozen(CTGTestResult.STATUS_LABELS)).toBe(true);
        });
    });

    // ── SEVERITY Constants ──────────────────────────────────────────

    describe("SEVERITY", () => {

        it("ERROR (2) has severity 3", () => {
            expect(CTGTestResult.SEVERITY[2]).toBe(3);
        });

        it("FAIL (1) has severity 2", () => {
            expect(CTGTestResult.SEVERITY[1]).toBe(2);
        });

        it("PASS (0) has severity 1", () => {
            expect(CTGTestResult.SEVERITY[0]).toBe(1);
        });

        it("ERROR severity is higher than FAIL severity", () => {
            expect(CTGTestResult.SEVERITY[2]).toBeGreaterThan(CTGTestResult.SEVERITY[1]);
        });

        it("FAIL severity is higher than PASS severity", () => {
            expect(CTGTestResult.SEVERITY[1]).toBeGreaterThan(CTGTestResult.SEVERITY[0]);
        });

        it("is frozen", () => {
            expect(Object.isFrozen(CTGTestResult.SEVERITY)).toBe(true);
        });
    });

    // ── statusLabel ─────────────────────────────────────────────────

    describe("statusLabel", () => {

        it("resolves PASS code to 'pass'", () => {
            expect(CTGTestResult.statusLabel(0)).toBe("pass");
        });

        it("resolves FAIL code to 'fail'", () => {
            expect(CTGTestResult.statusLabel(1)).toBe("fail");
        });

        it("resolves ERROR code to 'error'", () => {
            expect(CTGTestResult.statusLabel(2)).toBe("error");
        });

        it("returns undefined for unknown code", () => {
            expect(CTGTestResult.statusLabel(99)).toBe(undefined);
        });
    });

    // ── stageResult Factory ─────────────────────────────────────────

    describe("stageResult", () => {

        it("returns a CTGTestResult instance", () => {
            const result = CTGTestResult.stageResult(["step 1"], CTGTestResult.STATUS.PASS);
            expect(result).toBeInstanceOf(CTGTestResult);
        });

        it("sets label from first argument", () => {
            const result = CTGTestResult.stageResult(["pipeline", "step 1"], CTGTestResult.STATUS.PASS);
            expect(result.label).toEqual(["pipeline", "step 1"]);
        });

        it("sets skipped to false", () => {
            const result = CTGTestResult.stageResult(["step"], CTGTestResult.STATUS.PASS);
            expect(result.skipped).toBe(false);
        });

        it("sets status from second argument", () => {
            const result = CTGTestResult.stageResult(["step"], CTGTestResult.STATUS.PASS);
            expect(result.status).toBe(CTGTestResult.STATUS.PASS);
        });

        it("sets computedValue to undefined", () => {
            const result = CTGTestResult.stageResult(["step"], CTGTestResult.STATUS.PASS);
            expect(result.computedValue).toBe(undefined);
        });

        it("sets expectedOutcome to undefined", () => {
            const result = CTGTestResult.stageResult(["step"], CTGTestResult.STATUS.PASS);
            expect(result.expectedOutcome).toBe(undefined);
        });

        it("sets error to undefined when not provided", () => {
            const result = CTGTestResult.stageResult(["step"], CTGTestResult.STATUS.PASS);
            expect(result.error).toBe(undefined);
        });

        it("accepts optional error as third argument", () => {
            const err = new Error("stage failed");
            const result = CTGTestResult.stageResult(["step"], CTGTestResult.STATUS.ERROR, err);
            expect(result.error).toBe(err);
        });

        it("creates an ERROR status result with error", () => {
            const err = new Error("something broke");
            const result = CTGTestResult.stageResult(["step"], CTGTestResult.STATUS.ERROR, err);
            expect(result.status).toBe(CTGTestResult.STATUS.ERROR);
            expect(result.error).toBe(err);
            expect(result.computedValue).toBe(undefined);
            expect(result.expectedOutcome).toBe(undefined);
        });
    });

    // ── assertResult Factory ────────────────────────────────────────

    describe("assertResult", () => {

        it("returns a CTGTestResult instance", () => {
            const result = CTGTestResult.assertResult(
                ["check"], CTGTestResult.STATUS.PASS, 42, 42
            );
            expect(result).toBeInstanceOf(CTGTestResult);
        });

        it("sets label from first argument", () => {
            const result = CTGTestResult.assertResult(
                ["pipeline", "check"], CTGTestResult.STATUS.PASS, 1, 1
            );
            expect(result.label).toEqual(["pipeline", "check"]);
        });

        it("sets skipped to false", () => {
            const result = CTGTestResult.assertResult(
                ["check"], CTGTestResult.STATUS.PASS, 1, 1
            );
            expect(result.skipped).toBe(false);
        });

        it("sets status from second argument", () => {
            const result = CTGTestResult.assertResult(
                ["check"], CTGTestResult.STATUS.FAIL, "actual", "expected"
            );
            expect(result.status).toBe(CTGTestResult.STATUS.FAIL);
        });

        it("sets computedValue from third argument", () => {
            const result = CTGTestResult.assertResult(
                ["check"], CTGTestResult.STATUS.PASS, 42, 42
            );
            expect(result.computedValue).toBe(42);
        });

        it("sets expectedOutcome from fourth argument", () => {
            const result = CTGTestResult.assertResult(
                ["check"], CTGTestResult.STATUS.FAIL, "got", "want"
            );
            expect(result.expectedOutcome).toBe("want");
        });

        it("sets error to undefined when not provided", () => {
            const result = CTGTestResult.assertResult(
                ["check"], CTGTestResult.STATUS.PASS, 1, 1
            );
            expect(result.error).toBe(undefined);
        });

        it("accepts optional error as fifth argument", () => {
            const err = new Error("assert threw");
            const result = CTGTestResult.assertResult(
                ["check"], CTGTestResult.STATUS.ERROR, undefined, 10, err
            );
            expect(result.error).toBe(err);
        });

        it("accepts any type for computedValue and expectedOutcome", () => {
            const obj = { nested: true };
            const arr = [1, 2, 3];
            const result = CTGTestResult.assertResult(
                ["check"], CTGTestResult.STATUS.FAIL, obj, arr
            );
            expect(result.computedValue).toBe(obj);
            expect(result.expectedOutcome).toBe(arr);
        });

        it("accepts null as computedValue", () => {
            const result = CTGTestResult.assertResult(
                ["check"], CTGTestResult.STATUS.FAIL, null, "expected"
            );
            expect(result.computedValue).toBe(null);
        });

        it("accepts undefined as computedValue", () => {
            const result = CTGTestResult.assertResult(
                ["check"], CTGTestResult.STATUS.FAIL, undefined, "expected"
            );
            expect(result.computedValue).toBe(undefined);
        });
    });

    // ── skippedResult Factory ───────────────────────────────────────

    describe("skippedResult", () => {

        it("returns a CTGTestResult instance", () => {
            const result = CTGTestResult.skippedResult(["skipped step"]);
            expect(result).toBeInstanceOf(CTGTestResult);
        });

        it("sets label from first argument", () => {
            const result = CTGTestResult.skippedResult(["pipeline", "skipped"]);
            expect(result.label).toEqual(["pipeline", "skipped"]);
        });

        it("sets skipped to true", () => {
            const result = CTGTestResult.skippedResult(["step"]);
            expect(result.skipped).toBe(true);
        });

        it("sets status to undefined", () => {
            const result = CTGTestResult.skippedResult(["step"]);
            expect(result.status).toBe(undefined);
        });

        it("sets computedValue to undefined", () => {
            const result = CTGTestResult.skippedResult(["step"]);
            expect(result.computedValue).toBe(undefined);
        });

        it("sets expectedOutcome to undefined", () => {
            const result = CTGTestResult.skippedResult(["step"]);
            expect(result.expectedOutcome).toBe(undefined);
        });

        it("sets error to undefined", () => {
            const result = CTGTestResult.skippedResult(["step"]);
            expect(result.error).toBe(undefined);
        });
    });

    // ── Result shape: six canonical fields ──────────────────────────

    describe("canonical six-field shape", () => {

        it("stageResult has exactly six fields", () => {
            const result = CTGTestResult.stageResult(["step"], CTGTestResult.STATUS.PASS);
            const keys = Object.keys(result);
            expect(keys).toContain("label");
            expect(keys).toContain("skipped");
            expect(keys).toContain("status");
            expect(keys).toContain("computedValue");
            expect(keys).toContain("expectedOutcome");
            expect(keys).toContain("error");
        });

        it("assertResult has exactly six fields", () => {
            const result = CTGTestResult.assertResult(
                ["check"], CTGTestResult.STATUS.PASS, 1, 1
            );
            const keys = Object.keys(result);
            expect(keys).toContain("label");
            expect(keys).toContain("skipped");
            expect(keys).toContain("status");
            expect(keys).toContain("computedValue");
            expect(keys).toContain("expectedOutcome");
            expect(keys).toContain("error");
        });

        it("skippedResult has exactly six fields", () => {
            const result = CTGTestResult.skippedResult(["step"]);
            const keys = Object.keys(result);
            expect(keys).toContain("label");
            expect(keys).toContain("skipped");
            expect(keys).toContain("status");
            expect(keys).toContain("computedValue");
            expect(keys).toContain("expectedOutcome");
            expect(keys).toContain("error");
        });

        it("no type field exists on any result", () => {
            const stage = CTGTestResult.stageResult(["s"], 0);
            const assert = CTGTestResult.assertResult(["a"], 0, 1, 1);
            const skipped = CTGTestResult.skippedResult(["k"]);
            expect(stage).not.toHaveProperty("type");
            expect(assert).not.toHaveProperty("type");
            expect(skipped).not.toHaveProperty("type");
        });

        it("no durationMs field exists on any result", () => {
            const stage = CTGTestResult.stageResult(["s"], 0);
            const assert = CTGTestResult.assertResult(["a"], 0, 1, 1);
            const skipped = CTGTestResult.skippedResult(["k"]);
            expect(stage).not.toHaveProperty("durationMs");
            expect(assert).not.toHaveProperty("durationMs");
            expect(skipped).not.toHaveProperty("durationMs");
        });

        it("no message field exists on any result", () => {
            const stage = CTGTestResult.stageResult(["s"], 0);
            const assert = CTGTestResult.assertResult(["a"], 0, 1, 1);
            const skipped = CTGTestResult.skippedResult(["k"]);
            expect(stage).not.toHaveProperty("message");
            expect(assert).not.toHaveProperty("message");
            expect(skipped).not.toHaveProperty("message");
        });
    });

    // ── Read-only fields ────────────────────────────────────────────

    describe("fields are read-only after construction", () => {

        it("label cannot be reassigned", () => {
            const result = CTGTestResult.stageResult(["step"], 0);
            expect(() => { result.label = ["other"]; }).toThrow();
        });

        it("skipped cannot be reassigned", () => {
            const result = CTGTestResult.stageResult(["step"], 0);
            expect(() => { result.skipped = true; }).toThrow();
        });

        it("status cannot be reassigned", () => {
            const result = CTGTestResult.stageResult(["step"], 0);
            expect(() => { result.status = 1; }).toThrow();
        });

        it("computedValue cannot be reassigned", () => {
            const result = CTGTestResult.assertResult(["check"], 0, 42, 42);
            expect(() => { result.computedValue = 99; }).toThrow();
        });

        it("expectedOutcome cannot be reassigned", () => {
            const result = CTGTestResult.assertResult(["check"], 0, 42, 42);
            expect(() => { result.expectedOutcome = 99; }).toThrow();
        });

        it("error cannot be reassigned", () => {
            const err = new Error("test");
            const result = CTGTestResult.stageResult(["step"], 2, err);
            expect(() => { result.error = new Error("other"); }).toThrow();
        });
    });

    // ── aggregateStatus ─────────────────────────────────────────────

    describe("aggregateStatus", () => {

        const S = CTGTestResult.STATUS;

        it("returns PASS for empty array", () => {
            expect(CTGTestResult.aggregateStatus([])).toBe(S.PASS);
        });

        it("returns PASS when all results are PASS", () => {
            const results = [
                CTGTestResult.stageResult(["a"], S.PASS),
                CTGTestResult.stageResult(["b"], S.PASS),
            ];
            expect(CTGTestResult.aggregateStatus(results)).toBe(S.PASS);
        });

        it("returns FAIL when worst is FAIL", () => {
            const results = [
                CTGTestResult.stageResult(["a"], S.PASS),
                CTGTestResult.assertResult(["b"], S.FAIL, 1, 2),
            ];
            expect(CTGTestResult.aggregateStatus(results)).toBe(S.FAIL);
        });

        it("returns ERROR when worst is ERROR", () => {
            const results = [
                CTGTestResult.stageResult(["a"], S.PASS),
                CTGTestResult.assertResult(["b"], S.FAIL, 1, 2),
                CTGTestResult.stageResult(["c"], S.ERROR, new Error("boom")),
            ];
            expect(CTGTestResult.aggregateStatus(results)).toBe(S.ERROR);
        });

        it("ERROR outranks FAIL regardless of order", () => {
            const results = [
                CTGTestResult.stageResult(["a"], S.ERROR, new Error("boom")),
                CTGTestResult.assertResult(["b"], S.FAIL, 1, 2),
                CTGTestResult.stageResult(["c"], S.PASS),
            ];
            expect(CTGTestResult.aggregateStatus(results)).toBe(S.ERROR);
        });

        it("ignores skipped results (status undefined)", () => {
            const results = [
                CTGTestResult.skippedResult(["a"]),
                CTGTestResult.stageResult(["b"], S.PASS),
            ];
            expect(CTGTestResult.aggregateStatus(results)).toBe(S.PASS);
        });

        it("returns PASS when all results are skipped", () => {
            const results = [
                CTGTestResult.skippedResult(["a"]),
                CTGTestResult.skippedResult(["b"]),
            ];
            expect(CTGTestResult.aggregateStatus(results)).toBe(S.PASS);
        });

        it("single FAIL result returns FAIL", () => {
            const results = [
                CTGTestResult.assertResult(["a"], S.FAIL, "got", "want"),
            ];
            expect(CTGTestResult.aggregateStatus(results)).toBe(S.FAIL);
        });

        it("single ERROR result returns ERROR", () => {
            const results = [
                CTGTestResult.stageResult(["a"], S.ERROR, new Error("e")),
            ];
            expect(CTGTestResult.aggregateStatus(results)).toBe(S.ERROR);
        });
    });

    // ── countResults ────────────────────────────────────────────────

    describe("countResults", () => {

        const S = CTGTestResult.STATUS;

        it("returns all zeros for empty array", () => {
            const counts = CTGTestResult.countResults([]);
            expect(counts).toEqual({
                passed: 0,
                failed: 0,
                errored: 0,
                skipped: 0,
                total: 0,
            });
        });

        it("counts passed results", () => {
            const results = [
                CTGTestResult.stageResult(["a"], S.PASS),
                CTGTestResult.stageResult(["b"], S.PASS),
            ];
            const counts = CTGTestResult.countResults(results);
            expect(counts.passed).toBe(2);
            expect(counts.total).toBe(2);
        });

        it("counts failed results", () => {
            const results = [
                CTGTestResult.assertResult(["a"], S.FAIL, 1, 2),
            ];
            const counts = CTGTestResult.countResults(results);
            expect(counts.failed).toBe(1);
            expect(counts.total).toBe(1);
        });

        it("counts errored results", () => {
            const results = [
                CTGTestResult.stageResult(["a"], S.ERROR, new Error("e")),
            ];
            const counts = CTGTestResult.countResults(results);
            expect(counts.errored).toBe(1);
            expect(counts.total).toBe(1);
        });

        it("counts skipped results", () => {
            const results = [
                CTGTestResult.skippedResult(["a"]),
                CTGTestResult.skippedResult(["b"]),
            ];
            const counts = CTGTestResult.countResults(results);
            expect(counts.skipped).toBe(2);
            expect(counts.total).toBe(2);
        });

        it("counts mixed results correctly", () => {
            const results = [
                CTGTestResult.stageResult(["a"], S.PASS),
                CTGTestResult.assertResult(["b"], S.FAIL, 1, 2),
                CTGTestResult.stageResult(["c"], S.ERROR, new Error("e")),
                CTGTestResult.skippedResult(["d"]),
                CTGTestResult.stageResult(["e"], S.PASS),
            ];
            const counts = CTGTestResult.countResults(results);
            expect(counts.passed).toBe(2);
            expect(counts.failed).toBe(1);
            expect(counts.errored).toBe(1);
            expect(counts.skipped).toBe(1);
            expect(counts.total).toBe(5);
        });

        it("total equals sum of all categories", () => {
            const results = [
                CTGTestResult.stageResult(["a"], S.PASS),
                CTGTestResult.assertResult(["b"], S.FAIL, 1, 2),
                CTGTestResult.skippedResult(["c"]),
            ];
            const counts = CTGTestResult.countResults(results);
            expect(counts.total).toBe(counts.passed + counts.failed + counts.errored + counts.skipped);
        });
    });

    // ── formatValue ─────────────────────────────────────────────────

    describe("formatValue", () => {

        it("formats null", () => {
            expect(CTGTestResult.formatValue(null)).toBe("null");
        });

        it("formats undefined", () => {
            expect(CTGTestResult.formatValue(undefined)).toBe("null");
        });

        it("formats true", () => {
            expect(CTGTestResult.formatValue(true)).toBe("true");
        });

        it("formats false", () => {
            expect(CTGTestResult.formatValue(false)).toBe("false");
        });

        it("formats integer", () => {
            expect(CTGTestResult.formatValue(42)).toBe("42");
        });

        it("formats float", () => {
            expect(CTGTestResult.formatValue(3.14)).toBe("3.14");
        });

        it("formats zero", () => {
            expect(CTGTestResult.formatValue(0)).toBe("0");
        });

        it("formats negative number", () => {
            expect(CTGTestResult.formatValue(-7)).toBe("-7");
        });

        it("formats NaN", () => {
            expect(CTGTestResult.formatValue(NaN)).toBe("NaN");
        });

        it("formats Infinity", () => {
            expect(CTGTestResult.formatValue(Infinity)).toBe("Infinity");
        });

        it("formats -Infinity", () => {
            expect(CTGTestResult.formatValue(-Infinity)).toBe("-Infinity");
        });

        it("formats bigint", () => {
            expect(CTGTestResult.formatValue(42n)).toBe("42n");
        });

        it("formats string with quotes", () => {
            expect(CTGTestResult.formatValue("hello")).toBe("'hello'");
        });

        it("formats empty string", () => {
            expect(CTGTestResult.formatValue("")).toBe("''");
        });

        it("escapes single quotes in strings", () => {
            expect(CTGTestResult.formatValue("it's")).toBe("'it\\'s'");
        });

        it("escapes backslashes in strings", () => {
            expect(CTGTestResult.formatValue("a\\b")).toBe("'a\\\\b'");
        });

        it("formats function as [Closure]", () => {
            expect(CTGTestResult.formatValue(() => {})).toBe("[Closure]");
        });

        it("formats named function as [Closure]", () => {
            function myFunc() {}
            expect(CTGTestResult.formatValue(myFunc)).toBe("[Closure]");
        });

        it("formats symbol", () => {
            expect(CTGTestResult.formatValue(Symbol("test"))).toBe("symbol(test)");
        });

        it("formats array with length", () => {
            expect(CTGTestResult.formatValue([1, 2, 3])).toBe("array(3)");
        });

        it("formats empty array", () => {
            expect(CTGTestResult.formatValue([])).toBe("array(0)");
        });

        it("formats Map with size", () => {
            const map = new Map([["a", 1], ["b", 2]]);
            expect(CTGTestResult.formatValue(map)).toBe("Map(2)");
        });

        it("formats Set with size", () => {
            const set = new Set([1, 2, 3]);
            expect(CTGTestResult.formatValue(set)).toBe("Set(3)");
        });

        it("formats plain object with constructor name", () => {
            expect(CTGTestResult.formatValue({ a: 1 })).toBe("object(Object)");
        });

        it("formats custom class instance with constructor name", () => {
            class MyClass {}
            expect(CTGTestResult.formatValue(new MyClass())).toBe("object(MyClass)");
        });

        it("formats Date instance", () => {
            expect(CTGTestResult.formatValue(new Date())).toBe("object(Date)");
        });

        it("formats Error instance", () => {
            expect(CTGTestResult.formatValue(new Error("test"))).toBe("object(Error)");
        });
    });

    // ── formatException ─────────────────────────────────────────────

    describe("formatException", () => {

        it("returns an object with class and message", () => {
            const err = new Error("test error");
            const formatted = CTGTestResult.formatException(err, false);
            expect(formatted.class).toBe("Error");
            expect(formatted.message).toBe("test error");
        });

        it("includes trace when includeTrace is true", () => {
            const err = new Error("test error");
            const formatted = CTGTestResult.formatException(err, true);
            expect(formatted.trace).toBeDefined();
            expect(typeof formatted.trace).toBe("string");
        });

        it("omits trace when includeTrace is false", () => {
            const err = new Error("test error");
            const formatted = CTGTestResult.formatException(err, false);
            expect(formatted).not.toHaveProperty("trace");
        });

        it("includes code when error has code property", () => {
            const err = new Error("test");
            err.code = 42;
            const formatted = CTGTestResult.formatException(err, false);
            expect(formatted.code).toBe(42);
        });

        it("includes data when error has data property", () => {
            const err = new Error("test");
            err.data = { detail: "extra info" };
            const formatted = CTGTestResult.formatException(err, false);
            expect(formatted.data).toEqual({ detail: "extra info" });
        });

        it("preserves custom error class name", () => {
            class CustomError extends Error {
                constructor(msg) {
                    super(msg);
                    this.name = "CustomError";
                }
            }
            const err = new CustomError("custom");
            const formatted = CTGTestResult.formatException(err, false);
            expect(formatted.class).toBe("CustomError");
        });

        it("includes caused_by when provided", () => {
            const err = new Error("outer");
            const innerFormatted = { class: "Error", message: "inner", code: null };
            const formatted = CTGTestResult.formatException(err, false, innerFormatted);
            expect(formatted.caused_by).toBe(innerFormatted);
        });

        it("omits caused_by when not provided", () => {
            const err = new Error("solo");
            const formatted = CTGTestResult.formatException(err, false);
            expect(formatted).not.toHaveProperty("caused_by");
        });

        it("omits caused_by when null", () => {
            const err = new Error("solo");
            const formatted = CTGTestResult.formatException(err, false, null);
            expect(formatted).not.toHaveProperty("caused_by");
        });

        it("handles error with no code gracefully", () => {
            const err = new Error("no code");
            const formatted = CTGTestResult.formatException(err, false);
            expect(formatted.code).toBe(null);
        });
    });

    // ── label is an array of strings ────────────────────────────────

    describe("label field", () => {

        it("label is an array for stageResult", () => {
            const result = CTGTestResult.stageResult(["a", "b"], 0);
            expect(Array.isArray(result.label)).toBe(true);
            expect(result.label).toEqual(["a", "b"]);
        });

        it("label is an array for assertResult", () => {
            const result = CTGTestResult.assertResult(["x"], 0, 1, 1);
            expect(Array.isArray(result.label)).toBe(true);
        });

        it("label is an array for skippedResult", () => {
            const result = CTGTestResult.skippedResult(["skipped"]);
            expect(Array.isArray(result.label)).toBe(true);
        });

        it("preserves multi-segment label", () => {
            const result = CTGTestResult.stageResult(["pipeline", "group", "step"], 0);
            expect(result.label).toEqual(["pipeline", "group", "step"]);
        });
    });

    // ── Result differentiation by populated fields ──────────────────

    describe("result differentiation (no type field)", () => {

        it("stage results have undefined computedValue and expectedOutcome", () => {
            const result = CTGTestResult.stageResult(["step"], 0);
            expect(result.computedValue).toBe(undefined);
            expect(result.expectedOutcome).toBe(undefined);
            expect(result.skipped).toBe(false);
        });

        it("assert results have populated computedValue and expectedOutcome", () => {
            const result = CTGTestResult.assertResult(["check"], 0, 42, 42);
            expect(result.computedValue).toBe(42);
            expect(result.expectedOutcome).toBe(42);
            expect(result.skipped).toBe(false);
        });

        it("skipped results have undefined status, computedValue, and expectedOutcome", () => {
            const result = CTGTestResult.skippedResult(["step"]);
            expect(result.status).toBe(undefined);
            expect(result.computedValue).toBe(undefined);
            expect(result.expectedOutcome).toBe(undefined);
            expect(result.skipped).toBe(true);
        });
    });
});
