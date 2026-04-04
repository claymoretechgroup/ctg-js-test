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
        const counts = CTGTestConsoleFormatter._countResults(state.results);
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
        const indent = "  ".repeat(depth);
        const lineWidth = 72;

        for (const step of results) {
            const tag = `[${step.type}]`;
            const ms = step.durationMs !== undefined ? `${step.durationMs}ms` : "0ms";
            const label = `${tag} ${step.name} (${ms})`;
            const statusLabel = step.status.toUpperCase();
            const padded = indent + label;
            const dotsNeeded = lineWidth - padded.length - statusLabel.length - 1;
            const dots = dotsNeeded > 0 ? " " + ".".repeat(dotsNeeded) : "";
            lines.push(`${padded}${dots} ${statusLabel}`);

            if (step.status === "fail" && step.message) {
                lines.push(`${indent}    ${step.message}`);
            }

            if (step.status === "error" && step.message) {
                lines.push(`${indent}    ${step.message}`);
            }

            if (step.type === "chain" && step.steps) {
                CTGTestConsoleFormatter._formatSteps(step.steps, lines, depth + 1);
            }
        }
    }

    // :: [OBJECT] -> OBJECT
    static _countResults(results) {
        const counts = { passed: 0, failed: 0, skipped: 0, recovered: 0, errored: 0 };
        for (const r of results) {
            if (r.status === "pass") counts.passed++;
            else if (r.status === "fail") counts.failed++;
            else if (r.status === "skip") counts.skipped++;
            else if (r.status === "recovered") counts.recovered++;
            else if (r.status === "error") counts.errored++;
        }
        return counts;
    }
}
