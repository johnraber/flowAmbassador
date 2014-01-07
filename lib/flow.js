"use strict";

require('sugar');

var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    State = require("./state"),
    FlowEvents = require("./flowEvents"),
    uuid = require('node-uuid'),
    assert = require('assert'),
    debug = require('debuglog')('flowambassador');




/**
 *
 * @param flowEventListeners
 * @param uid      will be generated if not passed in, subflows should use parent
 * @param parent   must be set if this is a subflow
 * @constructor
 */

function Flow(flowEventListeners, uid, parent) {
    Flow.super_.apply(this, arguments);

    // instance variables
    this._id = uid || uuid.v4();
    this._name;
    this._parent = parent;
    this._startState;

    // these two currentStateXXX fields will/must be kept in sync
    this._currentStateId;
    this._currentStateName;

    // this will be set by either the translation from the current state and request event OR from the flow
    // engine in the case of INIT/Start and action/subflow/end state chaining
    this._requestedStateName;
    this._requestedStateId;
    this._requestEvent;
    this._requestedState;

    // only for Parent flow .. Parent flow will include comprehensive history
    this._comprehensivePreviousStates = [];

    this._secured;
    this._authorizationDelegate;

    // states are index by each state's unique id or name
    this._states = {};
    this._statesByName = {};

    this._endStates;

    this._isSubflow = false;
    this._subflows;
    this._currentSubflowName;

    this._renderCallback;
    this._flowEventListeners = flowEventListeners || [];

    this._stateBuilderStartIndex = 0;
    this._stateBuilderEndIndex = 0;
    this._stateBuilderIndex = 0;
}



/**
 * Copies properties from src to dest, potentially overwriting previously defined properties.
 * @param src
 * @param dest
 * @returns {*}
 */
function mixin(src, dest) {
    var sources = Array.prototype.slice.call(arguments);
    dest = sources.pop();

    sources.forEach(function (source) {
        if (Object.isObject(source)) {
            Object.getOwnPropertyNames(source).forEach(function(name) {
                Object.defineProperty(dest, name, Object.getOwnPropertyDescriptor(source, name));
            });
        }
    });
    return dest;
}

