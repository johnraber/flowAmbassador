'use strict';


module.exports = {

    // this is the flow name that a parent flow must use for the substate name
    flowName: 'fakeSubflow2Test2LevelsDeepFlow',
    secured: [ 'ROLE_MEMBER'],
    start_state: 'doNothingView',


    states: {
        view: {
            doNothingView: {
                viewName: 'doNothingView',
                submit: { nextState: 'doNothing',  onExit: 'doNothingMethod' },
                testRedirectToMerchant: 'redirectToMerchant'
            }
        },

        action: {
            doNothing: {
                success: 'didNothing',
                error: 'didNothing'
                // what about possible error
            }
        }
    },

    // parent flow needs to end this subflow and then map the child end event to the parent next state
    endStates: ['didNothing', 'redirectToMerchant']
};



