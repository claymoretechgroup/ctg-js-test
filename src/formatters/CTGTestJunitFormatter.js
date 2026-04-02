// Formats report as JUnit XML for CI integration
import CTGTestResult from "../CTGTestResult.js"; // Result utilities for formatValue

// JUnit XML formatter mapping test results to testsuite/testcase elements
export default class CTGTestJunitFormatter {

    /**
     *
     * Static Methods
     *
     */

    // :: OBJECT, OBJECT? -> STRING
    // Produces JUnit XML output from a report structure.
    // NOTE: No trailing newline — delivery layer appends it.
    static format(report, config = {}) {
        const lines = [];
        lines.push('<?xml version="1.0" encoding="UTF-8"?>');
        CTGTestJunitFormatter._formatSuite(report, lines, config);
        return lines.join("\n");
    }

    // :: OBJECT, [STRING], OBJECT -> VOID
    // Formats a suite (report or chain) as a <testsuite> element.
    static _formatSuite(suite, lines, config) {
        const time = (suite.duration_ms / 1000).toFixed(3);
        lines.push(
            `<testsuite name=${CTGTestJunitFormatter._attr(suite.name)}` +
            ` tests="${suite.total}"` +
            ` failures="${suite.failed}"` +
            ` errors="${suite.errored}"` +
            ` skipped="${suite.skipped}"` +
            ` time="${time}">`
        );

        for (const step of suite.steps) {
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
        const time = (step.duration_ms / 1000).toFixed(3);
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
            const exc = step.exception || {};
            const msg = step.message || exc.message || "";
            const type = exc.class || "Error";
            lines.push(`    <error message=${CTGTestJunitFormatter._attr(msg)} type=${CTGTestJunitFormatter._attr(type)}>`);
            if (exc.trace) {
                lines.push(CTGTestJunitFormatter._escape(exc.trace));
            }
            lines.push("    </error>");
        }

        if (step.status === "skip") {
            lines.push("    <skipped/>");
        }

        if (step.status === "recovered") {
            const msg = step.message || "";
            lines.push("    <system-out>");
            lines.push(`Recovery: ${CTGTestJunitFormatter._escape(msg)}`);
            if (step.exception && step.exception.trace) {
                lines.push(CTGTestJunitFormatter._escape(step.exception.trace));
            }
            lines.push("    </system-out>");
        }

        lines.push("  </testcase>");
    }

    // :: STRING -> STRING
    // Escapes XML special characters in text content.
    static _escape(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // :: STRING -> STRING
    // Wraps a string as a quoted, XML-escaped attribute value.
    static _attr(str) {
        return `"${CTGTestJunitFormatter._escape(str)}"`;
    }
}
