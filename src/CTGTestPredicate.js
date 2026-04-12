// Predicate type — carries an expected outcome and an evaluation function.
// Assert operations receive a predicate instance. The pipeline calls
// predicate.evaluate(state.computed) after the assert deposits its value.
export default class CTGTestPredicate {

    // CONSTRUCTOR :: *, (* -> BOOL) -> this
    // Private — use init().
    constructor(expectedOutcome, evaluate) {
        this._expectedOutcome = expectedOutcome;
        this._evaluate = evaluate;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> *
    // The value the predicate is checking against. Stored for diagnostics.
    get expectedOutcome() { return this._expectedOutcome; }

    // GETTER :: VOID -> (* -> BOOL)
    // The evaluation function. Receives computed value, returns true/false.
    get evaluate() { return this._evaluate; }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: *, (* -> BOOL) -> ctgTestPredicate
    // Creates a new predicate with the given expected outcome and evaluation function.
    static init(expectedOutcome, evaluate) {
        return new this(expectedOutcome, evaluate);
    }
}
