/**
 * Created by root on 4/5/14.
 */

// Forms.
var forms = require("../lib/forms");

// Generate ids
var uuid = require('node-uuid');

// Library to register route handlers.
var routeReqister = require("../lib/routeRegister");

// Library to make Persistence calls.
var sc = require("../lib/serverCommunication").ServerCommunication;

// Helper methods
var helpers = require("../lib/helpers");

// Get logger for this module
var log = require('../lib/log').get("superAdminRoute");

/**
 * @function add_restaurant: Add restaurant page.
 * @param req
 * @param res
 */
function add_restaurant (req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);
    var error;

    var sign_up = forms.create_new_form('sigunp');

    sign_up.handle(req, {
        success: function (form) {
            // there is a request and the form is valid
            // form.data contains the submitted data
            var data = form.data;
            // Do not send confirm password field.
            delete data.passConfirm;

            // Set restaurant fields
            data.restaurantId = uuid.v4(),
            data.locationId = uuid.v4(),

            // Need to set username & type otherwise AddStaffMember request will fail
            data.username = data.email;

            // For chains we have chain managers
            if (data.isChain == "on") {
                data.isChain = "true";
                data.type = "chainmanager";
            } else {
                data.isChain = "false";
                data.type = "manager";
            }

            // Get encrypt lib.
            var shasum = require('crypto').createHash('sha1');

            // Encrypt password
            data.pass = shasum.update(data.pass).digest('base64');

            // Create restaurant and staff.
            sc.TapitooSetUp(null, createRestaurantCallback, data);

            function createRestaurantCallback(scResponse) {

                if (scResponse) {

                    if(scResponse.success === true) {
                        // Render succes page
                        log.infoEntry(req, arguments.callee.name, "New restaurant added redirecting to /superadmin/restaurants...");
                        res.redirect("/superadmin/restaurants");
                    } else {
                        // Something went wrong
                        log.warnEntry(req, arguments.callee.name, "Could not add new restaurant");

                        helpers.displayPage(req, res, 'add_restaurant/index.html.twig', {
                            form: form.toHTML(function (name, object) { return forms.my_field(name, object); } ),
                            error: "addRestaurantPage.message.failed_add_restaurant"
                        });
                    }
                } else {
                    // Problem with persistence
                    log.warnEntry(req, arguments.callee.name, "Persistence encountered an issue while adding a new restaurant.");
                    helpers.displayPage(req, res, 'add_restaurant/index.html.twig', {
                        form: form.toHTML(function (name, object) { return forms.my_field(name, object); } ),
                        error: "common.labels.persistence_error"
                    });
                }
            }

            // Log response. This is just to see that page was displayed.
            log.infoResponse(arguments.callee.name, res);
        },
        error: function (form) {
            // the data in the request didn't validate,
            // calling form.toHTML() again will render the error messages
            helpers.displayPage(req, res, 'add_restaurant/index.html.twig', {
                form: form.toHTML(function (name, object) { return forms.my_field(name, object); } ),
                error: ""
            });
            // Log response. This is just to see that page was displayed.
            log.infoResponse(arguments.callee.name, res);
        },
        empty: function (form) {
            // there was no form data in the request
            helpers.displayPage(req, res, 'add_restaurant/index.html.twig', {
                form: form.toHTML(function (name, object) { return forms.my_field(name, object); } ),
                error: ""
            });
            // Log response. This is just to see that page was displayed.
            log.infoResponse(arguments.callee.name, res);
        }
    });
}

/**
 * @function restaurants: Lists all restaurant to page.
 * @param req
 * @param res
 */
