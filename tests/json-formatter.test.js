import { describe, it, expect } from "vitest";
import CTGTestJsonFormatter from "../src/formatters/CTGTestJsonFormatter.js";
import CTGTestState from "../src/CTGTestState.js";
import CTGTestResult from "../src/CTGTestResult.js";
import CTGTestError from "../src/CTGTestError.js";

// Tests derived from spec.v2.2.md section 2.7 — CTGTestJsonFormatter
// realizes: Format Semantics > The Formatter Contract

// ── Helpers ────────────────────────────────────────────────────────

const S = CTGTestResult.STATUS;

// Builds a CTGTestState with the given label and pre-populated results.
function buildState(label, results) {
    const state = CTGTestState.init(label, null);
    for (const result of results) {
        state.addResult(result);
    }
    return state;
}

describe("CTGTestJsonFormatter", () => {

    // ── Returns Valid JSON String ──────────────────────────────────

    describe("returns valid JSON string", () => {

        it("output is a string", () => {
            const state = buildState("json test", [
                CTGTestResult.stageResult(["step one"], S.PASS),
            ]);
            const output = CTGTestJsonFormatter.format(state);
            expect(typeof output).toBe("string");
        });

        it("output parses as valid JSON", () => {
            const state = buildState("json test", [
                CTGTestResult.stageResult(["step one"], S.PASS),
            ]);
            const output = CTGTestJsonFormatter.format(state);
            expect(() => JSON.parse(output)).not.toThrow();
        });

        it("parses back to an object", () => {
            const state = buildState("json test", [
                CTGTestResult.stageResult(["step one"], S.PASS),
            ]);
            const output = CTGTestJsonFormatter.format(state);
            const parsed = JSON.parse(output);
            expect(typeof parsed).toBe("object");
            expect(parsed).not.toBeNull();
        });
    });

    // ── Pretty-Printed ────────────────────────────────────────────

    describe("pretty-printed", () => {

        it("output contains newlines", () => {
            const state = buildState("pretty test", [
                CTGTestResult.stageResult(["a"], S.PASS),
            ]);
            const output = CTGTestJsonFormatter.format(state);
            expect(output).toContain("\n");
        });

        it("output contains indentation", () => {
            const state = buildState("pretty test", [
                CTGTestResult.stageResult(["a"], S.PASS),
            ]);
            const output = CTGTestJsonFormatter.format(state);
            // Pretty-printed JSON uses spaces for indentation
            expect(output).toMatch(/\n\s+/);
        });

        it("is not a single-line JSON string", () => {
            const state = buildState("multiline", [
                CTGTestResult.stageResult(["a"], S.PASS),
            ]);
            const output = CTGTestJsonFormatter.format(state);
            const lines = output.split("\n");
            expect(lines.length).toBeGreaterThan(1);
        });
    });

    // ── BigInt Serialization ──────────────────────────────────────

    describe("BigInt serialization with n suffix", () => {

        it("serializes BigInt values with n suffix", () => {
            const state = buildState("bigint test", [
                CTGTestResult.assertResult(["big check"], S.FAIL, 42n, 100n),
            ]);
            const output = CTGTestJsonFormatter.format(state);
            expect(output).toContain('"42n"');
            expect(output).toContain('"100n"');
        });

        it("BigInt suffix values parse back as strings", () => {
            const state = buildState("bigint parse", [
                CTGTestResult.assertResult(["big check"], S.FAIL, 99n, 200n),
            ]);
            const output = CTGTestJsonFormatter.format(state);
            const parsed = JSON.parse(output);
            // BigInt becomes a string with n suffix in JSON
            expect(typeof parsed.results[0].computedValue).toBe("string");
            expect(parsed.results[0].computedValue).toBe("99n");
        });
    });

    // ── No Trailing Newline ───────────────────────────────────────

    describe("no trailing newline", () => {

        it("output does not end with newline", () => {
            const state = buildState("no newline", [
                CTGTestResult.stageResult(["a"], S.PASS),
            ]);
            const output = CTGTestJsonFormatter.format(state);
            expect(output.endsWith("\n")).toBe(false);
        });

        it("last character is closing brace", () => {
            const state = buildState("ends with brace", [
                CTGTestResult.stageResult(["a"], S.PASS),
            ]);
            const output = CTGTestJsonFormatter.format(state);
            expect(output.trimEnd().endsWith("}")).toBe(true);
        });
    });

    // ── Contains State Fields ─────────────────────────────────────

    describe("contains state fields", () => {

        it("contains the pipeline label", () => {
            const state = buildState("my pipeline", [
                CTGTestResult.stageResult(["step"], S.PASS),
            ]);
            const output = CTGTestJsonFormatter.format(state);
            const parsed = JSON.parse(output);
            expect(parsed.label).toBe("my pipeline");
        });

        it("contains the subject", () => {
            const state = CTGTestState.init("with subject", { id: 1 });
            state.addResult(CTGTestResult.stageResult(["step"], S.PASS));
            const output = CTGTestJsonFormatter.format(state);
            const parsed = JSON.parse(output);
            expect(parsed.subject).toEqual({ id: 1 });
        });

        it("contains results array", () => {
            const state = buildState("results check", [
                CTGTestResult.stageResult(["a"], S.PASS),
                CTGTestResult.stageResult(["b"], S.PASS),
            ]);
            const output = CTGTestJsonFormatter.format(state);
            const parsed = JSON.parse(output);
            expect(Array.isArray(parsed.results)).toBe(true);
            expect(parsed.results.length).toBe(2);
        });

        it("result objects contain label array", () => {
            const state = buildState("label check", [
                CTGTestResult.stageResult(["outer", "inner"], S.PASS),
            ]);
            const output = CTGTestJsonFormatter.format(state);
            const parsed = JSON.parse(output);
            expect(parsed.results[0].label).toEqual(["outer", "inner"]);
        });

        it("result objects contain status", () => {
            const state = buildState("status check", [
                CTGTestResult.assertResult(["check"], S.FAIL, "a", "b"),
            ]);
            const output = CTGTestJsonFormatter.format(state);
            const parsed = JSON.parse(output);
            expect(parsed.results[0].status).toBe(S.FAIL);
        });

        it("empty results produces empty array", () => {
            const state = buildState("empty", []);
            const output = CTGTestJsonFormatter.format(state);
            const parsed = JSON.parse(output);
            expect(parsed.results).toEqual([]);
        });
    });

    // ── Formatter failure wrapping ────────────────────────────────────

    describe("formatter failure produces FORMATTER_ERROR", () => {

        it("wraps circular reference error as FORMATTER_ERROR", () => {
            const circular = {};
            circular.self = circular;
            const state = CTGTestState.init("circular", null);
            state.subject = circular;
            try {
                CTGTestJsonFormatter.format(state);
                expect.unreachable("should have thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.type).toBe("FORMATTER_ERROR");
                expect(err.code).toBe(2000);
            }
        });

        it("preserves original error message in FORMATTER_ERROR", () => {
            const circular = {};
            circular.self = circular;
            const state = CTGTestState.init("circular", null);
            state.subject = circular;
            try {
                CTGTestJsonFormatter.format(state);
                expect.unreachable("should have thrown");
            } catch (err) {
                expect(err.msg).toContain("circular");
            }
        });
    });
});
