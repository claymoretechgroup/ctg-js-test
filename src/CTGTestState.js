// Mutable state object threaded through pipeline steps.
// Carries the subject, accumulated results, config, and handoff fields.
export default class CTGTestState {

    // CONSTRUCTOR :: OBJECT -> this
    constructor({ subject = null, config = {}, name = "" } = {}) {
        this.subject = subject;
        this.config = config;
        this.name = name;
        this.results = [];
        this.actual = undefined;
        this.skipTargets = {};
    }

    // GETTER :: VOID -> STRING
    // Aggregate status from results. Error > fail > recovered > skip > pass.
    get status() {
        let hasError = false;
        let hasFail = false;
        let hasRecovered = false;
        let hasSkip = false;

        for (const result of this.results) {
            if (result.status === "error") hasError = true;
            else if (result.status === "fail") hasFail = true;
            else if (result.status === "recovered") hasRecovered = true;
            else if (result.status === "skip") hasSkip = true;
        }

        if (hasError) return "error";
        if (hasFail) return "fail";
        if (hasRecovered) return "recovered";
        if (hasSkip) return "skip";
        return "pass";
    }
}
