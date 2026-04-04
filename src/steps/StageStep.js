import CTGTestStep from "../CTGTestStep.js"; // Abstract step base
import CTGTestError from "../CTGTestError.js"; // Typed errors
import CTGTestResult from "../CTGTestResult.js"; // Status enum
import CTGTestState from "../CTGTestState.js"; // Pipeline state

// Stage step — transforms the subject on state.
// The callback receives CTGTestState and must return CTGTestState.
export default class StageStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, (* -> ctgTestState), (* -> *)? -> this
    // Creates a stage step with a name, transform function, and optional error handler.
    constructor(name, fn, errorHandler = null) {
        super("stage", name, { errorHandler });
        this._fn = fn;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> (* -> ctgTestState)
    // Returns the transform function.
    get fn() { return this._fn; }

    // GETTER :: VOID -> BOOL
    // Stage steps produce result entries.
    get producesResult() { return true; }

    /**
     *
     * Instance Methods
     *
     */

    // :: VOID -> VOID
    // Validates that fn is callable and name is non-empty.
    validate() {
        if (this._name.trim().length === 0) {
            throw new CTGTestError("INVALID_STEP", "Step name must not be empty");
        }
        if (typeof this._fn !== "function") {
            throw new CTGTestError("INVALID_STEP",
                `Step fn must be a function, got ${typeof this._fn}`);
        }
    }

    // :: ctgTestState -> PROMISE(ctgTestState)
    // Calls the transform function with state. If the callback does not
    // return a CTGTestState instance, the step errors. If an error handler
    // is provided and the callback throws, the handler receives the error
    // and its return value replaces the subject.
    async execute(state) {
        try {
            const result = await this._fn(state);
            if (!(result instanceof CTGTestState)) {
                throw new CTGTestError("INVALID_STEP",
                    "Stage callback must return CTGTestState");
            }
            return result;
        } catch (err) {
            if (this._errorHandler) {
                try {
                    const recovered = await this._errorHandler(err);
                    state.subject = recovered;
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
