export default class CTGTestStep {

    constructor(type, name, fn, expected, errorHandler = null) {
        this._type = type;
        this._name = name;
        this._fn = fn;
        this._expected = expected;
        this._errorHandler = errorHandler;
    }

    get type() { return this._type; }
    get name() { return this._name; }
    get fn() { return this._fn; }
    get expected() { return this._expected; }
    get errorHandler() { return this._errorHandler; }
}
