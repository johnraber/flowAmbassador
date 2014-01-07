'use strict';

var State = require('../../lib/state'),
    onboardingDefintion = require('./onboardingFlowSpec');


/**
 * Test the specification for a verbose flow definition
 * @type {*}
 */
module.exports = {

    flowDefinition: onboardingDefintion,

    states: {
        guestSignup: {
            type: State.types.ACTION,
            onEntry: function (context, callback) {
                callback(null, 'success');

            },
            validateGuestInfo: function (context, callback) {
                callback(null);
            },
            error: function(context, callback) {
                // user recoverable
                callback(null, 'guestSignupView');
                // else
                callback(context.flow.err, 'genericErrorState');
            }
        },

        memberView: {
            type: State.types.VIEW,
            onEntry: function (context, callback) {
                callback(null, null);
            },
            error: function (context, callback, statePhase) {

                // framework will attach the error to the flow; context.flow.err = err, so just do custom processing
                callback(context.flow.err, null);
            }
        },

        guestSignupView: {
            type: State.types.VIEW,
            onEntry: function (context, callback) {
                callback(null, null);
            },
            error: function (context, callback, statePhase) {
                // framework will attach the error to the flow; context.flow.err = err, so just do custom processing
                callback(context.flow.err, 'genericErrorState');
            }
        },

        genericErrorState:  {
            type: State.types.VIEW,
            onEntry: function (context, callback) {

                callback(null);
            },
            error: function (context, callback, statePhase) {
                callback(null, null);
            }
        }
    }
};