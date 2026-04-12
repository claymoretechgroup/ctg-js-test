import CTGTestResult from "./CTGTestResult.js"; // Status enum and aggregation

// Mutable state object threaded through pipeline operations.
// Carries the subject, computed value, accumulated results, and pipeline label.
export default class CTGTestState {

    // CONSTRUCTOR :: { subject: *, label: STRING }? -> this
    // Creates state with optional subject and label.
    // Results starts empty. Computed starts undefined.
    constructor({ subject, label = "" } = {}) {
        this._subject = subject;
        this._computed = undefined;
        this._results = [];
        this._label = label;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> STRING
    get label() { return this._label; }

    // SETTER :: STRING -> VOID
    set label(value) { this._label = value; }

    // GETTER :: VOID -> *
    get subject() { return this._subject; }

    // SETTER :: * -> VOID
    set subject(value) { this._subject = value; }

    // GETTER :: VOID -> *
    get computed() { return this._computed; }

    // SETTER :: * -> VOID
    set computed(value) { this._computed = value; }

    // GETTER :: VOID -> [CTGTestResult]
    get results() { return this._results; }

    // GETTER :: VOID -> INT
    // Aggregate status from results. Error > fail > pass.
    get status() {
        return CTGTestResult.aggregateStatus(this._results);
    }

    /**
     *
     * Instance Methods
     *
     */

    // :: CTGTestResult -> VOID
    // Appends a result to the results array.
    addResult(result) {
        this._results.push(result);
    }

    // :: VOID -> OBJECT
    // JSON serialization shape — exposes public field names.
    toJSON() {
        return {
            label: this._label,
            subject: this._subject,
            computed: this._computed,
            results: this._results
        };
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: STRING, * -> ctgTestState
    // Creates a new state with the given label and subject.
    static init(label, subject) {
        return new this({ subject, label });
    }
}
