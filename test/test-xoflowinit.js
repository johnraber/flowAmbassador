"use strict";

var assert = require('assert'),
    Flow = require('../lib/flow'),
    xoInitObj = require('./xoflow'),
    State = require('../lib/state'),
    flowBuilder = require('../lib/flowBuilder'),
    FlowRuntime = require('../lib/flowRuntime');


var flow;

var mimicMidddleFlow = function(flow) {
    console.log( 'Flow current state id: ' + flow.currentStateId);
    console.log( 'Flow current state name: ' + flow.currentStateName);
    console.log( 'Flow current subflow name: ' + flow.currentSubflowName);
};


describe("Test", function() {

    var responseObj = { data: null, flow: null};
    
    var renderCallback = function(context, flow) {
        responseObj.flow = flow;
//            console.log("Context in middleware from callback fn register in flow: " );
//            console.dir(context);
    };

    it("should init a XO flow and walk thru to completion", function(complete) {
        flow = new Flow();
        flow.setRenderCallback(renderCallback);

        flowBuilder(flow, xoInitObj);

        var context = {
            data: {}, // gotta put data here since middleware is not coping it over from the request body for me
            request: {
            }
        };

        // the middleware does this so the test must mimic since it is bypassing the middleware
        flow.currentStateName = State.states.INIT;
        flow.requestedEvent = null;


        context.flow = flow._flowContextSelectiveCopy();

        FlowRuntime.run(flow, context, renderCallback);

        assert( responseObj.flow.currentStateName === 'memberReview' );



        // should be in memberReview now
        flow.currentStateName = 'memberReview';
        flow.requestedEvent = 'changeFundingSource';


        context = {
            data: {}, // gotta put data here since middleware is not coping it over from the request body for me
            request: {
            }
        };

        context.flow = flow._flowContextSelectiveCopy();

        FlowRuntime.resume(flow, context, renderCallback);

        assert( responseObj.flow.currentStateName === 'changeFundingSourceView' );

        // in change funding source view now
        flow.currentStateName = 'changeFundingSourceView';
        flow.requestedEvent = 'submit';


        context = {
            data: {}, // gotta put data here since middleware is not coping it over from the request body for me
            request: {
            }
        };

        context.flow = flow._flowContextSelectiveCopy();

        FlowRuntime.resume(flow, context, renderCallback);

        assert( responseObj.flow.currentStateName === 'memberReview' );

        // Current state:  member review
        flow.currentStateName = 'memberReview';
        flow.requestedEvent = 'changeShippingAddress';


        context = {
            data: {}, // gotta put data here since middleware is not coping it over from the request body for me
            request: {
            }
        };

        context.flow = flow._flowContextSelectiveCopy();

        FlowRuntime.resume(flow, context, renderCallback);

        mimicMidddleFlow(responseObj.flow);

        assert(responseObj.flow.currentStateName === 'changeShippingAddressView');
        assert(responseObj.flow.isSubflow);
        assert(responseObj.flow.name === 'changeShippingAddressFlow');


        // Current state: changeShippingAddressView  Current flow: changeShippingAddressFlow
        flow.currentSubflowName = 'changeShippingAddressFlow';
        flow = flow.subflows.changeShippingAddressFlow;
        flow.currentStateName = 'changeShippingAddressView';
        flow.requestedEvent = 'cancel';  // want to test jumping out of subflow to parent flow


        context = {
            data: {}, // gotta put data here since middleware is not coping it over from the request body for me
            request: {
            }
        };

        context.flow = flow._flowContextSelectiveCopy();

        FlowRuntime.resume(flow, context, renderCallback);

//        console.dir(context.flow);
       // assert(responseObj.flow.currentStateName === 'memberReview' );
       // assert(!responseObj.flow.isSubflow);
       // assert(responseObj.flow.name === 'XO flow');

        complete();

    });

});