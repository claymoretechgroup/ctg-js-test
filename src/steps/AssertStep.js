import CTGTestStep from "../CTGTestStep.js";
import CTGTestError from "../CTGTestError.js";
// Assert step — computes an actual value from state.
// The pipeline compares actual to expected after execution.
export default class AssertStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, FUNCTION, *, FUNCTION? -> this
    constructor(name, fn, expected, errorHandler = null) {
        super("assert", name, { errorHandler });
        this._fn = fn;
        this._expected = expected;
    }

    get fn() { return this._fn; }
    get expected() { return this._expected; }
    get producesResult() { return true; }
    get expectedOutcome() { return { type: "value", expected: this._expected }; }

    // :: VOID -> VOID
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

    // :: CTGTestState -> PROMISE(CTGTestState)
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
