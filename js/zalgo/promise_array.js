var Promise = require("./get_promise").get();
var ensureNotHandled = require( "./errors").ensureNotHandled;
var util = require("./util");
var async = require( "./async");
var hasOwn = {}.hasOwnProperty;
var isArray = util.isArray;

function toFulfillmentValue( val ) {
    switch( val ) {
    case 0: return void 0;
    case 1: return [];
    case 2: return {};
    }
}

function PromiseArray( values, caller, boundTo ) {
    this._values = values;
    this._resolver = Promise.pending( caller );
    if( boundTo !== void 0 ) {
        this._resolver.promise._setBoundTo( boundTo );
    }
    this._length = 0;
    this._totalResolved = 0;
    this._init( void 0, 1 );
}
PromiseArray.prototype.length = function PromiseArray$length() {
    return this._length;
};

PromiseArray.prototype.promise = function PromiseArray$promise() {
    return this._resolver.promise;
};

PromiseArray.prototype._init =
function PromiseArray$_init( _, fulfillValueIfEmpty ) {
    var values = this._values;
    if( Promise.is( values ) ) {
        if( values.isFulfilled() ) {
            values = values._resolvedValue;
            if( !isArray( values ) ) {
                this._fulfill( toFulfillmentValue( fulfillValueIfEmpty ) );
                return;
            }
            this._values = values;
        }
        else if( values.isPending() ) {
            values._then(
                this._init,
                this._reject,
                void 0,
                this,
                fulfillValueIfEmpty,
                this.constructor
            );
            return;
        }
        else {
            this._reject( values._resolvedValue );
            return;
        }
    }
    if( values.length === 0 ) {
        this._fulfill( toFulfillmentValue( fulfillValueIfEmpty ) );
        return;
    }
    var len = values.length;
    var newLen = len;
    var newValues;
    if( this instanceof PromiseArray.PropertiesPromiseArray ) {
        newValues = this._values;
    }
    else {
        newValues = new Array( len );
    }
    var isDirectScanNeeded = false;
    for( var i = 0; i < len; ++i ) {
        var promise = values[i];
        if( promise === void 0 && !hasOwn.call( values, i ) ) {
            newLen--;
            continue;
        }
        var maybePromise = Promise._cast( promise );
        if( maybePromise instanceof Promise &&
            maybePromise.isPending() ) {
            maybePromise._then(
                this._promiseFulfilled,
                this._promiseRejected,
                this._promiseProgressed,

                this,                i,                 this._scanDirectValues
            );
        }
        else {
            isDirectScanNeeded = true;
        }
        newValues[i] = maybePromise;
    }
    if( newLen === 0 ) {
        this._fulfill( newValues );
        return;
    }
    this._values = newValues;
    this._length = newLen;
    if( isDirectScanNeeded ) {
        var scanMethod = newLen === len
            ? this._scanDirectValues
            : this._scanDirectValuesHoled;
        scanMethod.call(this, len);
    }
};

PromiseArray.prototype._resolvePromiseAt =
function PromiseArray$_resolvePromiseAt( i ) {
    var value = this._values[i];
    if( !Promise.is( value ) ) {
        this._promiseFulfilled( value, i );
    }
    else if( value.isFulfilled() ) {
        this._promiseFulfilled( value._resolvedValue, i );
    }
    else if( value.isRejected() ) {
        this._promiseRejected( value._resolvedValue, i );
    }
};

PromiseArray.prototype._scanDirectValuesHoled =
function PromiseArray$_scanDirectValuesHoled( len ) {
    for( var i = 0; i < len; ++i ) {
        if( this._isResolved() ) {
            break;
        }
        if( hasOwn.call( this._values, i ) ) {
            this._resolvePromiseAt( i );
        }
    }
};

PromiseArray.prototype._scanDirectValues =
function PromiseArray$_scanDirectValues( len ) {
    for( var i = 0; i < len; ++i ) {
        if( this._isResolved() ) {
            break;
        }
        this._resolvePromiseAt( i );
    }
};

PromiseArray.prototype._isResolved = function PromiseArray$_isResolved() {
    return this._values === null;
};

PromiseArray.prototype._fulfill = function PromiseArray$_fulfill( value ) {
    this._values = null;
    this._resolver.fulfill( value );
};

PromiseArray.prototype._reject = function PromiseArray$_reject( reason ) {
    ensureNotHandled( reason );
    this._values = null;
    this._resolver.reject( reason );
};

PromiseArray.prototype._promiseProgressed =
function PromiseArray$_promiseProgressed( progressValue, index ) {
    if( this._isResolved() ) return;
    this._resolver.progress({
        index: index,
        value: progressValue
    });
};

PromiseArray.prototype._promiseFulfilled =
function PromiseArray$_promiseFulfilled( value, index ) {
    if( this._isResolved() ) return;
    this._values[ index ] = value;
    var totalResolved = ++this._totalResolved;
    if( totalResolved >= this._length ) {
        this._fulfill( this._values );
    }
};

PromiseArray.prototype._promiseRejected =
function PromiseArray$_promiseRejected( reason ) {
    if( this._isResolved() ) return;
    this._totalResolved++;
    this._reject( reason );
};

module.exports = PromiseArray;
