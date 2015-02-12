/**
 * Created by ipetre on 2/20/14.
 */

var pageTypes = {
    restaurant: "restaurant",
    superadmin: "superadmin"
};

var restaurantRedirectUrl = "/admin/clients";
var superadminRedirectUrl = "/superadmin/restaurants";

/**
 * @function protectSuperAdmin: Protects regular restaurant users from accessing superadmin section.
 * @param req
 * @param res
 * @param next
 */
function protectSuperAdmin(req, res, next) {

    if (checkAuth(req, res)) {
        if (req.session.type !== "superadmin") {
            // Go to the restaurant pages.
            res.redirect(restaurantRedirectUrl);
        } else {
            next();
        }
    }

}

/**
 * @function protectRestaurant: Protects a superadmin from accessing the restaurant pages, because that is not applicable since he has no restaurant or location IDs.
 * @param req
 * @param res
 * @param next
 */
function protectRestaurant(req, res, next) {

    if (checkAuth(req, res)) {
        if (req.session.type !== "chainmanager" && req.session.type !== "manager" && req.session.type !== "operator" ) {
            // Go to superadmin pages.
            res.redirect(superadminRedirectUrl);
        } else {
            next();
        }
    }
}

/**
 * @function checkAuth: Check if there is a session available.
 * @param req Incomming Request.
 * @param res Response Object.
 * @returns {boolean}
 */
function checkAuth(req, res, next) {
    if (!req.session.userId) {
        console.log("Session expired");
        res.redirect('/login');
        return false;
    } else {
        // Check if we have next handler available and call it otherwise just stop.
        if (typeof next === "function") {
            next();
        } else {
            return true;
        }
    }
}

/**
 * @function registerRoutes: Registers handles for each given route.
 * @param httpServer
 */
function registerRoutes(httpServer, handlers, requiresLogin) {

    // Map of page types and their security handler
    var handlerMap = {};
    handlerMap[pageTypes.restaurant] = protectRestaurant;
    handlerMap[pageTypes.superadmin] = protectSuperAdmin;

    // Go through all handlers and assign handler functions per method & request url.
    for (method in handlers) {
        for (route in handlers[method]) {
            var handlerFunction = handlers[method][route];

            if (requiresLogin && requiresLogin == true) {
                httpServer[method](route, checkAuth, handlerFunction);
            } else if(requiresLogin) {
                // Use the protect function depending on the user type.
                httpServer[method](route, handlerMap[requiresLogin], handlerFunction);
            }
            else {
                httpServer[method](route, handlerFunction);
            }
        }
    }
}

module.exports = {
    registerRoutes: registerRoutes,
    pageTypes: pageTypes
}

