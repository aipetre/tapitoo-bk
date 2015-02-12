/**
 * Created by ipetre on 2/18/14.
 */

// Librady to register routes.
var routeReqister = require("../lib/routeRegister");

// Forms.
var forms = require("../lib/forms");

// Library to make Persistence calls.
var sc = require("../lib/serverCommunication").ServerCommunication;

// Get logger for this module
var log = require('../lib/log').get("loginRoute");

var redirectUrl = "/admin/clients";
var superadminRedirectUrl = "/superadmin/restaurants";

/**
 * @function index: Redirects the user to langing page depending of it's user type.
 * @param req
 * @param res
 */
function index(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    if (req.session.type === "superadmin") {
        res.redirect(superadminRedirectUrl);
        log.debugEntry(req, arguments.callee.name, "Redirecting user to superadmin pages");
    } else {
        res.redirect(redirectUrl);
        log.debugEntry(req, arguments.callee.name, "Redirecting user to restaurant pages");
    }
}

/**
 * @function login: Handles login page, both GET and POST methods.
 * @param req
 * @param res
 */
function login(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    var last_username = "";
    var redirect_url = redirectUrl;
    var post = req.body;
    var error = null;

    // Check if we have data from POST.
    if (Object.keys(post).length > 0) {

        if (post.email === "superadmin" && post.pass === "somepass") {
            // Go to Superadmin pages
            req.session.userId ="superadmin";
            req.session.type = "superadmin";
            // Just setting restaurantId and locationId to blank values.
            req.session.restaurantId = "";
            req.session.locationId = "";
            req.session.displayName = null;
            setCookieExpiration (req);

            // Log action and redirect.
            log.debug("Succesfully logged superadmin user, redirecting to " + superadminRedirectUrl);
            res.redirect(superadminRedirectUrl);
        } else {
            log.debug("Attempting to find user in Persistence.");

            // Get encrypt lib.
            var shasum = require('crypto').createHash('sha1');

            // Encrypt password
            post.pass = shasum.update(post.pass).digest('base64');

            sc.AuthStaffMember(null, callback, post);
        }

    } else {
        displayPage();
    }

    function callback (scResponse) {

        if (scResponse) {
            // Login ok
            var authInfo = JSON.parse(scResponse.result);

            // Populate last username
            last_username = post.email;

            if (Object.keys(authInfo).length > 0) {

                if (authInfo[0].restaurant.status === "available") {
                    req.session.userId = authInfo[0].staff.email;
                    req.session.type = authInfo[0].staff.type;

                    // Note: name = restaurantId, id = locationId!
                    req.session.restaurantId = authInfo[0].restaurant.restaurantId;
                    // Keeping in session the restaurant display name in case we needed at some point!
                    req.session.displayName = authInfo[0].restaurant.displayName || "Restaurant";
                    // Remember if this is a chain
                    req.session.isChain = authInfo[0].restaurant.isChain;

                    setCookieExpiration (req);

                    log.debug("Succesfully logged restaurant user redirecting...");

                    // Check type
                    if (authInfo[0].staff.type == "chainmanager") {
                        // Managers have only null for location Id.
                        req.session.locationId = null;
                        res.redirect(req.body._target_path);
                    } else {
                        // I always need locationId !!!
                        var locationDetails = authInfo[0].location;
                        // Very important: Setting locationId only for operator.
                        req.session.locationId = locationDetails.id;
                        req.session.locationDisplayName = locationDetails.displayName;
                        res.redirect("/admin/orders");
                    }
                } else {
                    error = "loginPage.not_active";
                    displayPage();
                }
            } else {
                error = "loginPage.invalid_login";
                displayPage();
            }
        } else {
            error = "common.labels.persistence_error";
            displayPage();
        }
    }

    function setCookieExpiration (req) {

        // FIXME: This does note seem to work. Seems like express bug
        if (typeof post.keepLogin === "undefined") {
            // Set to expire when closing browser
            req.session.cookie.expires = null;
        }
    }

    /**
     * Render the page.
     */
    function displayPage () {
        res.render('login/index.html.twig', {
            'page_title': "Login",
            'page': "login/login.html.twig",
            'params': {
                'redirect_url': redirect_url,
                'last_username': last_username,
                'error': error
            }
        });
        // Log response. This is just to see that action was finished.
        log.infoResponse(arguments.callee.name, res);
    }
}

/**
 * @function logout: Log out the user.
 * @param req
 * @param res
 */
function logout(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);
    log.debugEntry(req, arguments.callee.name, "Logging out user...");
    delete req.session;
    res.clearCookie("connect.sess",  { path: '/' });

    log.debug("Succesfully logged out the user, redirecting to login...");
    res.redirect('/login');
}

/**
 * @function test_notification: This is just for testing purposes not really used.
 * @param req
 * @param res
 */
function test_notification (req, res) {

    // Load path lib.
    var path = require('path');

    // Load apn lib.
    var apn = require('apn');

    // Options to connect.
    var options = {
        cert: path.join(__dirname, 'public/ios/restaurantlocation/tapitoo-cert.pem').replace("/routes", ""),
        key: path.join(__dirname, 'public/ios/restaurantlocation/tapitoo-key.pem').replace("/routes", ""),
        passphrase: "radu"
    };

    // Create connection.
    var service  = new apn.Connection(options);

    service.on('connected', function() {
        console.log("Connected");
    });

    service.on('transmitted', function(notification, device) {
        console.log("Notification transmitted to:" + device.token.toString('hex'));
    });

    service.on('transmissionError', function(errCode, notification, device) {
        console.error("Notification caused error: " + errCode + " for device ", device, notification);
    });

    service.on('timeout', function () {
        console.log("Connection Timeout");
    });

    service.on('disconnected', function() {
        console.log("Disconnected from APNS");
    });

    service.on('error', console.error);

    service.on('socketError', console.error);


    var feedback = new apn.Feedback(options);
    feedback.on("feedback", function(devices) {
        devices.forEach(function(item) {
            // Do something with item.device and item.time;
            console.log("Device: " + item.device.toString('hex') + " has been unreachable, since: " + item.time);
        });
    });

    feedback.on('feedbackError', console.error);
    feedback.on('error', console.error);

    var tokens = ["2e6d6d4ffbe66a33a6eb826850a3b917a32c4b216178df94fee65f792a7ff1a2"];


    // If you have a list of devices for which you want to send a customised notification you can create one and send it to and individual device.
    function pushNotificationToMany() {

        var note = new apn.Notification();
        note.setAlertText("Tapitoo push notification test din nou!");
        note.badge = 1;
        note.sound = "beep.caf";

        service.pushNotification(note, tokens);
    }

    pushNotificationToMany();

    res.send(200);
}

function registerRoutes(httpServer) {

    var noLoginHandlers = {
        get: {
            //"/test_notification": test_notification,
            "/login": login,
            "/logout": logout
        },
        post: {
            "/login": login
        }
    }

    routeReqister.registerRoutes(httpServer, noLoginHandlers);

    for (method in noLoginHandlers) {
        for (route in noLoginHandlers[method]) {
            var handlerFunction = noLoginHandlers[method][route];
            httpServer[method](route, handlerFunction);
        }
    }

    var loginHandlers = {
        get: {
            "/": index
        }
    }

    routeReqister.registerRoutes(httpServer, loginHandlers, true);
}

module.exports = {
    registerRoutes: registerRoutes
}


