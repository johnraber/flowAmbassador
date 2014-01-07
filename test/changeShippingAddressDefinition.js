'use strict';

module.exports = {

    // this is the flow name that a parent flow must use for the substate name
    flowName: 'changeShippingAddressFlow',
    secured: [ 'ROLE_MEMBER'],
    start_state: 'primeFlow',

    states: {
        view: {
            changeShippingAddressView: {
                viewName: 'changeShippingAddressView',
                submit: { nextState: 'changeShippingAddress',  onExit: 'myCoolMethod' },
                addShipping: 'addShippingAddressView',
                cancel: 'cancelledChangeShippingAddress',
                test2LevelDeep: 'fakeSubflow2Test2LevelsDeepSubflow',
                goToActionToTestErrors: 'actionStateForErrorTesting'
            },
            addShippingAddressView: {
                viewName: 'addShippingAddressView',
                submit: 'addShippingAddress',
                cancel: 'changeShippingAddressView'
            },
            generalErrorPageView: {
                viewName: 'generalErrorPageView',
                submit: 'changeShippingAddressView'
            }
        },

        action: {
            changeShippingAddress: {
                success: 'changedShippingAddress',
                userInfoError: 'changeShippingAddressView'
                // what about possible error
            },
            addShippingAddress: {
                success: 'addedShippingAddress',
                userInfoError: 'addShippingAddressView'
            },
            primeFlow: {
                success: 'changeShippingAddressView',
                userInfoError: 'changeShippingAddressView'
            },
            testRedirectToMerchant: {
                success: 'redirectToMerchant'
            },
            actionStateForErrorTesting: {
                success: 'changeShippingAddressView'
            },
            actionStateForErrorRecovery: {
                success: 'changeShippingAddressView'
            }
        },
        subflow: {
            fakeSubflow2Test2LevelsDeepSubflow: {
                // the subflow name MUST be the exact flow name in the subflow definition file
                flowName: 'fakeSubflow2Test2LevelsDeepFlow',
                transitions: {
                    didNothing: 'changeShippingAddressView',
                    redirectToMerchant: 'redirectToMerchant'
                }
            }
        }
    },

    // parent flow needs to end this subflow and then map the child end event to the parent next state
    endStates: ['cancelledChangeShippingAddress', 'addedShippingAddress', 'changedShippingAddress', 'redirectToMerchant']
};



