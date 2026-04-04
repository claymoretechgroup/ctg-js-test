// Formats CTGTestState as JUnit XML for CI integration
import CTGTestResult from "../CTGTestResult.js"; // Result utilities for formatValue

// JUnit XML formatter mapping test results to testsuite/testcase elements
export default class CTGTestJunitFormatter {

    /**
     *
     * Static Methods
     *
     */

    // :: CTGTestState, OBJECT? -> STRING
    // Produces JUnit XML output from a CTGTestState.
    // NOTE: No trailing newline — caller appends it.
    static format(state, config = {}) {
        const lines = [];
        lines.push('<?xml version="1.0" encoding="UTF-8"?>');
        CTGTestJunitFormatter._formatSuite(state, lines, config);
        return lines.join("\n");
    }

    // :: OBJECT, [STRING], OBJECT -> VOID
    // Formats a suite (state or chain result) as a <testsuite> element.
    static _formatSuite(suite, lines, config) {
        const results = suite.results || suite.steps || [];
        const counts = CTGTestJunitFormatter._countResults(results);
        const totalMs = results.reduce((sum, r) => sum + (r.durationMs || 0), 0);
        const time = (totalMs / 1000).toFixed(3);

        lines.push(
            `<testsuite name=${CTGTestJunitFormatter._attr(suite.name)}` +
            ` tests="${counts.total}"` +
            ` failures="${counts.failed}"` +
            ` errors="${counts.errored}"` +
            ` skipped="${counts.skipped}"` +
            ` time="${time}">`
        );

        for (const step of results) {
            if (step.type === "chain") {
                CTGTestJunitFormatter._formatSuite(step, lines, config);
            } else {
                CTGTestJunitFormatter._formatCase(step, lines, config);
            }
        }

        lines.push("</testsuite>");
    }

    // :: OBJECT, [STRING], OBJECT -> VOID
    // Formats a single step as a <testcase> element with status-specific children.
    static _formatCase(step, lines, config) {
        const ms = step.durationMs || 0;
        const time = (ms / 1000).toFixed(3);
        const nameAttr = CTGTestJunitFormatter._attr(step.name);

        if (step.status === "pass") {
            lines.push(`  <testcase name=${nameAttr} time="${time}"/>`);
            return;
        }

        lines.push(`  <testcase name=${nameAttr} time="${time}">`);

        if (step.status === "fail") {
            const msg = step.message || "";
            lines.push(`    <failure message=${CTGTestJunitFormatter._attr(msg)} type="AssertionFailure">`);
            if (step.type === "assert-any" && step.candidates !== undefined) {
                const formatted = step.candidates.map((c) => CTGTestResult.formatValue(c)).join(", ");
                lines.push(`Expected any of: [${CTGTestJunitFormatter._escape(formatted)}]`);
                lines.push(`Actual: ${CTGTestJunitFormatter._escape(CTGTestResult.formatValue(step.actual))}`);
            } else if (step.actual !== undefined && step.expected !== undefined) {
                lines.push(`Expected: ${CTGTestJunitFormatter._escape(CTGTestResult.formatValue(step.expected))}`);
                lines.push(`Actual: ${CTGTestJunitFormatter._escape(CTGTestResult.formatValue(step.actual))}`);
            }
            lines.push("    </failure>");
        }

        if (step.status === "error") {
            const msg = step.message || "";
            lines.push(`    <error message=${CTGTestJunitFormatter._attr(msg)} type="Error">`);
            lines.push("    </error>");
        }

        if (step.status === "skip") {
            lines.push("    <skipped/>");
        }

        if (step.status === "recovered") {
            const msg = step.message || "";
            lines.push("    <system-out>");
            lines.push(`Recovery: ${CTGTestJunitFormatter._escape(msg)}`);
            lines.push("    </system-out>");
        }

        lines.push("  </testcase>");
    }

    // :: [OBJECT] -> OBJECT
    static _countResults(results) {
        let passed = 0, failed = 0, skipped = 0, recovered = 0, errored = 0;
        for (const r of results) {
            if (r.status === "pass") passed++;
            else if (r.status === "fail") failed++;
            else if (r.status === "skip") skipped++;
            else if (r.status === "recovered") recovered++;
            else if (r.status === "error") errored++;
        }
        return { total: results.length, passed, failed, skipped, recovered, errored };
    }

    // :: STRING -> STRING
    static _escape(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // :: STRING -> STRING
    static _attr(str) {
        return `"${CTGTestJunitFormatter._escape(str)}"`;
    }
}
