'use strict';

module.exports = {

    // this is the flow name that a parent flow must use for the substate name
    flowName: 'firstLevelFlow',
    secured: [ 'ROLE_MEMBER'],
    start_state: 'doSomethingView',


    states: {
        view: {
            doSomethingView: {
                viewName: 'doSomethingView',
                submit: 'doSomething',
                go2fakeSubflow2Test2LevelsDeepSubflow: 'fakeSubflow2Test2LevelsDeep'
            }
        },

        action: {
            doSomething: {
                success: 'didSomething'
            }
        },
        subflow: {
            fakeSubflow2Test2LevelsDeep: {
                // the subflow name MUST be the exact flow name in the subflow definition file
                flowName: 'fakeSubflow2Test2LevelsDeepFlow',
                transitions: {
                    didNothing: 'doSomething'
                }
            }
        }
    },

    // parent flow needs to end this subflow and then map the child end event to the parent next state
    endStates: ['didSomething']
};



