'use strict';

var State = require('../lib/state'),
    AuthorizationDelegate = require('../lib/authorizationDelegate'),
    changeShippingAddressFlow = require('./changeShippingAddressFlow'),
    firstLevelSubflow =require('./firstLevelSubflow'),
    xoflowDefinition = require('./xoflowDefinition'),
    debug = require('debuglog')('flowambassador');


/**
 * Test the specification for a verbose flow definition
 * @type {*}
 */
module.exports = {

    flowDefinition: xoflowDefinition,

    authorizationDelegate:  new AuthorizationDelegate('xoflow'),

    subflows: [ changeShippingAddressFlow, firstLevelSubflow ],

    states: {
        updateBuyer: {
            type: State.types.ACTION,
            onEntry: function (context, callback) {
                var data = 'Updating buyer';
                context.data = data;

                debug('updateBuyer onEntry');
                // no errors
                callback(null, 'success');
//                context.flow.err = 'fake error';
//                callback(context.flow.err);
            },
            error: function(context, callback) {
                debug('UpdateBuyer received error');
                debug(context.flow.err);
                callback(context.flow.err, 'end');
            }
        },


        memberReview: {
            type: State.types.VIEW,
            onEntry: function (context, callback) {
                var data = 'Gathering data for member review view';
                context.data = data;

                debug('memberReview onEntry');
                callback(null, null);
            },
            noOpMethod: function (context, callback) {
                debug('noOpMethod');
                callback(null);
            },
            error: function (context, callback, statePhase) {
//                debug('Im in the error fn for memberReview!');
                // framework will attach the error to the flow; context.flow.err = err, so just do custom processing
                callback(context.flow.err, null);
            }
        },

        changeFundingSourceView: {
            type: State.types.VIEW,
            onEntry: function (context, callback) {
                var data = 'Gathering data for change funding source  view';
                context.data = data;

                debug('Gathering your funding source info to show in the view');
                callback(null, null);
            },
            error: function (context, callback, statePhase) {
                // framework will attach the error to the flow; context.flow.err = err, so just do custom processing
                callback(context.flow.err, 'genericPurchaseErrorState');
            }
        },

        changeFundingSource: {
            type: State.types.ACTION,
            onEntry: function (context, callback) {
                // possibly do something cool like translation of the context.data object
                var data = 'Changing your funding source';
                context.data = data;

                debug('Changing your funding source');
                callback(null, 'success');
            },
            error: function (context, callback) {
                // framework will attach the error to the flow; context.flow.err = err, so just do custom processing
                callback(context.flow.err, 'genericPurchaseErrorState');
            }
        },

        redirectToMerchant: {
            type: State.types.ACTION,
            onEntry: function (context, callback) {
                var data = {};
                context.data = data;

                debug('redirectToMerchant onEntry');
                // no errors

                context.data.flowControl = {};
                context.data.flowControl.redirectHeaders = {
                    'Access-Control-Allow-Origin' : '*'
                };
                context.data.flowControl.redirectURL = 'http://www.johnraber.net';
                callback(null, 'success');
            },
            error: function(context, callback) {
                debug('redirectToMerchant received error');
                debug(context.flow.err);
                callback(context.flow.err, 'cancelToMerchant');
            }
        },
        cancelToMerchant: {
            type: State.types.ACTION,
            onEntry: function (context, callback) {
                var data = 'cancelToMerchant';
                context.data = data;

                debug('cancelToMerchant onEntry');
                // no errors
                callback(null, 'success');
            },
            error: function(context, callback) {
                debug('cancelToMerchant received error');
                debug(context.flow.err);
                delete context.flow.err;

                // going back to merchant regardless
                callback(null, null);
            }
        },


        go2ChangeShippingAddressAction: {
            type: State.types.ACTION,
            onEntry: function (context, callback) {
                var data = 'go2ChangeShippingAddressAction';
                context.data = data;

                debug('go2ChangeShippingAddressAction onEntry');
                // no errors
                callback(null, 'success');
            },
            error: function(context, callback) {
                debug('go2ChangeShippingAddressAction received error');
                debug(context.flow.err);
                delete context.flow.err;

                callback(null, null);
            }
        },

        genericPurchaseErrorState:  {
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