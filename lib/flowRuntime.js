"use strict";

var State = require("./state"),
    FlowEvents = require("./flowEvents"),
    assert = require('assert'),
    debug = require('debuglog')('flowambassador');




/**
 * This method is to be called when a subflow is complete, so that the parent flow can resume
 *
 * @param flowObj
 * @param endState
 * @param context
 * @param subflowName
 * @private
 */
function subflowEnded(flowObj, endState, context, subflowName) {

    assert(endState, 'End state must have a value');

    debug('Flow: ' + flowObj.name + ' current state should be a subflow: ' + flowObj.currentStateName);

    context.flow = flowObj._flowContextSelectiveCopy();

    // Defensive programming: rewind subflow in case it is called again within flow same user request/response
    // cycle
    flowObj.subflows[subflowName].currentStateName = State.states.INIT;

    flowObj.currentSubflowName = null;
    context.flow.currentSubflowName = null;

    debug('subflowEnded()   In flow:' + flowObj.name + ' in current state: ' + flowObj.currentStateName +
        ' and looking for transition for end state: ' + endState);

    var trans = flowObj.statesByName[flowObj.currentStateName].transitions[endState];
    assert(trans && trans._toState, 'Transition in parent flow: ' + flowObj.name +
        ' MUST exists for end state event: ' + endState);

    flowObj.requestedEvent = endState;
    context.flow.requestedEvent = endState;

    flowObj.requestedEvent = endState;
    flowObj.setRequestedStateNameAndContext(trans._toState, context);

    resume(flowObj, context, true);
}

/**
 * Start a flow  .... do NOT use to resume a flow
 *
 * @param flowObj
 * @param context
 */
function run(flowObj, context) {

    assert(context, 'Can not start flow without a context.');
    assert(flowObj.currentStateId, 'Can not start flow without initializing it.');

    var self = flowObj;

    flowObj._registerInternalListener('error', flowObj._errorCoordinator);

    flowObj._registerFlowEventListeners();

    assert(flowObj.currentStateId === State.states.INIT, 'You MUST call resume if the flow: ' + flowObj.name +
        ' is already running');

    flowObj._addComprehensiveStateHistory(State.states.INIT);

    // You must transition a flow from the init state to the start state
    flowObj.setRequestedStateNameAndContext(flowObj._startState, context);

    flowObj.emit(FlowEvents.FLOW_START, FlowEvents.FLOW_START, context.flow);

    debug('>>>>>>>>>> About to run flow: ' + flowObj.name + ' from start state: '+ flowObj._startState);

    onEntry(flowObj, context, function(endState, runSubflow, subflow, subflowContext){

        if(runSubflow) {
            debug('>>>>>>>>>>>>>>>>>>>>   About to run subflow: ' + subflow.name);
            assert(self.name !== subflow.name, 'Attempting to run a flow: ' + self.name + ' back on itself');
            return run(subflow, subflowContext);
        }
        else if(self.isSubflow && self.currentStateName === State.states.FLOW_COMPLETE) {
            return subflowEnded(self._parent, endState, context, self.name);
        }
        else {
            return self._render(context);
        }
    });
}

/**
 * Resume a flow ... should only be called by middleware or a flow instance managing a subflow ending and the
 * parent continuing. The requested event MUST be set before calling this method.
 *
 * @param flowObj
 * @param context
 * @param alreadyRunning  set to true if you are returning from subflows and resuming parent flow
 */
