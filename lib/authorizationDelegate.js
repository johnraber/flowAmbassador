"use strict";

/**
 *
 * @param name
 * @constructor
 */
function AuthorizationDelegate(id) {
    this._id = id;


}

/**
 *
 * @param roles array of roles for flow
 * @param callback (err, allowed)   if err exists in your callback, then allowed is ALWAYS assumed false
 */
AuthorizationDelegate.prototype.authorizeWithRequest = function (request, allowedRoles, callback) {
    if(!allowedRoles) {
        // no roles so assume that
        callback(null, true);
    }
    else {
        if(request.body && request.body.data && request.body.data.testAuthorizationFailure) {
            callback(null, false);
            return;
        }
        else {
        // ensure request.user has the roles
        // if(request.user && request.user.roles.containsAtLeastOne(allowedRoles) {
            callback(null, true);
            return;
        // }
        // else {
        // callback(err, false);
        // }
        }
    }
};


module.exports = AuthorizationDelegate;
