import CTGTestStep from "../CTGTestStep.js"; // Abstract step base
import CTGTestError from "../CTGTestError.js"; // Typed errors
import CTGTest from "../CTGTest.js"; // Pipeline class for instanceof check

// Chain step — inlines another pipeline's steps, threading the subject.
// Results are nested under a chain entry in the outer state.
export default class ChainStep extends CTGTestStep {

    // CONSTRUCTOR :: STRING, ctgTest -> this
    // Creates a chain step with a name and a CTGTest instance to inline.
    constructor(name, pipeline) {
        super("chain", name);
        this._pipeline = pipeline;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> ctgTest
    // Returns the chained pipeline instance.
    get pipeline() { return this._pipeline; }

    // GETTER :: VOID -> BOOL
    // Chain steps produce result entries.
    get producesResult() { return true; }

    /**
     *
     * Instance Methods
     *
     */

    // :: VOID -> VOID
    // Validates that the target is a CTGTest instance and name is non-empty.
    validate() {
        if (this._name.trim().length === 0) {
            throw new CTGTestError("INVALID_STEP", "Step name must not be empty");
        }
        if (!(this._pipeline instanceof CTGTest)) {
            throw new CTGTestError("INVALID_CHAIN",
                "Chain target must be a CTGTest instance");
        }
    }

    // :: ctgTestState -> PROMISE(ctgTestState)
    // Executes the chained pipeline with the current state.subject and
    // state.config. Updates state.subject with the chained pipeline's final
    // subject. Sets state._chainResult with nested results and status for
    // the pipeline to record.
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
