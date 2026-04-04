// Abstract base class for pipeline steps.
// Concrete step types implement execute(state) and validate().
// Steps compute values. The pipeline owns judgment and result construction.
export default class CTGTestStep {

    // CONSTRUCTOR :: STRING, STRING, OBJECT? -> this
    // Creates a step with a type, name, and optional configuration.
    // The errorHandler option is read from opts if provided.
    constructor(type, name, opts = {}) {
        this._type = type;
        this._name = name;
        this._errorHandler = opts.errorHandler || null;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> STRING
    // Returns the step type identifier.
    get type() { return this._type; }

    // GETTER :: VOID -> STRING
    // Returns the step name.
    get name() { return this._name; }

    // GETTER :: VOID -> (Error -> *)|NULL
    // Returns the error handler set at construction, or null.
    get errorHandler() { return this._errorHandler; }

    // GETTER :: VOID -> BOOL
    // Whether this step produces a result entry in the pipeline.
    // Default true. SkipStep returns false.
    get producesResult() { return true; }

    // GETTER :: VOID -> OBJECT|NULL
    // Declares what the step expects for correctness evaluation.
    // The pipeline reads this after execute to judge the outcome.
    // Returns null if the step does not require comparison.
    get expectedOutcome() { return null; }

    /**
     *
     * Instance Methods
     *
     */

    // :: ctgTestState -> PROMISE(ctgTestState)
    // Abstract — computes a value against state, returns state.
    // Must be implemented by subclasses.
    async execute(state) {
        throw new Error("CTGTestStep.execute must be implemented by subclass");
    }

    // :: VOID -> VOID
    // Abstract — validates the step definition.
    // Throws CTGTestError on failure. Must be implemented by subclasses.
    validate() {
        throw new Error("CTGTestStep.validate must be implemented by subclass");
    }
}
