"use strict";

require('sugar');

var Flow = require("./flow"),
    State = require('./state'),
    assert = require('assert'),
    Transition = require('./transition');
//    debug = require('debuglog')('flowambassador');


/**
 * This method should be called to load the flow definition into the executable constructs in order to run a flow
 * instance. The middleware will dictate whether or not buildFlow is called in between each request to change state of
 * the flow passed in.
 *
 * @param flowInst
 * @param flowSpecImpl   this is the flow specificaton implementation that follows the schema outlined in the
 * README and the example in  ../../test/xoflow.js
 */
function buildFlow(flowInst, flowSpecImpl) {

    flowInst.name = flowSpecImpl.flowDefinition.flowName;
    assert(flowInst.name, 'Flow name is mandatory!');

    flowInst._startState = flowSpecImpl.flowDefinition.start_state;
    assert(flowInst._startState, 'Flow start state is mandatory!');

    flowInst._authorizationDelegate = flowSpecImpl.authorizationDelegate;

    if( !flowInst._authorizationDelegate && flowInst._parent) {
//        debug('init() using parent authorization delegate since subflow: ' + flowInst.name + '  does NOT have one!');
        flowInst._authorizationDelegate = flowInst._parent._authorizationDelegate;
    }

    flowInst._secured = flowSpecImpl.flowDefinition.secured;

    flowInst._endStates = flowSpecImpl.flowDefinition.endStates;

    assert(flowInst._endStates, 'Invalid flow def ... At least one flow end state event is mandatory!');

    buildStates(flowInst, flowSpecImpl);
    if( flowSpecImpl.subflows ) {
        buildSubflowStates(flowInst, flowSpecImpl);
        buildSubflows(flowInst, flowSpecImpl.subflows);
    }

    verifyStateTransitions(flowInst);

    flowInst.currentStateName = State.states.INIT;

//    debug(flowInst);
}


/**
 * Builds all subflows for this flow
 * @param flowInst
 * @param subflowSpecImpls   array of subflow specification objects
 */
function buildSubflows(flowInst, subflowSpecImpls) {

    var flowInstance = flowInst;

//    debug('>>>>>>>>>>flow:');
//    debug(flowInst);

    var subflowNames = [];

//    debug('>>>>>>>>>>Subflow specs:');
//    debug(subflowSpecImpls);

    if(subflowSpecImpls) {
        flowInst._subflows = {};
        subflowSpecImpls.forEach( function(subflowSpecImpl) {

            var subflow = new Flow(flowInstance._flowEventListeners, flowInstance.id, flowInstance);
            subflow._isSubflow = true;
            subflow._stateBuilderStartIndex = flowInstance._stateBuilderEndIndex + 1;
            subflow.setRenderCallback(flowInstance._renderCallback);

            buildFlow(subflow, subflowSpecImpl);

            flowInstance._subflows[subflow.name] = subflow;

            // validate that subflow names are unique
            assert(!subflowNames[subflow.name], 'Subflow name: ' + subflow.name + '  is NOT unique');
            subflowNames[subflow.name] = subflow.name;

            flowInstance._stateBuilderEndIndex = subflow._stateBuilderEndIndex;
        });
    }
}


/**
 *
 * @param flowInst
 * @param flowSpecImpl
 */
function buildSubflowStates(flowInst, flowSpecImpl) {
    var flowInstance = flowInst;

    // set the current index to use when creating new subflow states
    flowInst._stateBuilderIndex = flowInst._stateBuilderEndIndex + 1;

    // Retrieve all states and ensure there is at least a start and end
    Object.keys(flowSpecImpl.flowDefinition.states.subflow).forEach(function(subflowStateName){

        var subflowDefObj = flowSpecImpl.flowDefinition.states.subflow[subflowStateName];
        var state = new State(subflowStateName, flowInstance._stateBuilderIndex);
        state.flowName = subflowDefObj.flowName;
        state.type = State.types.SUBFLOW;

        assert(state.flowName,
            'Invalid flow definition ... subflow state MUST contain flowName property: ' +
                subflowDefObj.flowName);

        buildStateTransitions(state, flowSpecImpl);

        // validate that state names are unique
        flowInstance.endStates.forEach( function(endStateName)  {
            assert(endStateName !== state.name, 'Existing state name and end state name are the same: ' +
                endStateName);
        });

        flowInstance._states[flowInstance._stateBuilderIndex] = state;
        flowInstance._stateBuilderIndex += 1;
        flowInstance._statesByName[state.name] = state;
        //            debug('>>>>>>>>>> State:' + state.name + '  end state events object');
    });
    flowInst._stateBuilderEndIndex = flowInst._stateBuilderIndex - 1;

//    debug('>>>>>>>>>>>>>>>>  Flow: ' + flow.name + '   at end of buildSubflowStates(): ');
//    debug(flow.states);
}


