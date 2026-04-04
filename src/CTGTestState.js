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
        return CTGTestResult.aggregateStatus(this.results);
    }
}
