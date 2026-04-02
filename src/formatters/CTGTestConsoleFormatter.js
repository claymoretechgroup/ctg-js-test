// Human-readable console output formatter with indented tree structure
export default class CTGTestConsoleFormatter {

    /**
     *
     * Static Methods
     *
     */

    // :: OBJECT, OBJECT? -> STRING
    // Formats a report as human-readable text with dot-padded status alignment.
    // NOTE: No trailing newline — delivery layer appends it.
    static format(report, config = {}) {
        const lines = [];
        lines.push(report.name);
        CTGTestConsoleFormatter._formatSteps(report.steps, lines, 1);
        lines.push("");
        const summary = [
            `${report.passed} passed`,
            `${report.failed} failed`,
            `${report.skipped} skipped`,
            `${report.recovered} recovered`,
            `${report.errored} errored`
        ].join(", ");
        lines.push(`${summary} (${report.duration_ms}ms)`);
        return lines.join("\n");
    }

    // :: [OBJECT], [STRING], INT -> VOID
    // Recursively formats step results into output lines with indentation.
    static _formatSteps(steps, lines, depth) {
        const indent = "  ".repeat(depth);
        const lineWidth = 72;

        for (const step of steps) {
            const tag = `[${step.type}]`;
            const label = `${tag} ${step.name} (${step.duration_ms}ms)`;
            const statusLabel = step.status.toUpperCase();
            const padded = indent + label;
            const dotsNeeded = lineWidth - padded.length - statusLabel.length - 1;
            const dots = dotsNeeded > 0 ? " " + ".".repeat(dotsNeeded) : "";
            lines.push(`${padded}${dots} ${statusLabel}`);

            if (step.status === "fail" && step.message) {
                lines.push(`${indent}  ${step.message}`);
            }

            if (step.status === "error" && step.message) {
                lines.push(`${indent}  ${step.message}`);
            }

            if (step.status === "error" && step.exception && step.exception.trace) {
                lines.push(`${indent}  ${step.exception.trace}`);
            }

            if (step.type === "chain" && step.steps) {
                CTGTestConsoleFormatter._formatSteps(step.steps, lines, depth + 1);
            }
        }
    }
}
