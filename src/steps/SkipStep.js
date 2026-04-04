import CTGTestStep from "../CTGTestStep.js"; // Abstract step base
import CTGTestError from "../CTGTestError.js"; // Typed errors

// Skip step — evaluates a predicate and sets skipTargets on state.
// The pipeline reads skipTargets before executing the target step.
// Skip does not produce a result entry on success. On predicate error,
// the pipeline records an error result and does not skip the target.
export default class SkipStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, STRING, (ctgTestState -> BOOL)? -> this
    // Creates a skip step with a name, target step name, and optional
    // predicate. If the predicate is null, the skip is unconditional.
    constructor(name, targetName, predicate = null) {
        super("skip", name);
        this._targetName = targetName;
        this._predicate = predicate;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> STRING
    // Returns the name of the step to skip.
    get targetName() { return this._targetName; }

    // GETTER :: VOID -> (ctgTestState -> BOOL)|NULL
    // Returns the predicate function, or null for unconditional skip.
    get predicate() { return this._predicate; }

    // GETTER :: VOID -> BOOL
    // Skip steps do not produce result entries on success.
    get producesResult() { return false; }

    /**
     *
     * Instance Methods
     *
     */

    // :: VOID -> VOID
    // Validates that target name is non-empty and predicate is a function or null.
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

    // :: ctgTestState -> PROMISE(ctgTestState)
    // Evaluates the predicate against state and sets skipTargets[targetName].
    // If predicate is null, unconditionally sets the target to true.
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
