// Immutable value object holding a single step definition
export default class CTGTestStep {

    // CONSTRUCTOR :: STRING, STRING, ((*) -> *)|ctgTest, *, ((*) -> *)? -> this
    // Creates a step definition. No validation here — deferred to CTGTest._validateSteps().
    constructor(type, name, fn, expected, errorHandler = null) {
        this._type = type;
        this._name = name;
        this._fn = fn;
        this._expected = expected;
        this._errorHandler = errorHandler;
    }

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> STRING
    get type() { return this._type; }

    // GETTER :: VOID -> STRING
    get name() { return this._name; }

    // GETTER :: VOID -> ((*) -> *)|ctgTest
    get fn() { return this._fn; }

    // GETTER :: VOID -> *
    get expected() { return this._expected; }

    // GETTER :: VOID -> ((*) -> *)|VOID
    get errorHandler() { return this._errorHandler; }
}
