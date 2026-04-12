import CTGTestResult from "../CTGTestResult.js"; // Status labels and utilities
import CTGTestError from "../CTGTestError.js"; // Framework errors

// Human-readable console output formatter.
// Accepts CTGTestState and produces formatted text.
export default class CTGTestConsoleFormatter {

    /**
     *
     * Static Methods
     *
     */

    // :: CTGTestState -> STRING
    // Formats state as human-readable text per spec.v2.2 format rules.
    // NOTE: No trailing newline — caller appends it.
    // NOTE: Wraps native errors as FORMATTER_ERROR (2000).
    static format(state) {
        try {
            return CTGTestConsoleFormatter._formatInternal(state);
        } catch (err) {
            if (err instanceof CTGTestError) throw err;
            throw new CTGTestError("FORMATTER_ERROR", err.message, { cause: err });
        }
    }

    // :: CTGTestState -> STRING
    // Internal formatting logic.
    static _formatInternal(state) {
        const S = CTGTestResult.STATUS;
        const lines = [];

        // 1. Pipeline label header
        lines.push(`Pipeline: ${state.label}`);

        // 2. Blank line
        lines.push("");

        // 3. One line per result
        for (const result of state.results) {
            let tag;
            if (result.skipped) {
                tag = "[SKIPPED]";
            } else {
                switch (result.status) {
                    case S.PASS:  tag = "[PASS]";  break;
                    case S.FAIL:  tag = "[FAIL]";  break;
                    case S.ERROR: tag = "[ERROR]"; break;
                    default:      tag = "[?]";     break;
                }
            }

            // Pad tag to 10 chars
            const paddedTag = tag.padEnd(10);

            // Join label array with " > "
            const labelStr = result.label.join(" > ");

            lines.push(`  ${paddedTag}${labelStr}`);

            // 4. FAIL detail lines
            if (!result.skipped && result.status === S.FAIL) {
                lines.push(`              computed: ${CTGTestResult.formatValue(result.computedValue)}`);
                lines.push(`              expected: ${CTGTestResult.formatValue(result.expectedOutcome)}`);
            }

            // 5. ERROR detail line
            if (!result.skipped && result.status === S.ERROR && result.error) {
                const className = result.error.constructor ? result.error.constructor.name : "Error";
                lines.push(`              error: ${className}: ${result.error.message}`);
            }

            // 6. SKIPPED — no detail lines
        }

        // 7. Blank line + separator
        lines.push("");
        lines.push("---");

        // 8. Summary line
        const counts = CTGTestResult.countResults(state.results);
        lines.push(`${counts.passed} passed, ${counts.failed} failed, ${counts.skipped} skipped, ${counts.errored} errored (${counts.total} total)`);

        // 9. Result line
        const worstStatus = CTGTestResult.aggregateStatus(state.results);
        const worstLabel = CTGTestResult.statusLabel(worstStatus) || "PASS";
        lines.push(`Result: ${worstLabel.toUpperCase()}`);

        return lines.join("\n");
    }
}
