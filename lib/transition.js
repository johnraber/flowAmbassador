"use strict";


/**
 *
 * @param stateName
 * @param stateId
 * @param event
 * @param toState
 * @param onExit
 * @constructor
 */
function Transition(stateName, stateId, event, toState, onExit) {

    this._stateName = stateName;
    this._stateId = stateId;
    this._event = event;
    this._toState = toState;
    this._onExit = onExit;
}


module.exports = Transition;

