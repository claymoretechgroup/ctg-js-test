import CTGTestStep from "../CTGTestStep.js";
import CTGTestError from "../CTGTestError.js";
import CTGTestState from "../CTGTestState.js";

// Stage step — transforms the subject on state.
// The callback receives state and must return state.
export default class StageStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, FUNCTION, FUNCTION? -> this
    constructor(name, fn, errorHandler = null) {
        super("stage", name, { errorHandler });
        this._fn = fn;
    }

    get fn() { return this._fn; }
    get producesResult() { return true; }

    // :: VOID -> VOID
    validate() {
        if (this._name.trim().length === 0) {
            throw new CTGTestError("INVALID_STEP", "Step name must not be empty");
        }
        if (typeof this._fn !== "function") {
            throw new CTGTestError("INVALID_STEP",
                `Step fn must be a function, got ${typeof this._fn}`);
        }
    }

    // :: CTGTestState -> PROMISE(CTGTestState)
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
