"use strict";

require('sugar');

var util = require('util'),
    EventEmitter = require("events").EventEmitter,
    Flow = require("./flow"),
    FlowRuntime = require('./flowRuntime'),
    flowBuilder = require('./flowBuilder'),
    State = require("./state"),
    assert = require('assert'),
    debug = require('debuglog')('flowambassador');



/**
 * You should create a new director for each flow type ( aka the spec passed in )
 *
 * @param spec
 * @param isRenderer
 * @constructor
 */
function SenorDirector(spec, isRenderer) {
    this._spec = spec;
    this._isRenderer = isRenderer;
    this._flowEventListeners = [];
    this._registerInternalErrorListener();
}


util.inherits(SenorDirector, EventEmitter);


 /**
 * The middleware for this flow.
 *
 * @returns {Function}
 */
SenorDirector.prototype.requestHandler = function() {

    var self = this;

    return function(req, res, next) {

        var context = {};
        var flow;

        var flowExecutionKey = req.param('execution');
        var reqFlowId;


        if(flowExecutionKey === undefined) {

            flow = new Flow(self._flowEventListeners);
            flow.setRenderCallback( self._render.bind(self) );
            flowBuilder(flow, self._spec);

            context.flow = flow._flowContextSelectiveCopy();
            context.data =   (req.body && req.body.data ) ? req.body.data : {};
            context.request = req;
            context.response = res;
            context.next = next;


            if( !req.session.flows) {
                req.session.flows = {};
                req.session.flows[flow.id] = {
                    currentStateId: flow.currentStateId
                };
            }

            flow._authorize(context , null, function(allowed) {
                if(allowed)  {
                    FlowRuntime.run(flow, context);
                }
                else {
                    return self._render(context, flow);
                }
            });
        }
        else {
            reqFlowId = flowExecutionKey.substring(0, flowExecutionKey.lastIndexOf('S') );

            if(!req.session.flows[reqFlowId]) {
                self._buildErrorResponseModel( self._buildUnservicableError('Request flow id: ' + reqFlowId +
                    ' is not an existing flow in the stored session', 404), res);

                return next(res.flowResponseModel.flow.err);
            }

            if(req.session.flows[reqFlowId].currentStateName === State.states.FLOW_COMPLETE) {
                self._buildErrorResponseModel( self._buildUnservicableError(
                    'Flow has completed previously!', 410), res);
                return next(res.flowResponseModel.flow.err);
            }

            var requestorCurrentStateId = parseInt( flowExecutionKey.substring(flowExecutionKey.lastIndexOf('S') + 1,
                flowExecutionKey.length), 10);

            if(!requestorCurrentStateId) {
                self._buildErrorResponseModel(self._buildUnservicableError(
                    'The flow execution key does NOT contain the requestor current state for flow: ' + reqFlowId,
                    406), res);
                return next(res.flowResponseModel.flow.err);
            }

            var reqEvent = req.param('_eventId') || req.param('flow')._eventId;

            if(reqEvent !== 0 && !reqEvent) {
                self._buildErrorResponseModel( self._buildUnservicableError(
                    'No requested event for flow : ' + reqEvent, 406), res );
                return next(res.flowResponseModel.flow.err);
            }

            flow = new Flow(self._flowEventListeners, reqFlowId);
            flow.setRenderCallback( self._render.bind(self) );
            flowBuilder(flow, self._spec);

            //Rehydrate new flow from session then set context
            flow._comprehensivePreviousStates =  req.session.flows[reqFlowId].comprehensivePreviousStates;

            var flow2Run = self._setFlowTreeCurrentState(flow, requestorCurrentStateId, reqEvent,
                req.session.flows[reqFlowId].currentStateId,   req.session.flows[reqFlowId].currentStateName);

            if(!flow2Run.validateEventForCurrentState(reqEvent) )
            {
                self._buildErrorResponseModel(self._buildUnservicableError('Request event: ' + reqEvent +
                    '  is NOT valid for the current state: ' + flow2Run.currentStateName + ' in flow: ' +
                    flow2Run.name, 406), res);
                return next(res.flowResponseModel.flow.err);
            }

            //copy flow over to context.flow own memory space so flow author functions can't modify
            // flow framework's copy
            context.flow = flow2Run._flowContextSelectiveCopy();

            // context.flow =  flow;
            context.data =   (req.body && req.body.data ) ? req.body.data : {};
            context.request = req;
            context.response = res;
            context.next = next;

            FlowRuntime.resume(flow2Run, context);
        }
    };
};

