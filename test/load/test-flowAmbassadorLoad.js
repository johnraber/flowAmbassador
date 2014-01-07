"use strict";

var SenorDirector = require('../../lib/senorDirector'),
    xoInitObj = require('./../xoflow'),
    express = require("express"),
    http = require("http"),
    nl = require('nodeload'),
    memwatch = require('memwatch');


var app, server;
var senorDirector;
var appPath = "/xoflow";
var testTimeSecs = 120;
var numTimeoutEvents = 0;

app = express();
app.use( express.bodyParser() );
app.use( express.cookieParser() );
app.use( express.session( {key: 'fkey', secret: 'frankenstein'} ) );

server = http.createServer(app);

// mulitply by 1.5 and account for milliseconds in the setTimeout param
server.setTimeout(testTimeSecs * 1.5 * 1000, function(callback) {
    numTimeoutEvents = numTimeoutEvents + 1;
});

senorDirector = new SenorDirector(xoInitObj);

app.all(appPath, senorDirector.requestHandler());

server.listen(3000).on("listening", function() {} );

var hd = new memwatch.HeapDiff();

memwatch.on('leak', function(info) {
    console.log('leaking memory hommie!');
    console.dir(info);
});

memwatch.on('stats', function(stats) {
    console.log('yay stats!');
    console.dir(stats);
});


var loadtest = nl.run({
    host: 'localhost',
    port: 3000,
    numClients: 10,
    timeLimit: testTimeSecs,         // Maximum duration of test in seconds
    targetRps: 10,        // targetRps: times per second to execute request loop
    stats: ['latency', 'result-codes', 'concurrency'],
    requestLoop: function(finished, client) {
        var request = client.request('GET', appPath);
        request.setHeader('Accept', 'application/json');
        request.setHeader('cookie', {});

        request.on('response', function(res) {
            if (res.statusCode !== 200 && res.statusCode !== 404) {
                finished({req: request, res: res});
            } else {
//                    var headers = res.headers['etag'] ? {'if-match': res.headers['etag']} : {};
                var headers = {
                    Accept: 'application/json',
                    cookie: {}
                };
                request = client.request('GET', appPath, headers);
                request.on('response', function(res) {
                    finished({req: request, res: res});
                });
                request.end("got a response");
            }
        });
        request.end();
    }
});
loadtest.on('end', function() {


    console.log('Load test done.');

    var diff = hd.end();
    console.log('diff!');
    console.dir(diff);
    console.dir(diff.change.details);

    console.log('Number timeouts reached: '+ numTimeoutEvents);

    server.close();

    process.exit(0);

});