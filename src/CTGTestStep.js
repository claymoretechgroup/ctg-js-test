// Abstract base class for pipeline steps.
// Concrete step types implement execute(state) and validate().
// Steps compute values. The pipeline owns judgment and result construction.
export default class CTGTestStep {

    // CONSTRUCTOR :: STRING, STRING, OBJECT? -> this
    constructor(type, name, opts = {}) {
        this._type = type;
        this._name = name;
        this._errorHandler = opts.errorHandler || null;
    }

    // GETTER :: VOID -> STRING
    get type() { return this._type; }

    // GETTER :: VOID -> STRING
    get name() { return this._name; }

    // GETTER :: VOID -> FUNCTION|NULL
    get errorHandler() { return this._errorHandler; }

    // GETTER :: VOID -> BOOL
    // Whether this step produces a result entry. Default true.
    // Skip returns false — it modifies state without producing a result.
    get producesResult() { return true; }

    // GETTER :: VOID -> OBJECT|NULL
    // Declares what the step expects for correctness evaluation.
    // The pipeline reads this after execute to judge the outcome.
    // Returns null if the step does not require comparison.
    get expectedOutcome() { return null; }

    // :: CTGTestState -> PROMISE(CTGTestState)
    // Abstract — computes a value against state, returns state.
    async execute(state) {
        throw new Error("CTGTestStep.execute must be implemented by subclass");
    }

    // :: VOID -> VOID
    // Abstract — validates the step definition. Throws CTGTestError on failure.
    validate() {
        throw new Error("CTGTestStep.validate must be implemented by subclass");
    }
}