/**
 *
 * @param message
 * @param status
 * @returns  Error(message) with optional http response code [status]
 * @private
 */
SenorDirector.prototype._buildUnservicableError = function(message, status) {
    var error = {};
    error.message = message;
    error.status = (status) ? status : 500;
    return error;
};


/**
 * Build the same response model that is returned whether render or return is used
 *
 * @param err
 * @param res
 * @private
 */
SenorDirector.prototype._buildErrorResponseModel = function(err, res) {
    res.flowResponseModel = { flow: { err: err} };
};



/**
 *
 * @param flow
 * @param requestorCurrentStateId
 * @param reqEvent
 * @param serversLastCurrentStateId
 * @param serversLastCurrentStateName
 * @returns {*}
 * @private
 */
SenorDirector.prototype._setFlowTreeCurrentState = function(flow,
    requestorCurrentStateId,
    reqEvent,
    serversLastCurrentStateId,
    serversLastCurrentStateName) {

    var flow2Run;

    // find the flow that contains the stateId
    if(flow.states[requestorCurrentStateId]) {

        assert(flow.states[requestorCurrentStateId].type === State.types.VIEW,
            'Requestor current state id does NOT correspond to a VIEW state in flow: ' + flow.name);

        flow.currentStateId = requestorCurrentStateId;
        flow.requestedEvent = reqEvent;

        flow2Run = flow;
    }
    else {
        flow2Run = this._findFlow(flow, requestorCurrentStateId);
        debug('Flow found: ' + flow2Run.name , ' parent name: ' + flow2Run._parent.name);
        assert(flow2Run.states[requestorCurrentStateId].type === State.types.VIEW,
            'Requestor current state id does NOT correspond to a VIEW state in flow: ' + flow2Run.name);

        flow2Run.currentStateId = requestorCurrentStateId;
        flow2Run.requestedEvent = reqEvent;

        this._setParentCurrentState(flow2Run, requestorCurrentStateId);
    }

    if(requestorCurrentStateId !== serversLastCurrentStateId) {

        debug('SenorDirector._setFlowTreeCurrentState()   requestorCurrentStateId:  ' + requestorCurrentStateId +
            '  flow current state id  ' + serversLastCurrentStateId);

        // the serversLastCurrentStateId may not be in parent flow
        flow._addComprehensiveStateHistory(serversLastCurrentStateName);
    }

    assert(flow2Run, 'Unable to find the flow that contains the requestor current state: ' +
        requestorCurrentStateId);
    return flow2Run;
};


/**
 * Only call is flow containing requestorCurrentStateId is NOT in the root/parent flow.
 * This method will walk the tree from the bottom up and set the current states of the parent flows
 * as well as the current state of the subflow
 * @param flow
 * @param requestorCurrentStateId
 * @private
 */
SenorDirector.prototype._setParentCurrentState = function(flow, requestorCurrentStateId) {


    if(flow.isSubflow) {
        var parentSubflowState;
        Object.keys(flow._parent.statesByName).some( function(parentStateName) {
            // find the state in the parent flow who's flow name is the same as this flow's name
            if(flow._parent.statesByName[parentStateName].flowName === flow.name) {
                debug('Found state in parent flow: ', parentStateName, 'that matches this subflow flow name');
                parentSubflowState = flow._parent.statesByName[parentStateName];
                flow._parent.currentStateName = parentSubflowState.name;
                flow._parent.currentSubflowName = flow.name;
                return true;
            }
            return false;
        });
        assert( parentSubflowState, 'Parent flow: ' + flow._parent.name +
            ' does NOT contain state: ' + parentSubflowState.name);

        if(flow._parent) {
            this._setParentCurrentState(flow._parent, parentSubflowState.id );
        }
        return;
    }
};



/**
 * It is assumed that the parent flow passed in does NOT contain the requestorCurrentStateId
 * @param flow
 * @param requestorCurrentStateId
 * @returns {*}
 * @private
 */
