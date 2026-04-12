import { describe, it, expect } from "vitest";
import CTGTestConsoleFormatter from "../src/formatters/CTGTestConsoleFormatter.js";
import CTGTestState from "../src/CTGTestState.js";
import CTGTestResult from "../src/CTGTestResult.js";
import CTGTestError from "../src/CTGTestError.js";

// Tests derived from spec.v2.2.md section 2.7 — CTGTestConsoleFormatter
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

describe("CTGTestConsoleFormatter", () => {

    // ── Pipeline Label Header ──────────────────────────────────────

    describe("pipeline label header", () => {

        it("first line is Pipeline: followed by state label", () => {
            const state = buildState("my test pipeline", []);
            const output = CTGTestConsoleFormatter.format(state);
            const firstLine = output.split("\n")[0];
            expect(firstLine).toBe("Pipeline: my test pipeline");
        });

        it("second line is blank", () => {
            const state = buildState("header test", [
                CTGTestResult.stageResult(["step one"], S.PASS),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            const lines = output.split("\n");
            expect(lines[1]).toBe("");
        });
    });

    // ── PASS Result Line Formatting ────────────────────────────────

    describe("PASS result line formatting", () => {

        it("renders PASS with bracket tag padded to 10 chars", () => {
            const state = buildState("pass test", [
                CTGTestResult.stageResult(["load data"], S.PASS),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            const lines = output.split("\n");
            // Result line is after header + blank line, so index 2
            expect(lines[2]).toBe("  [PASS]    load data");
        });

        it("PASS result has no detail lines", () => {
            const state = buildState("pass only", [
                CTGTestResult.stageResult(["single step"], S.PASS),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            const lines = output.split("\n");
            // Line 2 is the PASS line, line 3 should be blank (separator)
            expect(lines[3]).toBe("");
        });
    });

    // ── FAIL Result with Computed/Expected Detail Lines ────────────

    describe("FAIL result with detail lines", () => {

        it("renders FAIL bracket tag padded to 10 chars", () => {
            const state = buildState("fail test", [
                CTGTestResult.assertResult(["check value"], S.FAIL, "pending", "complete"),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            const lines = output.split("\n");
            expect(lines[2]).toBe("  [FAIL]    check value");
        });

        it("includes computed detail line after FAIL", () => {
            const state = buildState("fail detail", [
                CTGTestResult.assertResult(["check value"], S.FAIL, "pending", "complete"),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            const lines = output.split("\n");
            expect(lines[3]).toBe("              computed: 'pending'");
        });

        it("includes expected detail line after computed", () => {
            const state = buildState("fail detail", [
                CTGTestResult.assertResult(["check value"], S.FAIL, "pending", "complete"),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            const lines = output.split("\n");
            expect(lines[4]).toBe("              expected: 'complete'");
        });

        it("formats non-string computed values with formatValue", () => {
            const state = buildState("fail numbers", [
                CTGTestResult.assertResult(["numeric check"], S.FAIL, 42, 100),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            expect(output).toContain("computed: 42");
            expect(output).toContain("expected: 100");
        });
    });

    // ── ERROR Result with Error Detail Line ────────────────────────

    describe("ERROR result with error detail line", () => {

        it("renders ERROR bracket tag padded to 10 chars", () => {
            const err = new Error("Connection refused");
            const state = buildState("error test", [
                CTGTestResult.stageResult(["finalize"], S.ERROR, err),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            const lines = output.split("\n");
            expect(lines[2]).toBe("  [ERROR]   finalize");
        });

        it("includes error detail line with class and message", () => {
            const err = new Error("Connection refused");
            const state = buildState("error detail", [
                CTGTestResult.stageResult(["finalize"], S.ERROR, err),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            const lines = output.split("\n");
            expect(lines[3]).toBe("              error: Error: Connection refused");
        });

        it("uses error constructor name for error class", () => {
            class DatabaseError extends Error {
                constructor(msg) { super(msg); this.name = "DatabaseError"; }
            }
            const err = new DatabaseError("timeout");
            const state = buildState("custom error", [
                CTGTestResult.stageResult(["db step"], S.ERROR, err),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            expect(output).toContain("error: DatabaseError: timeout");
        });
    });

    // ── SKIPPED Result ─────────────────────────────────────────────

    describe("SKIPPED result", () => {

        it("renders SKIPPED bracket tag padded to 10 chars", () => {
            const state = buildState("skip test", [
                CTGTestResult.skippedResult(["optional cleanup"]),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            const lines = output.split("\n");
            expect(lines[2]).toBe("  [SKIPPED] optional cleanup");
        });

        it("has no detail lines after SKIPPED", () => {
            const state = buildState("skip only", [
                CTGTestResult.skippedResult(["cleanup"]),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            const lines = output.split("\n");
            // Line 2 is SKIPPED, line 3 should be blank (separator)
            expect(lines[3]).toBe("");
        });
    });

    // ── Label Array Joined with > ──────────────────────────────────

    describe("label array joined with >", () => {

        it("joins multi-segment label with > separator", () => {
            const state = buildState("join test", [
                CTGTestResult.stageResult(["validate payment", "check card"], S.PASS),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            expect(output).toContain("validate payment > check card");
        });

        it("single-segment label renders without separator", () => {
            const state = buildState("single label", [
                CTGTestResult.stageResult(["load cart"], S.PASS),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            expect(output).toContain("load cart");
            expect(output).not.toContain(" > ");
        });

        it("three-segment label joins all parts", () => {
            const state = buildState("deep label", [
                CTGTestResult.stageResult(["a", "b", "c"], S.PASS),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            expect(output).toContain("a > b > c");
        });
    });

    // ── Summary Line Counts ────────────────────────────────────────

    describe("summary line counts", () => {

        it("counts passed, failed, skipped, errored with total", () => {
            const err = new Error("boom");
            const state = buildState("summary test", [
                CTGTestResult.stageResult(["s1"], S.PASS),
                CTGTestResult.stageResult(["s2"], S.PASS),
                CTGTestResult.assertResult(["s3"], S.FAIL, "a", "b"),
                CTGTestResult.stageResult(["s4"], S.ERROR, err),
                CTGTestResult.skippedResult(["s5"]),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            expect(output).toContain("2 passed, 1 failed, 1 skipped, 1 errored (5 total)");
        });

        it("all zeros when no results", () => {
            const state = buildState("empty", []);
            const output = CTGTestConsoleFormatter.format(state);
            expect(output).toContain("0 passed, 0 failed, 0 skipped, 0 errored (0 total)");
        });

        it("all passed", () => {
            const state = buildState("all pass", [
                CTGTestResult.stageResult(["a"], S.PASS),
                CTGTestResult.stageResult(["b"], S.PASS),
                CTGTestResult.stageResult(["c"], S.PASS),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            expect(output).toContain("3 passed, 0 failed, 0 skipped, 0 errored (3 total)");
        });
    });

    // ── Result Line (Worst Status) ─────────────────────────────────

    describe("result line", () => {

        it("shows PASS when all pass", () => {
            const state = buildState("all pass", [
                CTGTestResult.stageResult(["a"], S.PASS),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            expect(output).toContain("Result: PASS");
        });

        it("shows FAIL when any fail", () => {
            const state = buildState("has fail", [
                CTGTestResult.stageResult(["a"], S.PASS),
                CTGTestResult.assertResult(["b"], S.FAIL, 1, 2),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            expect(output).toContain("Result: FAIL");
        });

        it("shows ERROR when any error", () => {
            const err = new Error("crash");
            const state = buildState("has error", [
                CTGTestResult.stageResult(["a"], S.PASS),
                CTGTestResult.assertResult(["b"], S.FAIL, 1, 2),
                CTGTestResult.stageResult(["c"], S.ERROR, err),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            expect(output).toContain("Result: ERROR");
        });

        it("result line is the last line", () => {
            const state = buildState("last line", [
                CTGTestResult.stageResult(["a"], S.PASS),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            const lines = output.split("\n");
            expect(lines[lines.length - 1]).toMatch(/^Result: /);
        });
    });

    // ── No Trailing Newline ────────────────────────────────────────

    describe("no trailing newline", () => {

        it("output does not end with newline", () => {
            const state = buildState("no newline", [
                CTGTestResult.stageResult(["a"], S.PASS),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            expect(output.endsWith("\n")).toBe(false);
        });
    });

    // ── Empty Results ──────────────────────────────────────────────

    describe("empty results", () => {

        it("renders header, separator, summary, and result with no result lines", () => {
            const state = buildState("empty pipeline", []);
            const output = CTGTestConsoleFormatter.format(state);
            const lines = output.split("\n");
            expect(lines[0]).toBe("Pipeline: empty pipeline");
            expect(lines[1]).toBe("");
            // No result lines, so next is blank + separator
            expect(output).toContain("---");
            expect(output).toContain("0 passed, 0 failed, 0 skipped, 0 errored (0 total)");
            expect(output).toContain("Result: PASS");
        });
    });

    // ── Full Output Structure ──────────────────────────────────────

    describe("full output structure matches spec example", () => {

        it("produces correctly ordered sections", () => {
            const err = new Error("Connection refused");
            const state = buildState("checkout flow", [
                CTGTestResult.stageResult(["load cart"], S.PASS),
                CTGTestResult.stageResult(["validate payment", "check card"], S.PASS),
                CTGTestResult.stageResult(["validate payment", "verify auth"], S.PASS),
                CTGTestResult.assertResult(["complete order"], S.FAIL, "pending", "complete"),
                CTGTestResult.stageResult(["finalize"], S.ERROR, err),
                CTGTestResult.skippedResult(["optional cleanup"]),
            ]);
            const output = CTGTestConsoleFormatter.format(state);
            const lines = output.split("\n");

            // Header
            expect(lines[0]).toBe("Pipeline: checkout flow");
            expect(lines[1]).toBe("");

            // Result lines
            expect(lines[2]).toBe("  [PASS]    load cart");
            expect(lines[3]).toBe("  [PASS]    validate payment > check card");
            expect(lines[4]).toBe("  [PASS]    validate payment > verify auth");
            expect(lines[5]).toBe("  [FAIL]    complete order");
            expect(lines[6]).toBe("              computed: 'pending'");
            expect(lines[7]).toBe("              expected: 'complete'");
            expect(lines[8]).toBe("  [ERROR]   finalize");
            expect(lines[9]).toBe("              error: Error: Connection refused");
            expect(lines[10]).toBe("  [SKIPPED] optional cleanup");

            // Separator
            expect(lines[11]).toBe("");
            expect(lines[12]).toBe("---");

            // Summary and result
            expect(lines[13]).toBe("3 passed, 1 failed, 1 skipped, 1 errored (6 total)");
            expect(lines[14]).toBe("Result: ERROR");

            // No trailing newline
            expect(lines.length).toBe(15);
        });
    });

    // ── Formatter failure wrapping ────────────────────────────────────

    describe("formatter failure produces FORMATTER_ERROR", () => {

        it("wraps native error as FORMATTER_ERROR on malformed state", () => {
            // A state with a result whose label getter throws
            const badState = {
                get label() { throw new Error("broken label"); },
                results: []
            };
            try {
                CTGTestConsoleFormatter.format(badState);
                expect.unreachable("should have thrown");
            } catch (err) {
                expect(err).toBeInstanceOf(CTGTestError);
                expect(err.type).toBe("FORMATTER_ERROR");
                expect(err.code).toBe(2000);
            }
        });

        it("preserves original error message in FORMATTER_ERROR", () => {
            const badState = {
                get label() { throw new Error("state is broken"); },
                results: []
            };
            try {
                CTGTestConsoleFormatter.format(badState);
                expect.unreachable("should have thrown");
            } catch (err) {
                expect(err.msg).toBe("state is broken");
            }
        });
    });
});
