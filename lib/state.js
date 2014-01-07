"use strict";

var assert = require('assert'),
    debug = require('debuglog')('flowambassador');



/**
 * A state represents a pause which can be a view state or just a plain old waiting on an external event construct.
 * Initially will punt on documenting the input and output models because the execute functions that are registered
 * will know what models need to be used and will be handed the entire request context which should include the
 * the input/output models as well as any error/exception objects.
 * @param name
 * @param id
 * @constructor
 */
function State(name, id) {
   // State.super_.apply(this, arguments);

    this.flowId;
    this.id = id;
    this.name = name;
    this.type;

    // only for VIEW states
    this.viewName;

    // only for subflow states
    this.flowName;

    this.onEntry;
    this.error;

    this.userDefinedMethods = [];
    this.transitions = [];
}

State.states = {
    INIT: 'init',
    START: 'start',
    FLOW_COMPLETE: 'flow_complete'
};


State.types = {
    ACTION: 'action',
    VIEW: 'view',
    SUBFLOW: 'subflow'
};


State.prototype._doOnEntry = function(context, callback) {

    var self = this;

    this.onEntry(context, function (err, transitionKey) {

        // transitionKey in the callback only makes sense for an action class in a successful case
        // view state's onEntry should just be preparing data for the view

       // do NOT set context data here since the onEntry fn may have put pertain info there whether the call was
       // successful or not ... let the flow author decide when to overwrite/modify the flow context.data from
       // the data object.  This is important because ultimately the context.data object will be the model
       // returned in the response
       //   context.data = data;

        if(err) {
            debug('Got an biz logic error in state._doOnEntry for state: ' + self.name);
            context.flow.err = err;
            self._onEntryErrorHandler(context, callback);
        }
        else {
            callback(null, transitionKey);
        }
    });
};

/**
 * This function is used to call your registered onExit handler
 * @param data
 * @param context
 * @param callback
 * @private
 */
State.prototype._doOnExit = function(context, onExitMethodName, callback) {

    var onExitMethod = this.userDefinedMethods[onExitMethodName];
    assert(onExitMethod && typeof onExitMethod === 'function', 'Custom onExit function does NOT exist for name: ' +
        onExitMethodName);

    var self = this;
    onExitMethod(context, function (err) {

        if(err) {
            context.flow.err = err;
            self._onExitErrorHandler(context, callback);
        }
        else {
            callback(null, null);
        }
    });
};


/**
 * This function is called from this states registered onEntry function if an unhandled exception is thrown. It
 * currently just wraps this states registered error handler assuming that it has the biz logic to either perform
 * some compensation or transform/translate the error into a client recoverable or at a minimum support intelligent
 * debugging/testing.
 *
 * @param context   from the execute call will context.flow.err attached
 * @param callback
 * @private
 */
State.prototype._onEntryErrorHandler = function(context, callback) {
    assert(context.flow.err, 'state._onEntryErrorHandler() called with no existent error object');

    if(typeof this.error === 'function') {

        this.error(context, function (err, stateName) {

            return callback(err, stateName);
        }, 'onEntry');
    }
    else {
        // use error string transition state
        return callback( context.flow.err, this.error);
    }
};

/**
 * This function is called from this states registered onEntry function if an unhandled exception is thrown. It
 * currently just wraps this states registered error handler assuming that it has the biz logic to either perform
 * some compensation or transform/translate the error into a client recoverable or at a minimum support intelligent
 * debugging/testing.
 *
 * @param context   from the execute call will context.flow.err attached
 * @param callback
 * @private
 */
State.prototype._onExitErrorHandler = function(context, callback) {
    assert(context.flow.err, 'state._onExitErrorHandler() called with no existent error object');

    if(typeof this.error === 'function') {
        this.error(context, function (err, stateName) {

            // If user's error fn doesn't clear the err by passing in null in this callback, it is assumed that
            // the error may or may not be user recoverable error so the framework will deal with it accordingly
            if (!err) {
                delete context.flow.err;
            }

            // If user's error fn doesn't clear the err by passing in null in this callback, it is assumed that
            // the error is not a user recoverable error and the framework will deal with it accordingly;
            // so for a view that usually means staying in the same state or transitioning to some generic
            // error page
            return callback(err, stateName);
        }, 'onExit');
    }
    else {
        // use error string transition state
        callback( context.flow.err, this.error);
        return;
    }
};

/**
 * This function is called from this states registered error handler if an unhandled exception is thrown
 * @param context
 * @param callback
 * @private
 */
State.prototype._errorErrorHandler = function(context, callback, statePhase) {
    assert(context.flow.err, 'state._errorErrorHandler() called with no existent error object');

    // don't since you don't have any context, assumption is that this is a developer bug
    // in the error handler fn that was authored with the flow that will eventually be fixed
    callback(context.flow.err, this.id);
};


module.exports = State;
