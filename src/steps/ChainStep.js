import CTGTestStep from "../CTGTestStep.js";
import CTGTestError from "../CTGTestError.js";
import CTGTest from "../CTGTest.js";

// Chain step — inlines another pipeline's steps, threading the subject.
// Results are nested under a chain entry in the outer state.
export default class ChainStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, CTGTest -> this
    constructor(name, pipeline) {
        super("chain", name);
        this._pipeline = pipeline;
    }

    get pipeline() { return this._pipeline; }
    get producesResult() { return true; }

    // :: VOID -> VOID
    validate() {
        if (this._name.trim().length === 0) {
            throw new CTGTestError("INVALID_STEP", "Step name must not be empty");
        }
        if (!(this._pipeline instanceof CTGTest)) {
            throw new CTGTestError("INVALID_CHAIN",
                "Chain target must be a CTGTest instance");
        }
    }

    // :: CTGTestState -> PROMISE(CTGTestState)
    async execute(state) {
        const innerState = await this._pipeline.start(state.subject, state.config);
        state.subject = innerState.subject;
        state._chainResult = {
            name: this._name,
            steps: innerState.results,
            status: innerState.status
        };
        return state;
    }

}
