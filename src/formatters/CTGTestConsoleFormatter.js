import CTGTestResult from "../CTGTestResult.js"; // Status labels

// Human-readable console output formatter with indented tree structure.
// Accepts CTGTestState and produces formatted text.
export default class CTGTestConsoleFormatter {

    /**
     *
     * Static Methods
     *
     */

    // :: CTGTestState, OBJECT? -> STRING
    // Formats state as human-readable text with dot-padded status alignment.
    // NOTE: No trailing newline — caller appends it.
    static format(state, config = {}) {
        const lines = [];
        lines.push(state.name);
        CTGTestConsoleFormatter._formatSteps(state.results, lines, 1);
        lines.push("");
        const counts = CTGTestResult.countSteps(state.results);
        const summary = [
            `${counts.passed} passed`,
            `${counts.failed} failed`,
            `${counts.skipped} skipped`,
            `${counts.recovered} recovered`,
            `${counts.errored} errored`
        ].join(", ");
        const totalMs = state.results.reduce((sum, r) => sum + (r.durationMs || 0), 0);
        lines.push(`${summary} (${totalMs}ms)`);
        return lines.join("\n");
    }

    // :: [OBJECT], [STRING], INT -> VOID
    // Recursively formats step results into output lines with indentation.
    static _formatSteps(results, lines, depth) {
        const S = CTGTestResult.STATUS;
        const indent = "  ".repeat(depth);
        const lineWidth = 72;

        for (const step of results) {
            const tag = `[${step.type}]`;
            const ms = step.durationMs !== undefined ? `${step.durationMs}ms` : "0ms";
            const label = `${tag} ${step.name} (${ms})`;
            const statusLabel = CTGTestResult.statusLabel(step.status).toUpperCase();
            const padded = indent + label;
            const dotsNeeded = lineWidth - padded.length - statusLabel.length - 1;
            const dots = dotsNeeded > 0 ? " " + ".".repeat(dotsNeeded) : "";
            lines.push(`${padded}${dots} ${statusLabel}`);

            if (step.status === S.FAIL && step.message) {
                lines.push(`${indent}    ${step.message}`);
            }

            if (step.status === S.ERROR && step.message) {
                lines.push(`${indent}    ${step.message}`);
            }

            if (step.type === "chain" && step.steps) {
                CTGTestConsoleFormatter._formatSteps(step.steps, lines, depth + 1);
            }
        }
    }
}
