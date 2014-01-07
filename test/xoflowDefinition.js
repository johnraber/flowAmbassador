'use strict';

module.exports = {

    flowName: 'XO flow',
    secured: ['ROLE_MEMBER'],
    start_state: 'updateBuyer',

    states: {
        view: {
            memberReview: {
                viewName: 'memberReview',
                changeFundingSource: 'changeFundingSourceView',
                changeShippingAddress: 'changeShippingAddressSubflow',
                submit: { nextState: 'redirectToMerchant', onExit: 'noOpMethod' },
                changeShippingAddressWithOnExit: { nextState: 'changeShippingAddressSubflow', onExit: 'noOpMethod' },
                go2ChangeShippingAddressAction: 'go2ChangeShippingAddressAction',
                go2firstLevelSubflow: 'firstLevelSubflow'
            },
            changeFundingSourceView: {
                viewName: 'changeFundingSourceView',
                submit: 'changeFundingSource'
            },
            genericPurchaseErrorState: {
                viewName: 'genericPurchaseError',
                submit: 'memberReview'
            }
        },

        action: {
            updateBuyer: {
                success: 'memberReview'
            },
            // these transitions events need to be returned from your onEntry
            changeFundingSource: {
                success: 'memberReview',
                error: 'changeFundingSourceView'
            },
            redirectToMerchant: {
                success: 'redirectedToMerchant',
                error: 'cancelToMerchant'
            },
            cancelToMerchant: {
                success: 'redirectToMerchant'
            },
            go2ChangeShippingAddressAction: {
                success: 'changeShippingAddressSubflow'
            }
        },

        subflow: {
            changeShippingAddressSubflow: {
                // the subflow name MUST be the exact flow name in the subflow definition file
                flowName: 'changeShippingAddressFlow',
                transitions: {
                    cancelledChangeShippingAddress: 'memberReview',
                    addedShippingAddress: 'memberReview',
                    changedShippingAddress: 'memberReview',
                    redirectToMerchant: 'redirectToMerchant'
                }
            },
            firstLevelSubflow: {
                flowName: 'firstLevelFlow',
                transitions: {
                    didSomething: 'memberReview'
                }
            }
        }
    },

    // parent flow needs to end this subflow and then map the child end event to the parent next state
    // can't put 'redirectToMerchant', 'cancelToMerchant' in there yet because of logic in framework
    endStates: [ 'redirectedToMerchant', 'cancelledToMerchant'],


    globalTransitions: {
        genericUserError: 'genericPurchaseErrorState'    // ' 'genericUserError' is a state name
    }
};



