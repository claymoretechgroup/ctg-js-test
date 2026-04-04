import CTGTestStep from "../CTGTestStep.js"; // Abstract step base
import CTGTestError from "../CTGTestError.js"; // Typed errors
import CTGTestResult from "../CTGTestResult.js"; // Status enum

// AssertAny step — computes an actual value from state.
// The pipeline compares actual against a list of candidates.
export default class AssertAnyStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, (ctgTestState -> *), [*], (Error -> *)? -> this
    // Creates an assertAny step with a name, compute function, candidate
    // array, and optional error handler. Candidates must be an array.
    constructor(name, fn, candidates, errorHandler = null) {
        super("assert-any", name, { errorHandler });
        this._fn = fn;
        this._candidates = candidates;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> (ctgTestState -> *)
    // Returns the compute function.
    get fn() { return this._fn; }

    // GETTER :: VOID -> [*]
    // Returns the candidate array for comparison.
    get candidates() { return this._candidates; }

    // GETTER :: VOID -> BOOL
    // AssertAny steps produce result entries.
    get producesResult() { return true; }

    // GETTER :: VOID -> OBJECT
    // Declares candidates comparison outcome for the pipeline.
    get expectedOutcome() { return { type: "candidates", candidates: this._candidates }; }

    /**
     *
     * Instance Methods
     *
     */

    // :: VOID -> VOID
    // Validates that fn is callable, name is non-empty, and candidates is an array.
    validate() {
        if (this._name.trim().length === 0) {
            throw new CTGTestError("INVALID_STEP", "Step name must not be empty");
        }
        if (typeof this._fn !== "function") {
            throw new CTGTestError("INVALID_STEP",
                `Step fn must be a function, got ${typeof this._fn}`);
        }
        if (!Array.isArray(this._candidates)) {
            throw new CTGTestError("INVALID_EXPECTED",
                "AssertAny expected must be an array");
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
                    state._lastStepStatus = CTGTestResult.STATUS.RECOVERED;
                    return state;
                } catch (handlerErr) {
                    state._lastStepStatus = CTGTestResult.STATUS.ERROR;
                    state._lastStepMessage = handlerErr.message;
                    return state;
                }
            }
            state._lastStepStatus = CTGTestResult.STATUS.ERROR;
            state._lastStepMessage = err.message;
            return state;
        }
    }
}
