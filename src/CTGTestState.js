import CTGTestResult from "./CTGTestResult.js"; // Status enum and labels

// Mutable state object threaded through pipeline steps.
// Carries the subject, accumulated results, config, and handoff fields.
export default class CTGTestState {

    // CONSTRUCTOR :: {subject:*, config:OBJECT, name:STRING}? -> this
    // Creates state with optional subject, config, and name.
    // Results starts empty. skipTargets starts empty.
    constructor({ subject = null, config = {}, name = "" } = {}) {
        this.subject = subject;
        this.config = config;
        this.name = name;
        this.results = [];
        this.actual = undefined;
        this.skipTargets = {};
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> INT
    // Aggregate status from results. Error > fail > recovered > skip > pass.
    get status() {
        const S = CTGTestResult.STATUS;
        let hasError = false;
        let hasFail = false;
        let hasRecovered = false;
        let hasSkip = false;

        for (const result of this.results) {
            if (result.status === S.ERROR) hasError = true;
            else if (result.status === S.FAIL) hasFail = true;
            else if (result.status === S.RECOVERED) hasRecovered = true;
            else if (result.status === S.SKIP) hasSkip = true;
        }

        if (hasError) return S.ERROR;
        if (hasFail) return S.FAIL;
        if (hasRecovered) return S.RECOVERED;
        if (hasSkip) return S.SKIP;
        return S.PASS;
    }
}
