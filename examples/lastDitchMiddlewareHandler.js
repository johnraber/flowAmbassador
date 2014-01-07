"use strict";

var debug = require('debuglog')('flowambassador');

/**
 * Middleware to handle http response codes that the consuming application can't.  For example, you may want to render
 * all non user recoverable error into 500. And you may want to render specific catch all error pages so you have
 * control of the rendering here.
 *
 *
 * Based off http://expressjs.com/guide.html#error-handling
 *
 * @returns {Function}
 */
function requestHandler() {

    return function(err, req, res, next) {
        // Err object may be entire response after flow engine has run and had error so the format will be the same
        // as a normal response
        if(err) {
            res.format({

                json: function() {
                    res.status(err.status || 500).json(res.flowResponseModel);
                },

                html: function() {
                    res.render(err.status || 500, res.flowResponseModel);
                }
            });
        }
        else {
            console.log('>>>>>>>>>>>>>>>>>>  Handling normal response lastDitchMiddlewareHandler which should never happen because Express should NOT have called this handler with NO error!!');
        }
    };
}

module.exports.requestHandler = requestHandler;
