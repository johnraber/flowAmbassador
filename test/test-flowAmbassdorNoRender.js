"use strict";

var assert = require('assert'),
    SenorDirector = require('../lib/senorDirector'),
    xoInitObj = require('./xoflow'),
    express = require("express"),
    http = require("http"),
    request = require("supertest"),
    FlowEventListener = require('../lib/flowEventListener'),
    lastDitch = require('../examples/lastDitchMiddlewareHandler').requestHandler,
    renderMiddlewareHandler = require('../examples/renderMiddlewareHandler').requestHandler,
    memwatch = require('memwatch');


describe("XOFlow on FlowAmbassador Test", function() {

    var app, server;
    var rrModel = {data: {}, flow: { flowExecutionKey: '', currentStateName: '', _eventId: ''}};
    var cookie;
    var senorDirector;
    var appPath = "/xoflow";

    var hdrs = {  'Accept':  'application/json',
        'cookie': cookie
    };

    var memberReviewFlowExecutionKey;
    var expectedStates = [];



    before(function(done) {
        app = express();
        app.use( express.bodyParser() );
        app.use( express.cookieParser() );
        app.use( express.session( {key: 'fkey', secret: 'frankenstein'} ) );

        server = http.createServer(app);

        memwatch.on('leak', function(info) {
            console.log('>>>>>>>>>>>>>>>>   leaking memory hommie!');
            console.dir(info);
        });

        memwatch.on('stats', function(stats) {
            console.log('yay stats!');
            console.dir(stats);
        });

        senorDirector = new SenorDirector(xoInitObj, false);
        senorDirector.registerFlowEventListener(new FlowEventListener('test-flowAmbassador'));

        app.all(appPath, senorDirector.requestHandler(), renderMiddlewareHandler(), lastDitch() );

        server.listen(3000).on("listening", done);
    });

    after(function(done) {
        server.close(done);
    });




    it("should move thru init to start to login state a XO flow", function(complete) {

        request(app).post(appPath).set(hdrs).end(function(err, response) {
            assert.ok(!err);
            console.dir(response.body);
            assert.strictEqual(response.body.flow.currentStateName, 'memberReview');
            assert(response.body.flow.flowExecutionKey);


            memberReviewFlowExecutionKey = response.body.flow.flowExecutionKey;
            rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
            rrModel.flow.currentStateName = response.body.flow.currentStateName;

            cookie = response.headers['set-cookie'];
            hdrs.cookie = cookie;

            expectedStates.push('XO flow::init');
            expectedStates.push('XO flow::updateBuyer');
            assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());

            complete();

        });
    });


    it("should move from member review to change funding source view", function(complete) {

        rrModel.flow._eventId = 'changeFundingSource';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'changeFundingSourceView');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('XO flow::memberReview');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());

                complete();
            });
    });
});
