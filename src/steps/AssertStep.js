import CTGTestStep from "../CTGTestStep.js"; // Abstract step base
import CTGTestError from "../CTGTestError.js"; // Typed errors

// Assert step — computes an actual value from state.
// The pipeline compares actual to expected after execution.
export default class AssertStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, (ctgTestState -> *), *, (Error -> *)? -> this
    // Creates an assert step with a name, compute function, expected value,
    // and optional error handler. The expected value must not be a function.
    constructor(name, fn, expected, errorHandler = null) {
        super("assert", name, { errorHandler });
        this._fn = fn;
        this._expected = expected;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> (ctgTestState -> *)
    // Returns the compute function.
    get fn() { return this._fn; }

    // GETTER :: VOID -> *
    // Returns the expected value for comparison.
    get expected() { return this._expected; }

    // GETTER :: VOID -> BOOL
    // Assert steps produce result entries.
    get producesResult() { return true; }

    // GETTER :: VOID -> OBJECT
    // Declares value comparison outcome for the pipeline.
    get expectedOutcome() { return { type: "value", expected: this._expected }; }

    /**
     *
     * Instance Methods
     *
     */

    // :: VOID -> VOID
    // Validates that fn is callable, name is non-empty, and expected is not a function.
    validate() {
        if (this._name.trim().length === 0) {
            throw new CTGTestError("INVALID_STEP", "Step name must not be empty");
        }
        if (typeof this._fn !== "function") {
            throw new CTGTestError("INVALID_STEP",
                `Step fn must be a function, got ${typeof this._fn}`);
        }
        if (typeof this._expected === "function") {
            throw new CTGTestError("INVALID_EXPECTED",
                "Assert expected must not be a function");
        }
    }

    // :: ctgTestState -> PROMISE(ctgTestState)
    // Calls the compute function with state and sets state.actual to the
    // return value. Does not modify state.subject. If an error handler is
    // provided and the function throws, the handler receives the error and
    // its return value is set as state.actual.
    async execute(state) {
        try {
            const actual = await this._fn(state);
            state.actual = actual;
            return state;
        } catch (err) {
            if (this._errorHandler) {
                try {
                    const recovered = await this._errorHandler(err);
                    state.actual = recovered;
                    state._lastStepStatus = "recovered";
                    return state;
                } catch (handlerErr) {
                    state._lastStepStatus = "error";
                    state._lastStepMessage = handlerErr.message;
                    return state;
                }
            }
            state._lastStepStatus = "error";
            state._lastStepMessage = err.message;
            return state;
        }
    }
}
