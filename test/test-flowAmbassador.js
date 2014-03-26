"use strict";

var assert = require('assert'),
    SenorDirector = require('../lib/senorDirector'),
    xoInitObj = require('./xoflow'),
    express = require("express"),
    http = require("http"),
    request = require("supertest"),
    FlowEventListener = require('../lib/flowEventListener'),
    lastDitch = require('../examples/lastDitchMiddlewareHandler').requestHandler;
//    memwatch = require('memwatch');


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

//        memwatch.on('leak', function(info) {
//            console.log('>>>>>>>>>>>>>>>>   leaking memory hommie!');
//            console.dir(info);
//        });
//
//        memwatch.on('stats', function(stats) {
//            console.log('yay stats!');
//            console.dir(stats);
//        });

        senorDirector = new SenorDirector(xoInitObj, true);
        senorDirector.registerFlowEventListener(new FlowEventListener('test-flowAmbassador'));

        app.all(appPath, senorDirector.requestHandler(), lastDitch() );

        server.listen(3000).on("listening", done);
    });

    after(function(done) {
        server.close(done);
    });




    it("should move thru init to start to login state a XO flow", function(complete) {

        request(app).post(appPath).set(hdrs).end(function(err, response) {
            assert.ok(!err);
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



    it("should successfully change funding source and move back to member review", function(complete) {

        rrModel.flow._eventId = 'submit';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'memberReview');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('XO flow::changeFundingSourceView');
                expectedStates.push('XO flow::changeFundingSource');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());

                complete();
            });
    });

    it("should move from member review to change shipping address view which is subflow", function(complete) {

        rrModel.flow._eventId = 'changeShippingAddress';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'changeShippingAddressView');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('XO flow::memberReview');
                expectedStates.push('changeShippingAddressFlow::init');
                expectedStates.push('changeShippingAddressFlow::primeFlow');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

    it("should make the shipping address changes successfully and the move to the member review in the parent flow", function(complete) {

        rrModel.flow._eventId = 'submit';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'memberReview');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('changeShippingAddressFlow::changeShippingAddressView');
                expectedStates.push('changeShippingAddressFlow::changeShippingAddress');
                expectedStates.push('changeShippingAddressFlow::changedShippingAddress');
                expectedStates.push('XO flow::changeShippingAddressSubflow');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });


    it("should move from member review to change shipping address view which is subflow but first go through an action in parent flow first",
        function(complete) {

        rrModel.flow._eventId = 'go2ChangeShippingAddressAction';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'changeShippingAddressView');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('XO flow::memberReview');
                expectedStates.push('XO flow::go2ChangeShippingAddressAction');
                expectedStates.push('changeShippingAddressFlow::init');
                expectedStates.push('changeShippingAddressFlow::primeFlow');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

    it("should reject request because eventId is not valid for current state", function(complete) {

        rrModel.flow._eventId = 'blahahah';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {
//                console.dir(response);
                assert(response.statusCode === 406);
//                assert(response.body.flow.err);

                complete();
            });
    });

    it("should cancel the shipping address changes successfully and the move to the member review in the parent flow", function(complete) {

        rrModel.flow._eventId = 'cancel';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'memberReview');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('changeShippingAddressFlow::changeShippingAddressView');
                expectedStates.push('changeShippingAddressFlow::cancelledChangeShippingAddress');
                expectedStates.push('XO flow::changeShippingAddressSubflow');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());

                complete();
            });
    });

    it("should move from member review to change shipping address view which is subflow first using an onExitMethod", function(complete) {

        rrModel.flow._eventId = 'changeShippingAddressWithOnExit';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'changeShippingAddressView');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('XO flow::memberReview');
                expectedStates.push('changeShippingAddressFlow::init');
                expectedStates.push('changeShippingAddressFlow::primeFlow');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

    it("should cancel the shipping address changes successfully and the move to the member review in the parent flow", function(complete) {

        rrModel.flow._eventId = 'cancel';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'memberReview');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('changeShippingAddressFlow::changeShippingAddressView');
                expectedStates.push('changeShippingAddressFlow::cancelledChangeShippingAddress');
                expectedStates.push('XO flow::changeShippingAddressSubflow');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });



    it("should move from member review to change shipping address view which is subflow with NO onExit method", function(complete) {

        rrModel.flow._eventId = 'changeShippingAddress';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'changeShippingAddressView');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('XO flow::memberReview');
                expectedStates.push('changeShippingAddressFlow::init');
                expectedStates.push('changeShippingAddressFlow::primeFlow');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

    it("should cancel the shipping address changes successfully and the move to the member review in the parent flow", function(complete) {

        rrModel.flow._eventId = 'cancel';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'memberReview');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('changeShippingAddressFlow::changeShippingAddressView');
                expectedStates.push('changeShippingAddressFlow::cancelledChangeShippingAddress');
                expectedStates.push('XO flow::changeShippingAddressSubflow');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

    it("should move from member review to change shipping address view which is subflow", function(complete) {

        rrModel.flow._eventId = 'changeShippingAddress';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'changeShippingAddressView');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('XO flow::memberReview');
                expectedStates.push('changeShippingAddressFlow::init');
                expectedStates.push('changeShippingAddressFlow::primeFlow');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

    it("should move from the change shipping address view to the Add Shipping Address View", function(complete) {

        rrModel.flow._eventId = 'addShipping';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'addShippingAddressView');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('changeShippingAddressFlow::changeShippingAddressView');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

    it("should ADD a shipping address changes successfully and move back to the member review in the parent flow", function(complete) {

        rrModel.flow._eventId = 'submit';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'memberReview');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('changeShippingAddressFlow::addShippingAddressView');
                expectedStates.push('changeShippingAddressFlow::addShippingAddress');
                expectedStates.push('changeShippingAddressFlow::addedShippingAddress');
                expectedStates.push('XO flow::changeShippingAddressSubflow');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

    it("should move from member review to change shipping address view which is subflow", function(complete) {

        rrModel.flow._eventId = 'changeShippingAddress';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'changeShippingAddressView');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('XO flow::memberReview');
                expectedStates.push('changeShippingAddressFlow::init');
                expectedStates.push('changeShippingAddressFlow::primeFlow');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

    it("should move change shipping address view to a Do Nothing subflow", function(complete) {

        rrModel.flow._eventId = 'test2LevelDeep';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'doNothingView');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('changeShippingAddressFlow::changeShippingAddressView');
                expectedStates.push('changeShippingAddressFlow::fakeSubflow2Test2LevelsDeepFlow::init');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

    it("should move from doNothingView back to change shipping address view after firing doNothingMethod", function(complete) {

        rrModel.flow._eventId = 'submit';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'changeShippingAddressView');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('changeShippingAddressFlow::fakeSubflow2Test2LevelsDeepFlow::doNothingView');
                expectedStates.push('changeShippingAddressFlow::fakeSubflow2Test2LevelsDeepFlow::doNothing');
                expectedStates.push('changeShippingAddressFlow::fakeSubflow2Test2LevelsDeepFlow::didNothing');
                expectedStates.push('changeShippingAddressFlow::fakeSubflow2Test2LevelsDeepSubflow');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

    it("should test user recoverable error in change shipping address view (subflow) and stay in the same view", function(complete) {

        rrModel.flow._eventId = 'submit';
        rrModel.data.testUserRecoverableErrorCase = true;


        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.ok(!response.body.flow.err);
                assert.strictEqual(response.body.flow.currentStateName, 'changeShippingAddressView');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;


                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

//    it("should test system error in change shipping address view which transitions to a general error page while staying in the current flow", function(complete) {
//
//        rrModel.flow._eventId = 'submit';
//        rrModel.data.testUserRecoverableErrorCase = false;
//        rrModel.data.testThrowUnknownError =  true;
//
//        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
//            function(err, response) {
//
//                assert.ok(!err);
//                assert.ok(!response.body.flow.err);
//                assert.strictEqual(response.body.flow.currentStateName, 'generalErrorPageView');
//                assert.strictEqual(response.body.flow.currentSubflowName, 'changeShippingAddressFlow');
//
//                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
//                rrModel.flow.currentStateName = response.body.flow.currentStateName;
//
//                expectedStates.push('changeShippingAddressFlow::changeShippingAddressView');
//                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
//                complete();
//            });
//    });

//    it("should submit out of generalErrorPageView to get back into shipping address view", function(complete) {
//
//        rrModel.flow._eventId = 'submit';
//        //rrModel.data.testThrowUnknownError =  false;
//
//        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
//            function(err, response) {
//
//                assert.ok(!err);
//                assert.ok(!response.body.flow.err);
//                assert.strictEqual(response.body.flow.currentStateName, 'changeShippingAddressView');
//                assert.strictEqual(response.body.flow.currentSubflowName, 'changeShippingAddressFlow');
//
//                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
//                rrModel.flow.currentStateName = response.body.flow.currentStateName;
//                expectedStates.push('changeShippingAddressFlow::generalErrorPageView');
//                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
//                complete();
//            });
//    });
//
//    it("should test unknown error in attempting to transition from shipping address view that results NO transition and NO render ", function(complete) {
//
//        rrModel.flow._eventId = 'submit';
//        rrModel.data.testThrowUnknownErrorNoRender =  true;
//
//        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
//            function(err, response) {
//
//                assert.ok(!err);
//                assert.ok(response.body.flow.err);
//                // state should have not changed since no transition occurred
//                assert.strictEqual(response.body.flow.currentStateName, 'changeShippingAddressView');
//                assert.strictEqual(response.body.flow.currentSubflowName, 'changeShippingAddressFlow');
//
//                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
//                rrModel.flow.currentStateName = response.body.flow.currentStateName;
//
//                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
//                complete();
//            });
//    });



    it("should from shipping address view move into action state and test moving to an action state and back to shipping address view", function(complete) {

        rrModel.flow._eventId = 'goToActionToTestErrors';
        rrModel.data.testUserRecoverableErrorCase = true;
        //rrModel.data.testThrowUnknownError =  false;
        rrModel.data.testThrowUnknownErrorNoRender =  false;

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {
//                console.dir(response.body.flow);
                assert.ok(!err);
                assert.ok(!response.body.flow.err);
                assert.strictEqual(response.body.flow.currentStateName, 'changeShippingAddressView');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('changeShippingAddressFlow::changeShippingAddressView');
                expectedStates.push('changeShippingAddressFlow::actionStateForErrorRecovery');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

//    it("should from shipping address view move into action state and then test moving to a generic error page view", function(complete) {
//
//        rrModel.flow._eventId = 'goToActionToTestErrors';
//        rrModel.data.testUserRecoverableErrorCase = false;
//        rrModel.data.testThrowUnknownError =  true;
//        rrModel.data.testThrowUnknownErrorNoRender =  false;
//
//        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
//            function(err, response) {
////                console.dir(response.body.flow);
//                assert.ok(!err);
//                assert.ok(!response.body.flow.err);
//                assert.strictEqual(response.body.flow.currentStateName, 'generalErrorPageView');
//
//                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
//                rrModel.flow.currentStateName = response.body.flow.currentStateName;
//
//                expectedStates.push('changeShippingAddressFlow::changeShippingAddressView');
//                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
//                complete();
//            });
//    });

//    it("should submit out of generalErrorPageView to get back into shipping address view", function(complete) {
//
//        rrModel.flow._eventId = 'submit';
//        //rrModel.data.testThrowUnknownError =  false;
//
//        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
//            function(err, response) {
//
//                assert.ok(!err);
//                assert.strictEqual(response.body.flow.currentStateName, 'changeShippingAddressView');
//                assert.strictEqual(response.body.flow.currentSubflowName, 'changeShippingAddressFlow');
//
//                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
//                rrModel.flow.currentStateName = response.body.flow.currentStateName;
//                expectedStates.push('changeShippingAddressFlow::generalErrorPageView');
//                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
//                complete();
//            });
//    });

//    it("should from shipping address view move into action state and then test the no render scenario", function(complete) {
//
//        rrModel.flow._eventId = 'goToActionToTestErrors';
//        rrModel.data.testUserRecoverableErrorCase = false;
//        //rrModel.data.testThrowUnknownError =  false;
//        rrModel.data.testThrowUnknownErrorNoRender =  true;
//
//        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
//            function(err, response) {
////                console.dir(response.body.flow);
//                assert.ok(!err);
//                assert.ok(response.body.flow.err);
//
//                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
//                rrModel.flow.currentStateName = response.body.flow.currentStateName;
//
//                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
//                complete();
//            });
//    });


    //TODO put in test where I attempt to to into an action and there is an error that I choose to not render .. see
    // how this reacts to stopping the flow engine in a non view state ... maybe relax this requirement


    it("should cancel out of shipping address view into member review", function(complete) {

        rrModel.flow._eventId = 'cancel';
        rrModel.data.testThrowUnknownErrorNoRender =  false;

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {
//                console.dir(response.body.flow);
                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'memberReview');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('changeShippingAddressFlow::changeShippingAddressView');
                expectedStates.push('changeShippingAddressFlow::cancelledChangeShippingAddress');
                expectedStates.push('XO flow::changeShippingAddressSubflow');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });


    it("test using a event that maps to a Global Transition while in member review", function(complete) {

        rrModel.flow._eventId = 'genericUserError';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {
                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'genericPurchaseErrorState');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('XO flow::memberReview');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

    it("move from generic purchase error view to member review", function(complete) {

        rrModel.flow._eventId = 'submit';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {
                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'memberReview');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('XO flow::genericPurchaseErrorState');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });


    // Next 3 tests are really one case: Entering into a duplicate 2nd level subflow via a different path (
    // 1st level subflow)  from the root
    // Part 1
    it("should move from member review to first level subflow", function(complete) {

        rrModel.flow._eventId = 'go2firstLevelSubflow';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {
//                console.dir(response.body.flow);
                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'doSomethingView');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('XO flow::memberReview');
                expectedStates.push('firstLevelFlow::init');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

    // Part 2
    it("should move from first level flow to fakeSubflow2Test2LevelsDeepFlow ", function(complete) {

        rrModel.flow._eventId = 'go2fakeSubflow2Test2LevelsDeepSubflow';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {
//                console.dir(response.body.flow);
                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'doNothingView');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('firstLevelFlow::doSomethingView');
                expectedStates.push('firstLevelFlow::fakeSubflow2Test2LevelsDeepFlow::init');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

    // Part 3
    it("should move from second level fakeSubflow2Test2LevelsDeepFlow back to first level flow", function(complete) {

        rrModel.flow._eventId = 'submit';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {
//                console.dir(response.body.flow);
                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'memberReview');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;

                expectedStates.push('firstLevelFlow::fakeSubflow2Test2LevelsDeepFlow::doNothingView');
                expectedStates.push('firstLevelFlow::fakeSubflow2Test2LevelsDeepFlow::doNothing');
                expectedStates.push('firstLevelFlow::fakeSubflow2Test2LevelsDeepFlow::didNothing');
                expectedStates.push('firstLevelFlow::fakeSubflow2Test2LevelsDeep');
                expectedStates.push('firstLevelFlow::doSomething');
                expectedStates.push('firstLevelFlow::didSomething');
                expectedStates.push('XO flow::firstLevelSubflow');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });


    it("should return a failure code since no _eventId is submitted", function(complete) {

        rrModel.flow._eventId = null;
        rrModel.data.testUserRecoverableErrorCase = false;
        //rrModel.data.testThrowUnknownError =  false;
        rrModel.data.testAuthorizationFailure =  false;

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {
                assert(response.statusCode === 406);
//                assert(response.body.flow.err);
                complete();
            });
    });

    it("should return a failure code since no current state is submitted with the flow exection key", function(complete) {

        rrModel.flow._eventId = 'submit';
        rrModel.data.testUserRecoverableErrorCase = false;
        //rrModel.data.testThrowUnknownError =  false;
        rrModel.data.testAuthorizationFailure =  false;

        var tempFEId =  rrModel.flow.flowExecutionKey.substring(0, rrModel.flow.flowExecutionKey.lastIndexOf('S') ) + "S";
        request(app).post(appPath + "?execution=" + tempFEId).set(hdrs).send(rrModel).end(
            function(err, response) {
                assert(response.statusCode === 406);
//                assert(response.body.flow.err);
                complete();
            });
    });

    it("should fail an authorization test when attempting to move into change shipping address subflow", function(complete) {

        rrModel.flow._eventId = 'changeShippingAddress';
        rrModel.data.testUserRecoverableErrorCase = false;
        //rrModel.data.testThrowUnknownError =  false;
        rrModel.data.testAuthorizationFailure =  true;

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {
//                console.dir(response);
                assert(response.statusCode === 401);
                assert(response.error);
                assert(response.body.flow.err);
                assert.strictEqual(response.body.flow.currentStateName, 'memberReview');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;
                complete();
            });
    });

    //  go into subflow to then test redirect out thru subflow and parent flow
    it("should move from member review to change shipping address view which is subflow in order to move into another " +
        "subflow to then test redirect out thru subflow and parent flow", function(complete) {

        rrModel.flow._eventId = 'changeShippingAddress';
        rrModel.data.testAuthorizationFailure =  false;

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'changeShippingAddressView');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;


                expectedStates.push('XO flow::memberReview');
                expectedStates.push('changeShippingAddressFlow::init');
                expectedStates.push('changeShippingAddressFlow::primeFlow');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

    //  go into subflow to then test redirect out thru subflow and parent flow
    it("should move from change shipping address view to test 2 level deep which is subflow in order to then test" +
        "redirect out thru subflow and parent flow", function(complete) {

        rrModel.flow._eventId = 'test2LevelDeep';

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {

                assert.ok(!err);
                assert.strictEqual(response.body.flow.currentStateName, 'doNothingView');

                rrModel.flow.flowExecutionKey = response.body.flow.flowExecutionKey;
                rrModel.flow.currentStateName = response.body.flow.currentStateName;


                expectedStates.push('changeShippingAddressFlow::changeShippingAddressView');
                expectedStates.push('changeShippingAddressFlow::fakeSubflow2Test2LevelsDeepFlow::init');
                assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());
                complete();
            });
    });

    it("should browser redirect to merchant when successful and complete parent and all subflows",
        function(complete) {

        rrModel.flow._eventId = 'testRedirectToMerchant';
        rrModel.data.testUserRecoverableErrorCase = false;
        //rrModel.data.testThrowUnknownError =  false;
        rrModel.data.testAuthorizationFailure =  false;

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {
                assert(response.statusCode === 302 || response.statusCode ===  301);

                complete();
            });
    });



    it("should move thru init to start to login state a XO flow", function(complete) {

        // reset structures for a new instance of
        rrModel = {data: {}, flow: { flowExecutionKey: '', currentStateName: '', _eventId: ''}};
        cookie = null;
        hdrs = {  'Accept':  'application/json',
            'cookie': cookie
        };
        expectedStates = [];

        request(app).post(appPath).set(hdrs).end(function(err, response) {
            assert.ok(!err);
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


    it("should ajax redirect to merchant when successful and complete parent and all subflows",
        function(complete) {

            hdrs['X-Requested-With'] = 'XMLHttpRequest';
            rrModel.flow._eventId = 'submit';

            request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
                function(err, response) {
                    assert.ok(!err);
                    assert(response.body.redirectURL === 'http://www.johnraber.net');
                    assert(response.statusCode === 200);

                    expectedStates.push('XO flow::memberReview');
                    expectedStates.push('XO flow::redirectToMerchant');
                    expectedStates.push('XO flow::redirectedToMerchant');
                    assert.strictEqual(response.body.flow.comprehensivePreviousStates.toString(), expectedStates.toString());

                    complete();
                });
        });

    it("should return a failure code of since flow is complete", function(complete) {

        rrModel.flow._eventId = 'submit';
        rrModel.data.testUserRecoverableErrorCase = false;
        //rrModel.data.testThrowUnknownError =  false;
        rrModel.data.testAuthorizationFailure =  false;

        request(app).post(appPath + "?execution=" + rrModel.flow.flowExecutionKey).set(hdrs).send(rrModel).end(
            function(err, response) {
                // framework requests a clear from cache but it could take session a bit to actually clear it
                assert(response.statusCode === 404 || response.statusCode === 410);
//                assert(response.body.flow.err);
                complete();
            });
    });


    it("should return a failure code since flow execution key contains a non-exiting flow id", function(complete) {

        rrModel.flow._eventId = 'submit';
        rrModel.data.testUserRecoverableErrorCase = false;
        //rrModel.data.testThrowUnknownError =  false;
        rrModel.data.testAuthorizationFailure =  false;

        request(app).post(appPath + "?execution=" + "bogusflowExecutionKeyS55").set(hdrs).send(rrModel).end(
            function(err, response) {
                assert(response.statusCode === 404);
//                assert(response.body.flow.err);
                complete();
            });
    });
});
