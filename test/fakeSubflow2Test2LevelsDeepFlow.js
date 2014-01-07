'use strict';

var State = require('../lib/state'),
    AuthorizationDelegate = require('../lib/authorizationDelegate'),
    fakeSubflow2Test2LevelsDeepDef = require('./fakeSubflow2Test2LevelsDeepDef'),
    debug = require('debuglog')('flowambassador');


/**
 * Test the specification for a verbose flow definition
 * @type {*}
 */
module.exports = {

    flowDefinition: fakeSubflow2Test2LevelsDeepDef,

    authorizationDelegate:  new AuthorizationDelegate('fakeSubflow2Test2LevelsDeepFlow'),

    states: {
        doNothing: {
            type: State.types.ACTION,
            onEntry: function (context, callback) {
                var data = 'doing nothing';
                context.data = data;

                debug('doNothing onEntry');
                // no errors
                callback(null, 'success');
//                context.flow.err = 'fake error';
//                callback(context.flow.err);
            },
            error: function(context, callback) {
                debug('doNothing received error');
                debug(context.flow.err);
                callback(context.flow.err, 'end');
            }
        },


        doNothingView: {
            type: State.types.VIEW,
            onEntry: function (context, callback) {
                var data = 'Gathering data for doNothingView';
                context.data = data;

                debug('doNothingView onEntry');
                callback(null, null);
            },
            doNothingMethod: function (context, callback) {
                debug('doNothingMethod');
                // possibly do something cool like translation of the context.data object
                callback(null, null);
                // OR
                // callback(err)
            },
            error: function (context, callback, statePhase) {
                // framework will attach the error to the flow; context.flow.err = err, so just do custom processing

                callback(context.flow.err, null);
            }
        }
    }
};