SenorDirector.prototype._findFlow = function(flow, requestorCurrentStateId) {
    var sflow;
    var self = this;

    debug('Current requestor state id: ' + requestorCurrentStateId);

    Object.keys(flow.subflows).some( function(subflowName) {
        debug('Examing subflow name: ' + subflowName + ' with parent: ' + flow.name);
        debug(flow.subflows[subflowName].states);
        if(flow.subflows[subflowName].states[requestorCurrentStateId]) {
            debug('Found subflow: '  + subflowName);
            sflow =  flow.subflows[subflowName];
            return true;
        }
        return false;
    });

    if(!sflow) {
        Object.keys(flow.subflows).some( function(subflowName) {
            if(flow.subflows[subflowName].subflows) {
                sflow = self._findFlow(flow.subflows[subflowName], requestorCurrentStateId);
                if(sflow) {  return true; }
                return false;
            }
        });
    }

    if(sflow) { debug('Returning subflow: ' + sflow.name ); }
    return sflow;
};



/**
 * Assumption is that the context will contain the request, response, and next objects.  You should ensure that
 * you bind the SenorDirector instance to this method before passing it in to the flow runtime.
 *
 * @param context
 * @param flow     this is not a partial property copy like context, but the actually parent flow object
 * @private
 */
SenorDirector.prototype._render = function(context, flow) {

    var responseModel = {};

    // store off the flow in the session so it get persisted to the federated cache
    if(flow.currentStateId !== State.states.FLOW_COMPLETE) {

        context.request.session.flows[flow.id] = {
            currentStateId: flow.currentStateId,
            currentStateName: flow.currentStateName,
            currentSubflowName: (flow.isSubflow) ? flow.name : null,
            comprehensivePreviousStates: flow._getComprehensiveStateHistory()
        };
    }
    else {
        // clean up the session with the flow
        context.request.session.flows[flow.id] = null;
    }
    // hand control back to parent rather and let parent take next action
    if(flow.currentStateName === State.states.FLOW_COMPLETE)
    {
        // ONLY parent flows should be returning as completed to the middleware, subflows always return control
        // back to a parent flow not the middleware
        assert(!flow.isSubflow,
            'Render was called but the current flow context is not that of the root/parent flow');

        debug('XHR request: ' + context.request.xhr);

        if(!context.request.xhr && context.data.flowControl && context.data.flowControl.redirectURL)
        {
            if(context.data.flowControl.redirectHeaders) {
                Object.keys(context.data.flowControl.redirectHeaders).forEach(function(headerKey) {
                    context.response.setHeader(headerKey, context.data.flowControl.redirectHeaders[headerKey]);
                });
            }
            context.response.redirect(context.data.flowControl.redirectURL);
            return;
        }
    }

    responseModel.data = context.data;
    responseModel.viewName = context.flow.viewName;
    responseModel.redirectURL = (context.data.flowControl && context.data.flowControl.redirectURL) ? context.data.flowControl.redirectURL : null;
    responseModel.flow = {
        flowExecutionKey: flow.id + 'S' + flow.currentStateId,
        currentStateName: flow.currentStateName,
        currentSubflowName: (flow.isSubflow) ? flow.name : null,
        comprehensivePreviousStates: flow._getComprehensiveStateHistory()
    };

    if(context.flow.err) {
        responseModel.flow.err = context.flow.err;

        // ensure payload is set before calling next
        context.response.flowResponseModel = responseModel;

        return context.next(responseModel.flow.err);
    }

    if(this._isRenderer) {
        context.response.format({

            json: function() {
                context.response.status(200).json(responseModel);
            },

            html: function() {
                context.response.render(responseModel.viewName, responseModel);
            }
        });
    }
    else {
        context.response.flowResponseModel = responseModel;
        return context.next();
    }
};


/**
 * Register you listener for all flow events as defined by FlowEvents module.  The format of the arguments passed to
 * your callback are dependent on the event:
 *
 * @param flowEventListener  should be a FlowEventListener as defined by this module
 */
SenorDirector.prototype.registerFlowEventListener = function (flowEventListener) {
    assert(flowEventListener, 'Null flow listener passed in');
    assert(typeof flowEventListener === 'object', 'Invalid flow listener passed');
    assert(typeof flowEventListener.onEvent === 'function',
        'Invalid flow listener ... does NOT contain an onEvent function');
    this._flowEventListeners.push( flowEventListener );
};


SenorDirector.prototype._errorCoordinator = function(err) {
    if (err) {
        debug('Error from SenorDirector generic error handler:');
        debug(err);
        return;
    }
};

/**
 * Adds all listeners needed by flow middleware.
 * @param context
 * @private
 */
SenorDirector.prototype._registerInternalErrorListener = function() {

    // 'error' is from EventEmitter
    this.on('error', this._errorCoordinator);
};


module.exports = SenorDirector;