function resume(flowObj, context, alreadyRunning) {

    assert(context, 'Can not resume a flow without a context.');
    assert(flowObj.currentStateId, 'Can not resume a flow without initializing it.');

    // do NOT re-register exising listeners
    if(!alreadyRunning) {
        flowObj._registerInternalListener('error', flowObj._errorCoordinator);
        flowObj._registerFlowEventListeners();
    }

    var self = flowObj;
    var transition = flowObj.statesByName[flowObj.currentStateName].transitions[flowObj.requestedEvent];

    // Handle a requestEvent that could be an end state transition

    if(flowObj.isEndState(transition._toState) && !transition._onExit) {
        // Case: End event and No onExit method to call first

        flowObj._addComprehensiveStateHistory(flowObj.currentStateName);

        flowObj._endStateReached(context, transition._toState);

        if(!flowObj.isSubflow) {
            return flowObj._render(context);
        }
        else {
            return subflowEnded(flowObj._parent, transition._toState, context, flowObj.name);
        }
    }
    else {
        flowObj.setRequestedStateNameAndContext(transition._toState, context);

        if(transition._onExit) {
            // in a VIEW state

            if(flowObj.statesByName[flowObj.requestedStateName].type === State.types.SUBFLOW) {
                // if you successful execute onExit for flow VIEW then you will be transitioning to a SUBFLOW

                flowObj._authorize(context, flowObj.statesByName[flowObj.requestedStateName].flowName, function(allowed) {
                    var reallySelf = self;
                    if(!allowed)  {
                        return self._render(context);
                    }
                    else {
                        onExit(self, context, transition._onExit, function(endState, runSubflow, subflow, subflowContext) {

                            if(runSubflow){
                                assert(reallySelf.name !== subflow.name,
                                    'Attempting to run a flow: ' + reallySelf.name + ' back on itself');
                                return run(subflow, subflowContext);
                            }
                            else if(reallySelf.isSubflow && reallySelf.currentStateName === State.states.FLOW_COMPLETE) {
                                return subflowEnded(reallySelf._parent, endState, context, reallySelf.name);
                            }
                            else {
                                return reallySelf._render(context);
                            }
                        });
                    }
                });
            }
            else {
                // you are in a VIEW state and you next transition is not a SUBFLOW

                // must call onExit first then call next state which could be: end, view, action, or subflow
                onExit(flowObj, context, transition._onExit, function(endState, runSubflow, subflow, subflowContext){

                    if(runSubflow) {
                        debug('>>>>>>>>>>>>>>>>>>>>   About to run subflow: ' + subflow.name);
                        assert(self.name !== subflow.name, 'Attempting to run a flow: ' + self.name + ' back on itself');
                        return subflow.run(subflowContext);
                    }
                    else if(self.isSubflow && self.currentStateName === State.states.FLOW_COMPLETE) {
                        return subflowEnded(self._parent, endState, context, self.name);
                    }
                    else {
                        return self._render(context);
                    }
                });
            }
        }
        else {
            // you are NOT in a view state with an onExit method

            if(flowObj.statesByName[flowObj.requestedStateName].type === State.types.SUBFLOW) {
                // Authorize, set current to requested, copy context for subflow and run subflow

                flowObj._authorize(context, flowObj.statesByName[flowObj.requestedStateName].flowName, function(allowed) {
                    if(allowed)  {
                        self._preRunSubflow(context);
                        return run(self.subflows[self.currentSubflowName], context);
                    }
                    else {
                        return self._render(context);
                    }
                });
            }
            else {
                // No subflow so run onEntry for either ACTON or VIEW state

                onEntry(flowObj, context, function(endState, runSubflow, subflow, subflowContext){

                    if(runSubflow) {
                        debug('>>>>>>>>>>>>>>>>>>>>   About to run subflow: ' + subflow.name);
                        assert(self.name !== subflow.name, 'Attempting to run a flow: ' + self.name + ' back on itself');
                        return run(subflow, subflowContext);
                    }
                    else if(self.isSubflow && self.currentStateName === State.states.FLOW_COMPLETE) {
                        return subflowEnded(self._parent, endState, context, self.name);

                    }
                    else {
                        return self._render(context);
                    }
                });
            }
        }
    }
}


/**
 * Fired for ACTION, VIEW, SUBFLOW states
 *
 * @param flowObj
 * @param context
 * @param callback
 * @private
 */
