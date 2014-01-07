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

    return function(req, res, next) {

        res.format({

            json: function() {
                res.status(200).json(res.flowResponseModel);
            },

            html: function() {
                res.render(res.flowResponseModel.viewName, res.flowResponseModel);
            }
        });
    };
}

module.exports.requestHandler = requestHandler;