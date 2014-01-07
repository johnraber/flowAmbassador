'use strict';

var State = require('../lib/state'),
    AuthorizationDelegate = require('../lib/authorizationDelegate'),
    firstLevelSubflowDefinition = require('./firstLevelSubflowDefinition'),
    fakeSubflow2Test2LevelsDeepFlow = require('./fakeSubflow2Test2LevelsDeepFlow');


/**
 * Test the specification for a verbose flow definition
 * @type {*}
 */
module.exports = {

    flowDefinition: firstLevelSubflowDefinition,

    authorizationDelegate:  new AuthorizationDelegate('firstLevelSubflowDefinition'),

    subflows: [ fakeSubflow2Test2LevelsDeepFlow ],

    states: {
        doSomethingView: {
            type: State.types.VIEW,
            onEntry: function (context, callback) {
                callback(null, null);
            },
            error: function (context, callback, statePhase) {
                // framework will attach the error to the flow; context.flow.err = err, so just do custom processing
                var stateNameToTransitionTo;

                if(statePhase === 'onExit')
                {
                    console.log('Test handling an known client error in doSomethingView');
                    // do something cool like offer BML
                    context.data = {'Execute data': 'Data with errors fool'};
                    context.data.errors = [];
                    context.data.errors.push({'User error': 'recoverable'});
                    context.flow.err = null;
                    stateNameToTransitionTo = null; // state in this view

                    callback(context.flow.err, stateNameToTransitionTo);
                }
            }
        },

        doSomething: {
            type: State.types.ACTION,
            onEntry: function (context, callback) {
                // possibly do something cool like translation of the context.data object
                callback(null, 'success');
                // or
                // callback(null, 'userInfoError');

            },
            error: function (context, callback) {
                // framework will attach the error to the flow; context.flow.err = err, so just do custom processing
                callback(context.flow.err, 'success');
            }
        }
    }
};