function onEntry(flowObj, context, callback)  {

    assert(flowObj._requestedState, 'onEntry()  requested state must be set!');
    var self = flowObj;

    flowObj.requestedState._doOnEntry(context, function(err, transitionKey) {

        var endState;

        if(err) {
            // the transition key may be an endStateEvent or state name ( as in the case of the state's error fn
            // returning the next state )

            context.flow.err = err;
            endState = self.isEndState(transitionKey);
            onEntryError(self, context, endState, transitionKey, callback);
        }
        else {
            // onEntry is successful even if the state's error handler was called since it cleared the err obj

            // the transition key may be an endStateEvent or state name ( as in the case of the state's error fn returning
            // the next state ) or it may be a key for the requested states next state if onEntry was successful

            var transitionToStateName;
            if(self.requestedState.transitions[transitionKey]) {
                transitionToStateName = self.requestedState.transitions[transitionKey]._toState;
            }

            if(!transitionToStateName) {
                endState = self.isEndState(transitionKey);

                // transitionKey can be null for successful onEntry for view state
                transitionToStateName = transitionKey;
            }
            else {
                endState = self.isEndState(transitionToStateName);
            }


            // NOTE:  stateNameIfError is not used here since the configured transition will be
            // since the err object never existed or was cleared by the author's error handler, the framework
            // will assume normal behavior


            if(self.currentStateName !== State.states.INIT) {
                self._addComprehensiveStateHistory(self.currentStateName);
            }

            self.currentStateName = self.requestedStateName;
            context.flow.currentStateName =  self.currentStateName;
            context.flow.currentStateId =  self.currentStateId;

            self.emit(FlowEvents.FLOW_STATE_TRANSITION, FlowEvents.FLOW_STATE_TRANSITION, context.flow);

            self.clearRequestContext();

            if(self.statesByName[self.currentStateName].type === State.types.ACTION) {
                onEntrySuccessAction(self, context, endState, transitionToStateName, callback);
            }
            else if(self.statesByName[self.currentStateName].type === State.types.VIEW) {
                // successful execution of on entry

                if(!context.flow.viewName) {
                    context.flow.viewName = self.statesByName[self.currentStateName].viewName;
                }
                return callback();
            }
            else {
                throw new Error('Unknown case for flow engine in onEntry after successful call of onEntry');
            }
        }
    });
}

/**
 * Helper method so the onEntry method to handle success case for Action states
 *
 * @param flowObj
 * @param context
 * @param endState
 * @param transitionToStateName
 * @param callback
 * @returns {*}
 * @private
 */
function onEntrySuccessAction(flowObj, context, endState, transitionToStateName, callback) {
    // action state executed successfully so find next transition

    debug(flowObj.name  + '._onEntrySuccess():  currentStateName = ' + flowObj.currentStateName +
        '  endState = ' + endState  + '  transitionToStateName = ' + transitionToStateName);

    var self = flowObj;

    if(endState)
    {
        flowObj._addComprehensiveStateHistory(flowObj.currentStateName);
        flowObj._endStateReached(context, transitionToStateName);
        return callback(transitionToStateName);
    }

    assert(transitionToStateName, 'Unable to find next state to transition to from onEntry from state: ' +
        flowObj.currentStateName);
    flowObj.requestedStateName = transitionToStateName;

    if(flowObj.statesByName[flowObj.requestedStateName].type === State.types.SUBFLOW) {

        flowObj._authorize(context, flowObj.statesByName[flowObj.requestedStateName].flowName, function(allowed) {
            if(!allowed)  {
                return callback();
            }
            else {
                self._preRunSubflow(context);
                return callback(null, true, self.subflows[self.currentSubflowName], context);
            }
        });
    }
    else {
        return onEntry(flowObj, context, callback);
    }
}


/**
 * Helper method so the onEntry method to handle error cases
 *
 * @param flowObj
 * @param context   error has been attached to context.flow.err
 * @param endState
 * @param transitionToStateName
 * @param callback
 * @returns {*}
 * @private
 */