function restaurants (req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    var error;
    var staffMembers = {};
    var allRestaurants = [];
    // To be given to the view.
    var sortedStaffMembers = {};


    log.debugEntry(req, arguments.callee.name, "Getting all restaurants");

    sc.GetAllRestaurants(null, callback);

    function callback (scResponse) {

        if (scResponse) {
            allRestaurants = helpers.parseResult(scResponse, "restaurant");

            // Check if there are restaurants
            if (allRestaurants.length === 0) {
                log.debugEntry(req, arguments.callee.name, "No restaurants to display");
                error = "common.labels.no_restaurants";
                displayPage ();
            } else {
                // Get staff for each restaurant.
                log.debugEntry(req, arguments.callee.name, "Getting staff members for each restaurant.");

                getStaffMembersPerRestaurant(allRestaurants, 0);

                // Get all staff members for each restaurant.
                function getStaffMembersPerRestaurant(restaurants, counter) {
                    var restaurant = restaurants[counter];

                    if (restaurant) {
                        var fullId = restaurant.name +  "" + restaurant.id;
                        var fullId = restaurant.restaurantId;

                        // Create session like params per restaurant
                        var mandatoryParams = {
                            "session": {
                                "restaurantId": restaurant.restaurantId
                            }
                        };

                        sc.GetStaffMembers(mandatoryParams, getStaffMembersCallback);

                        function getStaffMembersCallback(scResponse) {

                            if (scResponse) {

                                // Get staff members from response and remember them per restaurant.
                                var staffArray = helpers.parseResult(scResponse, "staff");
                                staffMembers[fullId] = (staffArray.length > 0) ? staffArray : [];

                                // Get staff for next restaurant
                                getStaffMembersPerRestaurant(restaurants, counter + 1);
                            } else {
                                error = "common.labels.persistence_error";
                                displayPage ();
                            }
                        }
                    } else {
                        displayPage ();
                    }
                }
            }
        } else {
            error = "common.labels.persistence_error";
            displayPage ();
        }
    }

    function displayPage () {
        // Sort the staff members per their type
        for (var fullRestaurantId in staffMembers) {
            // Fill this with staff by type
            var membersPerType = {};
            for(var i = 0, length = staffMembers[fullRestaurantId].length; i < length; i++) {
                // Get staff
                var currentStaff = staffMembers[fullRestaurantId][i];
                var staffType = currentStaff.type;

                // Init array.
                membersPerType[staffType] = membersPerType[staffType] || [];
                membersPerType[staffType].push(currentStaff);
            }

            // Add sorted staff
            sortedStaffMembers[fullRestaurantId] = membersPerType;
        }

        sortedStaffMembers
        staffMembers

        // Display page.
        helpers.displayPage(req, res, 'restaurants/index.html.twig', {
            restaurants: allRestaurants,
            staffMembers: sortedStaffMembers,
            error: error
        });
        // Log response. This is just to see that page was displayed.
        log.infoResponse(arguments.callee.name, res);
    }
}

/**
 * @function change_status: Changes the status of an restaurant, via AJAX.
 * @param req
 * @param res
 */
function change_status (req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);
    var result;

    // Call to update status.
    sc.ChangeRestaurantStatus(null, callback, req.body);

    function callback (scResponse) {

        if (scResponse) {
            var success = scResponse.success ? true : false;
            result = {
                success: success,
                message: success ? "common.labels.changes_saved": "common.labels.changes_failure"
            };
        } else {
            result = {
                success: false,
                message: "common.labels.persistence_error"
            };
        }

        res.send(200, result);
        // Log response.
        log.infoResponse(arguments.callee.name, res, result);
    }
}

/**
 * @function update_password: Updates the password for a restaurant user, via AJAX.
 * @param req
 * @param res
 */
function update_password (req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);
    var result;

    // Get encrypt lib.
    var shasum = require('crypto').createHash('sha1');

    // Encrypt password
    req.body.fieldValue = shasum.update(req.body.fieldValue).digest('base64');

    sc.EditStaffMember(null, callback, req.body);

    function callback (scResponse) {

        if (scResponse) {
            var success = scResponse.success ? true : false;
            result = {
                success: success,
                message: success ? "common.labels.changes_saved": "common.labels.changes_failure"
            };
        } else {
            result = {
                success: false,
                message: "common.labels.persistence_error"
            };
        }

        res.send(200, result);
        // Log response.
        log.infoResponse(arguments.callee.name, res, result);
    }
}

/**
 * @function delete_restaurant: Deletes a restaurant, via AJAX.
 * @param req
 * @param res
 */
function delete_restaurant(req, res){
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);
    var result;

    sc.DeleteRestaurant(null, callback, req.body);

    function callback (scResponse) {

        if (scResponse) {
            var success = scResponse.success ? true : false;

            result = {
                success: success,
                message: success ? "restaurantsPage.message.delete_success": "common.labels.changes_failure"
            };
        } else {
            result = {
                success: false,
                message: "common.labels.persistence_error"
            };
        }

        res.send(200, result);
        // Log response.
        log.infoResponse(arguments.callee.name, res, result);
    }
}

/**
 * @function registerRoutes: Registers handles for each route.
 * @param httpServer
 */
function registerRoutes(httpServer) {

    var loginHandlers = {
        get: {
            "/superadmin/add_restaurant": add_restaurant,
            "/superadmin/restaurants": restaurants
        },
        "post": {
            "/superadmin/add_restaurant": add_restaurant,
            "/superadmin/change_status": change_status,
            "/superadmin/update_password": update_password,
            "/superadmin/delete_restaurant": delete_restaurant
        }
    }

    routeReqister.registerRoutes(httpServer, loginHandlers, routeReqister.pageTypes.superadmin);
}



module.exports = {
    registerRoutes: registerRoutes
}
