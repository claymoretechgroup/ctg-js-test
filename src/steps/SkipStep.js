import CTGTestStep from "../CTGTestStep.js";
import CTGTestError from "../CTGTestError.js";

// Skip step — evaluates a predicate and sets skipTargets on state.
// The pipeline reads skipTargets before executing the target step.
// Skip does not produce a result entry.
export default class SkipStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, STRING, FUNCTION? -> this
    constructor(name, targetName, predicate = null) {
        super("skip", name);
        this._targetName = targetName;
        this._predicate = predicate;
    }

    get targetName() { return this._targetName; }
    get predicate() { return this._predicate; }
    get producesResult() { return false; }

    // :: VOID -> VOID
    validate() {
        if (this._name.trim().length === 0) {
            throw new CTGTestError("INVALID_STEP", "Step name must not be empty");
        }
        if (typeof this._targetName !== "string" || this._targetName.trim().length === 0) {
            throw new CTGTestError("INVALID_SKIP",
                "Skip target name must be a non-empty string");
        }
        if (this._predicate !== null && typeof this._predicate !== "function") {
            throw new CTGTestError("INVALID_SKIP", "Skip predicate must be a function");
        }
    }

    // :: CTGTestState -> PROMISE(CTGTestState)
    async execute(state) {
        const target = this._targetName.trim();
        if (this._predicate === null) {
            state.skipTargets[target] = true;
        } else {
            const shouldSkip = await this._predicate(state);
            state.skipTargets[target] = !!shouldSkip;
        }
        return state;
    }

}