function onEntryError(flowObj, context, endState, transitionToStateName, callback) {

    // it is assumed that if an error exist,  the flowObj author was not able to handle the error in
    // their registered error fn ..... the error object should only exist for non user recoverable errors
    flowObj.emit(FlowEvents.FLOW_ERROR, FlowEvents.FLOW_ERROR, context.flow);

    if(!transitionToStateName) {

        return callback();
    }
    else {
        delete  context.flow.err;

        if(endState) {
            // handling an error by ending flow
            flowObj._endStateReached(context);
            return callback(transitionToStateName);
        }
        else if(transitionToStateName !== flowObj.currentStateName &&
            transitionToStateName !== flowObj.requestedStateName ) {

            // State transitions are permitted on errors if the state is not the current state or the original
            // requested state

            flowObj.requestedStateName = transitionToStateName;
            return onEntry(flowObj, context, callback);
        }
        else {
            // the flow engine will keep you in your currentState since flow author passed back the same
            // state name as the current or originally requested state

            var  specificationRule_1 = 'Specification rule: Flow authors who string together' +
                'consecutive action states must ensure that your error handler can handle a failure by providing' +
                'a transition state so that flow control can return via rendering.';

            // note in the specification to flow authors that if they string together consecutive action states
            // and there is a failure, that the should provided a transition state or else flow assert will
            // fail since currentState is an action state
            assert(flowObj.statesByName[flowObj.currentStateName].type === State.types.VIEW, specificationRule_1);
            return callback();
        }
    }
}

/**
 * Only called for VIEW states
 *
 * @param flowObj
 * @param context
 * @param onExitMethodName   read from the states' transition configuraton for the requested event
 * @param callback
 * @private
 */
function onExit(flowObj, context, onExitMethodName, callback)  {

    assert(flowObj.currentStateName && flowObj.statesByName[flowObj.currentStateName].type === State.types.VIEW,
        'onExit can only be called for a  VIEW state!');

    var self = flowObj;
    var endState;

    flowObj.statesByName[flowObj.currentStateName]._doOnExit(context, onExitMethodName, function(err, stateNameIfError) {

        if(err) {
            if(!stateNameIfError) {

                // set error in case the flow author does not
                context.flow.err = err;

                self.emit(FlowEvents.FLOW_ERROR, FlowEvents.FLOW_ERROR, context.flow);
                return callback();
            }
            else {
                // it is assumed that if the err exist and a state name is given the
                // benefit of the doubt to continue to process states and gracefully recover
                delete context.flow.err;

                if(stateNameIfError === self.currentStateName) {
                    context.flow.viewName = self.statesByName[self.currentStateName].viewName;
                    return callback();
                }
                else {
                    endState = self.isEndState(stateNameIfError);

                    if(endState) {
                        // handling an error by ending flow
                        self._endStateReached(context);
                        return callback(stateNameIfError);
                    }

                    self.requestedStateName = stateNameIfError;
                    return onEntry(self, context, callback);
                }
            }
        }
        else {
            // NOTE:  stateNameIfError is not used here since the configured transition will be
            // since the err object never existed or was cleared by the author's error handler, the framework
            // will assume normal behavior
            var transition = self.statesByName[self.currentStateName].transitions[self.requestedEvent];

            debug('Current state: ' + self.currentStateName + ' transition for the requested event: ' + self.requestedEvent + '  is: ');
            debug(transition);

            endState = self.isEndState(transition._toState);

            // check state name first before end state because the specification says to check state names
            // before end state events .... warn authors NOT to use same names
            if(self.statesByName[transition._toState]) {
                self.requestedStateName = transition._toState;

                debug('Calling _onEntry on requested state name: ' + self.requestedStateName);
                debug('Type: ' + self.statesByName[transition._toState].type);

                if(self.requestedState.type === State.types.SUBFLOW) {
                    // no need to call authorize because that was done in run() before calling onExit()

                    self._preRunSubflow(context);
                    return callback(null, true, self.subflows[self.currentSubflowName], context);
                }
                else {
                    return onEntry(self, context, callback);
                }
            }
            else if(endState) {
                self._endStateReached(context, endState);
                return callback(endState);
            }
            else {
                throw new Error('Unknown case in onExit() after successful onExit call!');
            }
        }
    });
}

module.exports.run = run;
module.exports.resume = resume;

