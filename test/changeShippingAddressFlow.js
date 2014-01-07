'use strict';

var State = require('../lib/state'),
    changeShippingAddressDefinition = require('./changeShippingAddressDefinition'),
    fakeSubflow2Test2LevelsDeepFlow = require('./fakeSubflow2Test2LevelsDeepFlow'),
    debug = require('debuglog')('flowambassador');


/**
 * Test the specification for a verbose flow definition
 * @type {*}
 */
module.exports = {

    flowDefinition: changeShippingAddressDefinition,

    authorizationDelegate:  null,

    subflows: [ fakeSubflow2Test2LevelsDeepFlow ],

    states: {

        changeShippingAddressView: {
            type: State.types.VIEW,
            onEntry: function (context, callback) {

                if(context.data.testUserRecoverableErrorCase)
                {
                    var testError = new Error('testUserRecoverableErrorCase');
                    callback(testError);
                }
                else {
                    callback(null, null);
                }
            },
            myCoolMethod: function (context, callback) {
                debug('myCoolMethod is executing');
                // possibly do something cool like translation of the context.data object

                var testError;
                if(context.data.testUserRecoverableErrorCase)
                {
                    testError  = new Error('testUserRecoverableErrorCase');
                    testError.type = 'testUserRecoverableErrorCase';
                    callback(testError);
                }
//                else if(context.data.testThrowUnknownError) {
//                    testError = new Error('testThrowUnknownErrorHandleWithGeneralErrorPageView');
//                    testError.type = 'testThrowUnknownErrorHandleWithGeneralErrorPageView';
//                    throw testError;
//                }
//                else if(context.data.testThrowUnknownErrorNoRender) {
//                    testError = new Error('testThrowUnknownErrorNoRender');
//                    testError.type = 'testThrowUnknownErrorNoRender';
//                    throw testError;
//                }
                else {
                    callback(null);
                }
            },
            error: function (context, callback, statePhase) {
                // framework will attach the error to the flow; context.flow.err = err, so just do custom processing
                var stateNameToTransitionTo;

                if(statePhase === 'onExit')
                {
                    if(context.flow.err.type === 'testThrowUnknownErrorHandleWithGeneralErrorPageView') {
                        debug('Test handling a non-user recoverable error in phase: ' + statePhase + 'changeShippingAddressView');
                        stateNameToTransitionTo = 'generalErrorPageView';
                        callback(context.flow.err, stateNameToTransitionTo);
                    }
                    else if(context.flow.err.type ===  'testUserRecoverableErrorCase')  {
                        debug('Test handling an known client error in changeShippingAddressView');
                        // do something cool like offer BML
                        context.data = {'FakeUserRecoverableMsg': 'not a valid data ... FIX IT NOW ... haha'};
                        context.data.errors = [];
                        context.data.errors.push({'User error': 'recoverable'});
                        stateNameToTransitionTo = 'changeShippingAddressView'; // stay in this view
                        callback(context.flow.err, stateNameToTransitionTo);
                    }
                    else {
                        // assume unknown error with no transition to any state so no rendering
                        // this case should test your middleware handler for next(err)
                        stateNameToTransitionTo = null;
                        callback(context.flow.err, stateNameToTransitionTo);
                    }
                }
                else {
                    // statePhase === 'onEntry'
                    stateNameToTransitionTo =  'genericPurchaseErrorState';
                    callback(context.flow.err, stateNameToTransitionTo);
                }
            }
        },

        generalErrorPageView:  {
            type: State.types.VIEW,
            onEntry: function (context, callback) {

                callback(null);
            },
            error: function (context, callback, statePhase) {
                callback(null, null);
            }
        },

        addShippingAddressView: {
            type: State.types.VIEW,
            onEntry: function (context, callback) {
                callback(null);
            },
            error: function (context, callback, statePhase) {
                // framework will attach the error to the flow; context.flow.err = err, so just do custom processing
                callback(context.flow.err, null);
            }
        },

        changeShippingAddress: {
            type: State.types.ACTION,
            onEntry: function (context, callback) {
                // possibly do something cool like translation of the context.data object
                callback(null, 'success');
                // or
                // callback(null, 'userInfoError');

            },
            error: function (context, callback) {
                // framework will attach the error to the flow; context.flow.err = err, so just do custom processing
                callback(context.flow.err, 'userInfoError');
            }
        },


        testRedirectToMerchant: {
            type: State.types.ACTION,
            onEntry: function (context, callback) {
                // possibly do something cool like translation of the context.data object
                callback(null, 'success');
            },
            error: function (context, callback) {
                // framework will attach the error to the flow; context.flow.err = err, so just do custom processing
                callback(context.flow.err, 'userInfoError');
            }
        },

        addShippingAddress: {
            type: State.types.ACTION,
            onEntry: function (context, callback) {
                // possibly do something cool like translation of the context.data object
                callback(null, 'success');
            },
            error: function (context, callback) {
                // framework will attach the error to the flow; context.flow.err = err, so just do custom processing
                callback(context.flow.err, 'userInfoError');
            }
        },

        primeFlow: {
            type: State.types.ACTION,
            onEntry: function (context, callback) {
                // possibly do something cool like translation of the context.data object
                debug('>>>>>>>>>>> Priming fake action state to test coming into subflow with action state');
                callback(null, 'success');
            },
            error: function (context, callback) {
                // framework will attach the error to the flow; context.flow.err = err, so just do custom processing
                callback(context.flow.err, 'userInfoError');
            }
        },

        actionStateForErrorRecovery: {
            type: State.types.ACTION,
            onEntry: function (context, callback) {
                // possibly do something cool like translation of the context.data object
                debug('>>>>>>>>>>> actionStateForErrorRecovery');
                callback(null, 'success');
            },
            error: function (context, callback) {
                // framework will attach the error to the flow; context.flow.err = err, so just do custom processing
                callback(context.flow.err, 'userInfoError');
            }
        },

        actionStateForErrorTesting: {
            type: State.types.ACTION,
            onEntry: function (context, callback) {
                debug('>>>>>>>>>>> action state to use as a starting spot to test errors');

                // Normal op would be callback(null, 'success');

                var testError;
                if(context.data.testUserRecoverableErrorCase)
                {
                    testError  = new Error('testUserRecoverableErrorCase');
                    testError.type = 'testUserRecoverableErrorCase';
                    callback(testError);
                }
//                else if(context.data.testThrowUnknownError) {
//                    testError = new Error('testThrowUnknownErrorHandleWithGeneralErrorPageView');
//                    testError.type = 'testThrowUnknownErrorHandleWithGeneralErrorPageView';
//                    throw testError;
//                }
//                else if(context.data.testThrowUnknownErrorNoRender) {
//                    testError = new Error('testThrowUnknownErrorNoRender');
//                    testError.type = 'testThrowUnknownErrorNoRender';
//                    throw testError;
//                }
                else {
                    callback(null);
                }
            },
            error: function (context, callback, statePhase) {
                // framework will attach the error to the flow; context.flow.err = err, so just do custom processing
                var stateNameToTransitionTo;

                if(context.flow.err.type === 'testThrowUnknownErrorHandleWithGeneralErrorPageView') {
                    debug('Test handling a non-user recoverable error in phase: ' + statePhase + 'actionStateForErrorTesting');
                    stateNameToTransitionTo = 'generalErrorPageView';
                    callback(context.flow.err, stateNameToTransitionTo);
                }
                else if(context.flow.err.type ===  'testUserRecoverableErrorCase')  {
                    debug('Test handling an known client error in actionStateForErrorTesting');
                    // do something cool like offer BML
                    context.data = {'FakeUserRecoverableMsg': 'not a valid data ... FIX IT NOW ... haha'};
                    context.data.errors = [];
                    context.data.errors.push({'User error': 'recoverable'});
                    stateNameToTransitionTo = 'actionStateForErrorRecovery';
                    callback(context.flow.err, stateNameToTransitionTo);
                }
                else {
                    // assume unknown error with no transition to any state so no rendering
                    // this case should test your middleware handler for next(err)
                    stateNameToTransitionTo = null;
                    callback(context.flow.err, stateNameToTransitionTo);
                }
            }
        }
    }
};