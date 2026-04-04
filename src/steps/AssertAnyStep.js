import CTGTestStep from "../CTGTestStep.js";
import CTGTestError from "../CTGTestError.js";

// AssertAny step — computes an actual value from state.
// The pipeline compares actual against a list of candidates.
export default class AssertAnyStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, FUNCTION, [*], FUNCTION? -> this
    constructor(name, fn, candidates, errorHandler = null) {
        super("assert-any", name, { errorHandler });
        this._fn = fn;
        this._candidates = candidates;
    }

    get fn() { return this._fn; }
    get candidates() { return this._candidates; }
    get producesResult() { return true; }
    get expectedOutcome() { return { type: "candidates", candidates: this._candidates }; }

    // :: VOID -> VOID
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
