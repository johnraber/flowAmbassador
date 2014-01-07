'use strict';

module.exports = {

    flowName: 'Onboarding example',
    secured: null,
    start_state: 'guestSignup',

    states: {
        view: {
            guestSignupView: {
                viewName: 'guestSignup',   // name to be used by template rendering engine
                submit: { nextState: 'guestSignup', onExit: 'validateGuestInfo' }
            },
            memberView: {
                viewName: 'changeFundingSourceView',
                submit: 'changeFundingSource'
            },
            genericErrorState: {
                viewName: 'genericErrorState',
                submit: 'guestSignup'
            }
        },

        action: {
            guestSignup: {
                success: 'memberView',
                error: 'guestSignupView'
            }
        }
    },

    endStates: [ 'onboarded', 'quit'],

    globalTransitions: {
        genericUserError: 'genericErrorState'    // ' 'genericUserError' is a state name
    }
};



