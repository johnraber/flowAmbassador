"use strict";

var FlowEvents = require("./flowEvents"),
    debug = require('debuglog')('flowambassador');


/**
 *
 * @param listeners name
 * @constructor
 */
function FlowEventListener(listenerName) {
    this._listenerName = listenerName;
}

/**
 * Do NOT over-ride, over-write, or over-anything to  this method!
 *
 * @param eventName
 * @param context
 * @param callback
 */
FlowEventListener.prototype.onEvent = function(eventName, flowContext, callback) {

    if(eventName === FlowEvents.FLOW_START) {
        this.onStart(flowContext);
    }
    else if(eventName === FlowEvents.FLOW_RENDER) {
        this.onRender(flowContext);
    }
    else if(eventName === FlowEvents.FLOW_ABORT) {
        this.onAbort(flowContext);
    }
    else if(eventName === FlowEvents.FLOW_COMPLETE) {
        this.onComplete(flowContext);
    }
    else if(eventName === FlowEvents.FLOW_STATE_TRANSITION) {
        this.onStateTransition(flowContext);
    }
    else if(eventName === FlowEvents.FLOW_ERROR) {
        this.onError(flowContext);
    }
};


/**
 *
 * @param flowContext
 */
FlowEventListener.prototype.onStart = function(flowContext) {
    // no op
    debug('START from flow: ' + JSON.stringify(flowContext) + ' prototype handler for ' + this._listenerName);
};

/**
 *
 * @param flowContext you can NOT add extra data before it is returned to the client
 */
FlowEventListener.prototype.onRender = function(flowContext) {
    // no op
    debug('RENDER from flow: ' + JSON.stringify(flowContext) + ' prototype handler for ' + this._listenerName);
//    callback();
};

/**
 *
 * @param flowContext
 */
FlowEventListener.prototype.onAbort = function(flowContext) {
    // no op
    debug('ABORT from flow: ' + JSON.stringify(flowContext) + ' prototype handler for ' + this._listenerName);
};

/**
 *
 * @param flowContext
 */
FlowEventListener.prototype.onComplete = function(flowContext) {
    // no op
    debug('COMPLETED from flow: ' + JSON.stringify(flowContext) + ' prototype handler for ' + this._listenerName);
};

/**
 *
 * @param flowContext  see  README  context.flow for param structure
 */
FlowEventListener.prototype.onStateTransition = function(flowContext) {
    // no op
    debug('STATE TRANSITION from flow: ' + JSON.stringify(flowContext) + ' prototype handler for ' + this._listenerName);
};

/**
 *
 * @param flowContext
 */
FlowEventListener.prototype.onError = function(flowContext) {
    if (flowContext.err) {
        debug('Error from flow: ' + JSON.stringify(flowContext) + ' prototype handler for ' + this._listenerName);
//        debug(flowContext.err);
        return;
    }
    // no op
};


module.exports = FlowEventListener;