/**
 * Builds action and view states but NOT subflow states
 * @param flowInst
 * @param initObj
 */
function buildStates(flowInst, initObj) {

    var flowInstance = flowInst;
    var startStateExists = false;

    flowInst._stateBuilderIndex = flowInst._stateBuilderStartIndex;

    // Retrieve all states and ensure there is at least a start and end
    Object.keys(initObj.states).forEach(function(stateName){
        var state = new State(stateName, flowInstance._stateBuilderIndex);

        state.onEntry =  initObj.states[stateName].onEntry;
        state.error =  initObj.states[stateName].error;
        state.type = initObj.states[stateName].type;

        assert(state.type,
            'Invalid flow definition ... State must have type in defintion for state: ' +
                stateName);

        if(state.type === State.types.VIEW) {
            state.viewName = initObj.flowDefinition.states.view[stateName].viewName;

            assert(state.viewName,
                'Invalid flow definition ... view state MUST have view name property: ' +
                    stateName);
        }

        assert(state.onEntry,
            'Invalid flow definition ... missing onEntry from state defintion for state: ' +
                stateName);

        assert.strictEqual(typeof state.onEntry, 'function',
            'Invalid flow def ... onEntry is not a function for state: ' + stateName);

        assert(state.error, 'Must have error defined for a state that is not a subflow state');

        // Iterate thru the state's properties to add any user defined functions to the state object
        Object.keys(initObj.states[stateName]).forEach(function(key){
            if(typeof key === 'string' && key !== 'onEntry' && key !== 'error' &&  key !== 'type' &&
                typeof initObj.states[stateName][key] === 'function')  {
                state.userDefinedMethods[key] = initObj.states[stateName][key];
            }
        });

        buildStateTransitions(state, initObj);

        // validate that state names are unique
        flowInstance.endStates.forEach( function(endStateName)  {
            assert(endStateName !== state.name, 'Existing state name and end state name are the same: ' +
                endStateName);
        });

        flowInstance._states[flowInstance._stateBuilderIndex] = state;
        flowInstance._stateBuilderIndex += 1;
        flowInstance._statesByName[state.name] = state;

        if( stateName === flowInstance._startState )
        {
            startStateExists = true;
        }
    });
    flowInst._stateBuilderEndIndex = flowInst._stateBuilderIndex - 1;

    // ensure that a start state exist
    if( startStateExists !== true)
    {
        throw new Error('Invalid flow def ... missing start state!');
    }
}


/**
 *
 * @param state
 * @param definitionObj
 */
function buildStateTransitions(state, definitionObj) {

    var eventTransitions;

    if(state.type === State.types.ACTION)  {
        eventTransitions = definitionObj.flowDefinition.states.action[state.name];
    }
    else  if(state.type === State.types.VIEW)  {
        eventTransitions = Object.clone(definitionObj.flowDefinition.states.view[state.name]);
        delete eventTransitions.viewName;

    }
    else if(state.type === State.types.SUBFLOW)  {
        eventTransitions = definitionObj.flowDefinition.states.subflow[state.name].transitions;
    }

    Object.merge(eventTransitions, definitionObj.flowDefinition.globalTransitions, eventTransitions);

    if(eventTransitions) {
        Object.keys(eventTransitions).forEach( function(event){
            var transition;
            if(typeof eventTransitions[event] === 'string') {

                transition = new Transition(state.name, state.id, event, eventTransitions[event]);
            }
            else if( typeof eventTransitions[event] ===  'object') {
                assert(state.type === State.types.VIEW,
                    'Transition definition can NOT be an object for state type: ' + state.type);
                transition = new Transition(state.name, state.id, event, eventTransitions[event].nextState,
                    eventTransitions[event].onExit);
            }
            else { throw new Error('Invalid transiton definition for state: ' + state.name); }

            state.transitions[event] = transition;
        });
    }
}

/**
*
* @param flowInst
*/
function verifyStateTransitions(flowInst) {

    Object.keys(flowInst.statesByName).forEach( function(stateName){

        var curState = flowInst.statesByName[stateName];
        var flowInstance = flowInst;
        Object.keys(curState.transitions).forEach( function(transitionKey) {

            var transitionState = curState.transitions[transitionKey]._toState;
            assert( findState(flowInstance, transitionState), 'State: ' + curState.name + '  transition for key: ' +
                transitionKey + ' to state: ' + transitionState +  ' is invalid!');
        });
    });
}

/**
*
* @param flowInst
* @param stateName
*/
function findState(flowInst, name) {

    var exists = false;
    Object.keys(flowInst.statesByName).some( function(stateName){
        if( stateName === name) {
            exists = true;
            return true;
        }
        return false;
    });

    if(!exists) {
        exists = flowInst.isEndState(name);
    }
    return exists;
}


module.exports = buildFlow;