util.inherits(Flow, EventEmitter);
mixin( {

    get name() {
        return this._name;
    },

    set name(name) {
        this._name = name;
    },

    get id() {
        return this._id;
    },

    get states() {
        return this._states;
    },

    get statesByName() {
        return this._statesByName;
    },

    get requestedState() {
        return this._requestedState;
    },

    get endStates() {
        return this._endStates;
    },

    get isSubflow() {
        return this._isSubflow;
    },


    setRequestedStateNameAndContext: function(requestedStateName, context) {
        this.requestedStateName = requestedStateName;
        context.flow.requestedStateName = this.requestedStateName;
    },

    get requestedStateId() {
        return this._requestedStateId;
    },

    /**
     * This method will set the current state Id and current state name for this flow and will NOT take into
     * account any subflow logic
     * @param requestedStateId
     */
    set requestedStateId(requestedStateId) {

        // States: State.states.FLOW_COMPLETE, and State.states.INIT
        // aren't in the definition outright

        if( requestedStateId === State.states.FLOW_COMPLETE || requestedStateId === State.states.INIT ) {
            this._requestedStateId = requestedStateId;
            this._requestedStateName = requestedStateId;

        }
        else if(this.states[requestedStateId]) {

            this._requestedStateId = requestedStateId;
            this._requestedStateName = this.states[requestedStateId].name;
            this._requestedState = this.states[requestedStateId];
        }
    },

    get requestedStateName() {
        return this._requestedStateName;
    },

    /**
     *  This method will set the current state Id and current state name for this flow and will takes into
     * account that a subflow state name may differ from the actual subflow name
     * @param requestedStateName
     */
    set requestedStateName(requestedStateName) {

        // States: State.states.FLOW_COMPLETE, and State.states.INIT
        // aren't in the definition outright

        if( requestedStateName === State.states.FLOW_COMPLETE || requestedStateName === State.states.INIT ||
            this.isEndState(requestedStateName) ) {
            this._requestedStateName = requestedStateName;
            this._requestedStateId = requestedStateName;

        }
        else {
            var stateName2Use = this._stateNameForSubflowName(requestedStateName);
            if(!stateName2Use ) {
                stateName2Use = requestedStateName;
            }
            assert(this._statesByName[stateName2Use],
                'State does NOT exists ..... attempting to set requesting state: ' +  stateName2Use +
                    ' for flow: ' + this.name);
            this._requestedStateName = stateName2Use;
            this._requestedStateId = this._statesByName[stateName2Use].id;
            this._requestedState = this.statesByName[stateName2Use];
        }
    },


    /**
     *
     * @param subflowName
     * @returns {*}
     * @private
     */
    _stateNameForSubflowName: function(subflowName) {
        var self = this;
        var stateName;
        Object.keys(this.statesByName).some( function(subflowStateName) {
            // find the state in this flow who's flow name is the same as this subflow name passed in
            if(self.statesByName[subflowStateName].flowName === subflowName) {
//                debug('Found state in this flow: ', subflowStateName, 'that matches this subflow flow name: ' +
//                    subflowName);
                stateName = subflowStateName;
                return true;
            }
            return false;
        });
        return stateName;
    },


    get currentStateId() {
        return this._currentStateId;
    },

    /**
     * This method will set the current state Id and current state name for this flow and will not take into
     * account any subflow logic
     * @param currentStateId
     */
    set currentStateId(currentStateId) {

        // States: State.states.FLOW_COMPLETE, and State.states.INIT
        // aren't in the definition outright

        if( currentStateId === State.states.FLOW_COMPLETE || currentStateId === State.states.INIT ) {
            this._currentStateId = currentStateId;
            this._currentStateName = currentStateId;

        }
        else  {
            assert(this.states[currentStateId], 'State does NOT exists ..... attempting to set current state id: ' +
                currentStateId + ' for flow: ' + this.name);
            this._currentStateId = currentStateId;
            this._currentStateName = this.states[currentStateId].name;
        }
    },


    get currentStateName() {
        return this._currentStateName;
    },

    /**
     *  This method will set the current state Id and current state name for this flow and will not take into
     * account any subflow logic
     * @param currentStateName
     */
    set currentStateName(currentStateName) {

        // States: State.states.FLOW_COMPLETE, and State.states.INIT
        // aren't in the definition outright

        if( currentStateName === State.states.FLOW_COMPLETE || currentStateName === State.states.INIT ) {
            this._currentStateId = currentStateName;
            this._currentStateName = currentStateName;

        }
        else if(this._statesByName[currentStateName]) {

            this._currentStateName = currentStateName;
            this._currentStateId = this._statesByName[currentStateName].id;
        }
//        this.emit(FlowEvents.FLOW_STATE_TRANSITION, FlowEvents.FLOW_STATE_TRANSITION, context.flow);
    },

    get requestedEvent() {
        return this._requestEvent;
    },

    set requestedEvent(requestedEvent) {
        this._requestEvent = requestedEvent;
    },

    _addComprehensiveStateHistory: function(stateName) {

//        debug('>>>>>>>>>>>>>>>>>>>>>>>  Adding state to comprehensive state history: '+ this.name + '::' + stateName);
        if(this.isSubflow) {
            this._parent._addComprehensiveStateHistory(this.name + '::' + stateName);
        }
        else {
            if(stateName.indexOf('::') === -1) {
                stateName = this.name + '::' + stateName;
            }
            this._comprehensivePreviousStates.push(stateName);
        }
    },

    _getComprehensiveStateHistory: function() {
        if(this.isSubflow) {
            return this._parent._getComprehensiveStateHistory();
        }
        else {
            return this._comprehensivePreviousStates;
        }
    },

    get secured() {
        return this._secured;
    },

    get subflows() {
        return this._subflows;
    },

    get currentSubflowName() {
        return this._currentSubflowName;
    },

    set currentSubflowName(currentSubflowName) {
        this._currentSubflowName = currentSubflowName;
    },

    clearRequestContext: function() {
        this._requestedStateName = null;
        this._requestedStateId = null;
        this._requestedState = null;
    },

    /**
     *
     * @param context
     * @param endState
     * @private
     */
    _endStateReached: function(context, endState) {

        // if endState is an end state event, capture it
        if(endState && endState !== State.states.FLOW_COMPLETE) {
            this._addComprehensiveStateHistory(endState);
        }
        else
        {
            this._addComprehensiveStateHistory(State.states.FLOW_COMPLETE);
        }

        this.currentStateName = State.states.FLOW_COMPLETE;
        context.flow.currentStateName = State.states.FLOW_COMPLETE;
        context.flow.currentStateId =  State.states.FLOW_COMPLETE;
        this.emit(FlowEvents.FLOW_COMPLETE, FlowEvents.FLOW_COMPLETE, context.flow);
    },


    /**
     *
     * @returns a mutable copy of specific flow context properties needed for the flow runtime
     * @private
     */
    _flowContextSelectiveCopy: function() {
        var flowCxtCopy = { };
        flowCxtCopy.id = this.id;
        flowCxtCopy.name = this.name;
        flowCxtCopy.currentStateName = this.currentStateName;
        flowCxtCopy.currentStateId = this.currentStateId;
        flowCxtCopy.subflow = this.isSubflow;
        flowCxtCopy.currentSubflowName = this.currentSubflowName;
        flowCxtCopy.requestedEvent = this.requestedEvent;
        flowCxtCopy.requestedStateName = this.requestedStateName;

        // make copy so that original can't be modified
        return Object.clone(flowCxtCopy, false);
    },


    /**
     *
     * @param context
     * @param subflowName
     * @param callback
     * @private
     */
    _authorize: function(context, subflowName, callback) {

        if(this._authorizationDelegate)
        {
            var roles;
            if(subflowName) {
                roles = this.subflows[subflowName].secured;
            }
            else {
                roles = this.secured;
            }
            this._authorizationDelegate.authorizeWithRequest(context.request, roles, function(err, allowed) {
                if(!allowed) {
                    context.flow.err = (err) ? err : new Error('Unauthorized');
                    context.flow.err.status = 401;
                }
                return callback(allowed);
            });
        }
        else {
            callback(true);
        }
    },


    /**
     *
     * @param context
     * @private
     */
    _preRunSubflow: function(context) {
        if(this.currentStateName !== State.states.INIT) {
            this._addComprehensiveStateHistory(this.currentStateName);
        }

        this.currentStateName = this.requestedStateName;
        context.flow.currentStateName = this.currentStateName;
        context.flow.currentStateId =  this.currentStateId;

        this.currentSubflowName = this.statesByName[this.currentStateName].flowName;
        context.flow.currentSubflowName =  this.currentSubflowName;

        this._subflows[this.currentSubflowName].currentStateId = State.states.INIT;
        context.flow = this._subflows[this.currentSubflowName]._flowContextSelectiveCopy();

        this.emit(FlowEvents.FLOW_STATE_TRANSITION, FlowEvents.FLOW_STATE_TRANSITION, context.flow);

        this.clearRequestContext();

//        debug('>>>>>>>>>>>>>>>>>>>>   About to run subflow: ' + this.currentSubflowName +
//              ' with current state name: ' +  this.currentStateName);
    },

    /**
     * Checks to see if the name is a end state event for this flow
     * @param name
     * @returns {boolean}
     */
    isEndState: function(name) {
        if(!name) { return false; }
        if( this._endStates.indexOf(name) !== -1 ) {
            return true;
        }
        return false;
    },


    /**
     * Adds render callback to this flow AND if this flow is initialized it will add the render callback to it's
     * subflows
     * @param fn
     */
    setRenderCallback: function(fn) {

        assert(fn, 'You can NOT register a null render callback function with flow: ' + this.name);
        this._renderCallback = fn;

        var self = this;

        // this method can be called before or after flow.init()
        if(this.subflows) {
            Object.keys(this.subflows).forEach( function(subflowName) {
                self.subflows[subflowName].setRenderCallback(fn);
            });
        }
    },


    /**
     * Unregistered all listeners and render this context before allowing any render listeners the ability to modify
     * the context.data
     * @param context
     * @private
     */
    _render: function(context) {

        this.emit(FlowEvents.FLOW_RENDER, FlowEvents.FLOW_RENDER, context.flow);

        this._deregisterListeners();
        this._renderCallback(context, this);
    },


    /**
     * Last ditch effort to catch error's that haven't been handled.
     * @param err
     * @param context
     * @private
     */
    _errorCoordinator: function(err, context) {
        var self = this;
        if (err) {
            debug('Error from flow: ' + self._id + '  and here is the error:');
            debug(err);
            return;
        }
    },


    /** Initially building the flow event listener registration to call the registered callback with all flow
     * events. Can move towards a more sophisticated registration per event type if need later on.  As of now,
     * it is still possible to create a new flow and then call flow.on(FlowEvents.<event>, callback);
     *
     * @param flowEventListeners should be an array of event listener callbacks
     */
    _registerFlowEventListeners: function() {

        var self = this;

        this._flowEventListeners.forEach( function(flowEventListener) {
            if(flowEventListener) {
                Object.keys(FlowEvents).forEach( function(eventKey) {
                    self.on(FlowEvents[eventKey], flowEventListener.onEvent.bind(flowEventListener));
                });
            }
        });
    },

    /**
     * Adds all listeners needed by flow framework so that you are able to support a truly stateless application on top
     * of a Node cluster by adding and removing listeners for each request/response cycle.  Remember, that each request
     * may go to another copy of this framework running on another Node instance.
     *
     * @param event
     * @param callback
     * @private
     */
    _registerInternalListener: function(event, callback) {

        this.on(event, callback);
    },

    /**
     * Removes all listeners so that you are able to support a truly stateless application on top of a Node cluster by
     * adding and removing listeners for each request/response cycle.  Remember, that each request may go to
     * another copy of this framework running on another Node instance.
     *
     * @private
     */
    _deregisterListeners: function() {

        this.removeAllListeners();
    },

    /**
     * For use by middleware to call before calling run on a flow to validate the user input
     *
     * @param reqEvent
     * @returns {boolean}
     */
    validateEventForCurrentState: function(reqEvent) {
        if(this.statesByName[this.currentStateName].transitions[reqEvent] || this._endStates[reqEvent] )
        {
            return true;
        }
        return false;
    }
}, Flow.prototype);

module.exports = Flow;