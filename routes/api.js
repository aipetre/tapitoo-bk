/**
 * Created by root on 3/14/14.
 */

// Library to register route handlers.
var routeReqister = require("../lib/routeRegister");

// Library to make Persistence calls.
var sc = require("../lib/serverCommunication").ServerCommunication;

// Helper methods
var helpers = require("../lib/helpers");

// Generate ids
var uuid = require('node-uuid');

// Global sockets
var sockets;

// Weekdays
var weekday=new Array(7);
weekday[0]="sunday";
weekday[1]="monday";
weekday[2]="tuesday";
weekday[3]="wednesday";
weekday[4]="thursday";
weekday[5]="friday";
weekday[6]="saturday";

// Get logger for this module
var log = require('../lib/log').get("apiRoute");

function add_order(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    // Set CORS headers.
    set_cors_headers (res);

    // Result object.
    var response = {};

    // Flag if we should update client details.
    var updateClient = true;

    if (req.body.restaurantId && req.body.locationId) {
        // Replicate request
        // Nasty hack need to provide these all the time.
        var mandatoryParams = {
            "session": {
                "restaurantId": req.body.restaurantId,
                "locationId": req.body.locationId
            }
        };

        if (req.body.client && Object.keys(req.body.client).length > 0) {
            var clientParams =  req.body.client;

            // Add new client if id is null
            if (clientParams.clientId === null) {
                // Set flag to disable updating the client because it is a new one.
                updateClient = false;

                // Generate and remember Client ID.
                clientParams.clientId =  uuid.v4();
            }
            // Always call add client. If it already exists it will be merged in persistence!
            sc.AddClient(mandatoryParams, addClientCallback, clientParams);
        } else {
            // No client provieded
            send_response (req, res, {
                "success": false,
                "message": "Need client details to complete request"
            });
        }

        function addClientCallback(scResponse) {

            if (scResponse && scResponse.success === true) {
                // Ok, add succesful remember id.
                response.clientId = clientParams.clientId;
                log.debugEntry(mandatoryParams, arguments.callee.name, "Added new client with id " + response.clientId +", now adding order");
                addOrder();
            } else {
                send_response (req, res, {
                    "success": false,
                    "message": "Could not add client, aborting"
                });
            }
        }

        function addOrder() {
            // Generate Order Id
            var orderId =  uuid.v4();

            // Create Order mapping.
            var orderParams = {
                orderId: orderId,
                clientId: clientParams.clientId,
                type: req.body.type ? req.body.type: "delivery",
                status: "new", // Note: Hardcoded to new.
                address: req.body.deliveryAddress ?  req.body.deliveryAddress: null,
                additionalInfo: req.body.additionalInfo ? req.body.additionalInfo: "",
                lastSeen: req.body.client.lastSeen ? req.body.client.lastSeen: "portal", // hardcoded default to portal. Need this to remember from which app (custom or portal) the order was added.
                latLng: req.body.latLng ? JSON.stringify(req.body.latLng) : null,
                jsonOrderedProductList: req.body.products ? JSON.stringify(req.body.products) : null
            };

            sc.CreateOrder(mandatoryParams, addOrderCallback, orderParams);

            function addOrderCallback(scResponse) {

                if (scResponse && scResponse.success === true) {
                    // Ok, remember Order ID.
                    response.orderId = orderParams.orderId;
                    response.success = true;

                    // Important that we put also orderId.
                    req.body.id = response.orderId;

                    // Set received date.
                    var dateObject = new Date();
                    req.body.date = dateObject.getDate() + '/' + dateObject.getMonth() + '/' + dateObject.getFullYear() + ' ' + dateObject.getHours() + ':' +  (dateObject.getMinutes()<10?'0':'') + dateObject.getMinutes() + ':' + (dateObject.getSeconds()<10?'0':'') + dateObject.getSeconds();

                    // Emit to all clients new order
                    sockets.emit('add_order', req.body);

                    send_response (req, res, response);

                    ///Finally update Client details. This is last because an error of updating the client does not top de process.
                    if (updateClient) {
                        // Transform the fields into an Object name:value
                        var arrayOfFields = [];
                        for(propName in clientParams) {
                            if (propName != "clientId") {
                                var object = {};
                                object[propName] = clientParams[propName];
                                arrayOfFields.push(object);
                            }
                        }
                        // Trigger update
                        updateClientFields();

                        function updateClientFields() {
                            var param = arrayOfFields.shift();

                            if (param) {
                                // Get name
                                var fieldName = Object.keys(param)[0];
                                // Get value
                                var fieldValue = param[Object.keys(param)[0]];

                                // Update field
                                var params = {
                                    clientId: clientParams.clientId,
                                    fieldName: fieldName,
                                    fieldValue: fieldValue
                                };

                                sc.UpdateClient(mandatoryParams, callback, params);
                            }


                            function callback(scResponse) {

                                if (scResponse) {
                                    if (scResponse.success) {
                                        // Update next field
                                        updateClientFields();
                                    }
                                } else {
                                    // Log failure.
                                    log.infoEntry(req, arguments.callee.name, "Could not update client field '" + fieldName + "' with new value '" + fieldValue + "' for client with ID " + clientParams.clientId);
                                }
                            }
                        }
                    }
                } else {
                    log.warnEntry(mandatoryParams, arguments.callee.name, "Could not add order");
                    send_response (req, res, {
                        "success": false,
                        "message": "Could not add order, aborting"
                    });
                }
            }
        }
    } else {
        send_response (req, res, {
            "success": false,
            "message": "Need restaurantId and locationId to complete request"
        });
    }
}

/**
 * @function get_menu: Get all needed information about restaurant:
 * - menu.
 * - opening hours.
 * - location & delivery area.
 * - minimum delivery fee.
 * - delivery fee per order.
 * @param req
 * @param res
 */
function get_menu(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    var result = {};
    var products = new Array();

    // Get Restaurant parameters
    var mandatoryParams = {
        "session": {
            "restaurantId": req.params.restaurantId,
            "locationId": req.params.locationId
        }
    };

    sc.GetProducts(mandatoryParams, callback);

    function callback(scResponse) {

        if (scResponse) {

            var allCategories = helpers.parseResult(scResponse, "cat");
            var allProductsArray = helpers.parseResult(scResponse, "prod");
            var productsPerCat = {};

            // Parse categories to associate categoryId with full category item.
            for (var i = 0, length = allCategories.length;  i < length ;i++) {
                var category =allCategories[i];
                allCategories[category.categoryId] = category;
            }

            for (var i = 0;  i < allProductsArray.length ;i++) {
                var product = allProductsArray[i];

                // Check if product not deleted or category is not deleted.
                if (allCategories[product.categoryId].deleted !== "true" && product.deleted !== "true") {
                    productsPerCat[product.categoryId] = productsPerCat[product.categoryId] ? productsPerCat[product.categoryId] : new Array();
                    productsPerCat[product.categoryId].push(product);
                }
            }

            for(var categoryId in productsPerCat) {
                products.push({
                    "categoryId": allCategories[categoryId].categoryId,
                    "categoryName": allCategories[categoryId].categoryName,
                    "products": productsPerCat[categoryId]
                });
            }

            result.menu = products;
            result.success = true;
            send_response(req, res, result);
        } else {
            result.success = false;
            result.error = "retrieve_product";
            send_response(req, res, result);
        }
    }
}

/**
 * @function get_restaurants: Retrieves all "available" restaurants
 * @param req
 * @param res
 */
function get_restaurants(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    // Define default value
    var result = {};
    var locations = [];

    sc.GetAllRestaurants(null, getAllRestaurantsCallback);

    function getAllRestaurantsCallback(scResponse) {

        if (scResponse) {
            var allRestaurants = helpers.parseResult(scResponse, "restaurant");

            // Populate this.
            var restaurants = [];

            log.traceEntry(req, arguments.callee.name, "Loop through restaurants start...");
            loopRestaurants();

            /**
             * @function loopRestaurants Goes through each restaurant and gets the details for each location, if restaurant is not closed
             */
            function loopRestaurants() {

                var restaurant = allRestaurants.shift();

                if (restaurant) {

                    // Return only those who are active
                    if (restaurant.status === "available") {

                        // Flag that checks if the restaurant delivers at this time
                        var restaurantOpened = checkIfRestaurantIsOpened(restaurant.openingHours);

                        var mandatoryParams = {
                            "session": {
                                "restaurantId": restaurant.restaurantId
                            }
                        }

                        helpers.getRestaurantLocations(mandatoryParams, function(locationResult) {

                            // Check if we have locations
                            if (Array.isArray(locationResult)) {
                                locations = locationResult;

                                function getLocationDetails (locationList) {

                                    // Set info result;
                                    var locations = [];

                                    // Go through all locations
                                    function loopLocations () {
                                        var restaurantLocation = locationList.shift();

                                        if(restaurantLocation) {
                                            // Update this and push it in the info.locations array
                                            var locationDetails = {
                                                locationId: restaurantLocation.locationId,
                                                "name": restaurantLocation.name
                                            };

                                            // Replicate
                                            var replicaRequest = {
                                                session : {
                                                    restaurantId: restaurant.restaurantId,
                                                    locationId: restaurantLocation.locationId
                                                }
                                            };

                                            sc.GetLocation(replicaRequest, callbackGetLocation);

                                            function callbackGetLocation(scResponse) {

                                                if (scResponse) {
                                                    var location = helpers.parseResult(scResponse, "location");

                                                    if (location[0].LatLng) {
                                                        var latLng = JSON.parse(location[0].LatLng);

                                                        locationDetails.locationCoordinates = latLng;
                                                        getDeliveryArea();
                                                    } else {
                                                        // TODO Update Error Handling
                                                        locationDetails.locationCoordinates = "no_location_and_delivery_area";
                                                        getMinDeliveryFee();
                                                    }
                                                }  else {
                                                    result.success = false;
                                                    result.error = "retrieve_location";
                                                    send_response(req, res, result);
                                                }
                                            };

                                            function getDeliveryArea() {
                                                sc.GetDeliveryArea(replicaRequest, callback);

                                                function callback(scResponse) {

                                                    if (scResponse) {
                                                        var location = helpers.parseResult(scResponse, "location");
                                                        var deliveryArea = location[0].deliveryArea;

                                                        if (deliveryArea) {
                                                            locationDetails.locationCoordinates.deliveryArea = deliveryArea;
                                                        } else {
                                                            // Just set flag.
                                                            locationDetails.locationCoordinates = "no_delivery_area";
                                                        }
                                                        getMinDeliveryFee();
                                                    } else {
                                                        // TODO Update Error Handling
                                                        result.success = false;
                                                        result.error = "retrieve_delivery_area";
                                                        send_response(req, res, result);
                                                    }
                                                }
                                            }

                                            function getMinDeliveryFee() {
                                                sc.GetMinimumDeliveryFee(replicaRequest, callback);

                                                function callback(scResponse) {

                                                    if (scResponse) {
                                                        var location = helpers.parseResult(scResponse, "location");
                                                        var minDeliveryFee = location[0].minDeliveryFee ? location[0].minDeliveryFee: 0;

                                                        locationDetails.minDeliveryFee = minDeliveryFee;

                                                        getDeliveryFee();
                                                    } else {
                                                        // TODO Update Error Handling
                                                        result.success = false;
                                                        result.error = "retrieve_minimum_delivery_fee";
                                                        send_response(req, res, result);
                                                    }
                                                }
                                            }

                                            function getDeliveryFee() {
                                                sc.GetDeliveryFee(replicaRequest, callback);

                                                function callback(scResponse) {

                                                    if (scResponse) {
                                                        var location = helpers.parseResult(scResponse, "location");
                                                        var deliveryFee = location[0].deliveryFee ? location[0].deliveryFee : 0;

                                                        locationDetails.deliveryFee = deliveryFee;

                                                        // Add details in result.
                                                        locations.push(locationDetails);

                                                        // Continue to loop through locations.
                                                        loopLocations();
                                                    } else {
                                                        // TODO Update Error Handling
                                                        result.success = false;
                                                        result.error = "retrieve_delivery_fee";
                                                        send_response(req, res, result);
                                                    }
                                                }
                                            }
                                        } else {
                                            log.traceEntry(req, arguments.callee.name, "Loop through locations for restaurant '"+ restaurant.restaurantId +"' finished");
                                            // Push to list
                                            restaurants.push({
                                                "restaurantName": restaurant.displayName,
                                                "status": restaurant.status,
                                                "open": restaurantOpened,
                                                "isChain": restaurant.isChain === "true" ? true : false,
                                                "locations": locations,
                                                "restaurantId": restaurant.restaurantId // The name is the restaurantId.
                                                //"locationId": restaurant.id // The id is the locationId.
                                            });

                                            // Continue with next restaurant.
                                            loopRestaurants();
                                        }
                                    }
                                    log.traceEntry(req, arguments.callee.name, "Loop through locations for restaurant '"+ restaurant.restaurantId +"' start...");
                                    // Loop through locations.
                                    loopLocations();
                                }
                                getLocationDetails(locations);
                            } else {
                                log.warnEntry(req, arguments.callee.name, "Failed to retrieve locations for restaurant '"+ restaurant.restaurantId +"'");
                                result.success = false;
                                result.error = "retrieve_locations";
                                send_response(req, res, result);
                            }
                        });
                    } else {
                        log.traceEntry(req, arguments.callee.name, "Restaurant '"+ restaurant.restaurantId +"' is closed skipping to retrieve details...");
                        // Loop through next location.
                        loopRestaurants();
                    }
                } else {
                    log.traceEntry(req, arguments.callee.name, "Finished looping through restaurants");
                    result.success = true;
                    result.restaurants = restaurants;
                    send_response(req, res, result);
                }
            }
        } else {
            log.warnEntry(req, arguments.callee.name, "Failed to retrieve restaurants");
            result.success = false;
            result.error = "retrieve_restaurants";
            send_response(req, res, result);
        }
    }
}

// Helper functions
/**
 * Calculates if an restaurant is opened given the following schedule list
 * @param openingHoursString String containing openingHours as it comes from persistence
 */
function checkIfRestaurantIsOpened(openingHoursString) {
    // By default it is closed.
    var result = false;

    // check if there are opening hours set
    if (openingHoursString) {

        /**
         * @function parseStringToHour Returns an object with hour and minutes calculated from given string.
         * @param str String in hh:mm AM|PM format
         * @returns {*} Object containing hour and minutes properties
         */
        function parseStringToHour(str) {
            var result = {
                hour : 0,
                minutes: 0
            };
            // By default PM is false.
            var pm = false;

            // Check if hour is PM.
            if (str.indexOf("PM") > -1) {
                pm = true;
            }

            // Get clean string without AM and PM.
            var cleanedString = str.substring(0,5);
            var arrayDate = cleanedString.split(":");

            result.hour = parseInt(arrayDate[0]);
            result.minutes = parseInt(arrayDate[1]);

            // If pm is false and hours is 12 then it means it is 0 hour.
            if (result.hour == 12 && !pm) {
                result.hour = 0;
            }

            // Add 12 hrs of PM
            if (pm) {
                result.hour = result.hour + 12;
            }

            return result;
        }

        var openingHours = JSON.parse(openingHoursString);

        var d=new Date();
        var today = weekday[d.getDay()];

        // Get today opening and closing hour.
        var openingHour = today + "_opening_hours";
        var closingHour =  today+ "_closing_hours";
        var openingHourValue = openingHours[openingHour];
        var closingHourValue = openingHours[closingHour];

        // If one value is "closed" don't bother it will be closed.
        if (openingHourValue !== "closed" && closingHourValue !== "closed") {

            // If both ar "midnight" this means non-stop
            if (openingHourValue === "midnight" && closingHourValue === "midnight") {
                result = true;
            } else {
                // Get current hour and minute
                var currentHour = d.getHours();
                var currentMinute = d.getMinutes();

                // Parse hours
                if (openingHourValue === "midnight") {
                    openingHourValue = "24:00";
                }

                if (closingHourValue === "midnight") {
                    closingHourValue = "24:00";
                }

                // Get integer values
                var openingHourInfo = parseStringToHour(openingHourValue);
                var closingHourInfo = parseStringToHour(closingHourValue);

                // Check if current hour and minutes are in the open interval
                if ( ((openingHourInfo.hour < currentHour) || (openingHourInfo.hour === currentHour && openingHourInfo.minutes <= currentMinute)) &&
                     ((closingHourInfo.hour > currentHour) || (currentHour === closingHourInfo.hour && currentMinute <= closingHourInfo.minutes))
                    ) {
                    result = true;
                }
            }
        }
    } else {
        // Not Set
        result = "no_opening_hours";
    }

    return result
}


function test(req, res) {

    res.send(200, {
        "id1": uuid.v4(),
        "id2": uuid.v4()
    });
}

/**
 * @function send_response: Hack to test in browser.
 * @param req Incomming Message
 * @param res Response Message
 * @param obj Object to be sent
 */
function send_response (req, res, obj) {

    res.header('Content-type','application/json');
    res.header('Charset','utf8');
    if (req.query.callback) {
        res.jsonp(obj);
    } else {
        res.send(200, obj);
    }
    // Log response that is sent back.
    log.infoResponse(arguments.callee.name, res, obj);
}

/**
 * @function set_cors_headers: Required headers to make Cross domain ajax requests
 * @param res
 */
function set_cors_headers (res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Max-Age", "3000");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/**
 * @function send_headers: Return a headers response for OPTIONS calls.
 * @param req
 * @param res
 */
function send_headers (req, res) {
    set_cors_headers(res);
    res.send(200);
}

/**
 * @function registerRoutes
 * @param httpServer
 * @param io Sockets used for
 */
function registerRoutes(httpServer, io) {

    var apiHandlers = {
        get: {
            //"/api/test": test,
            "/api/restaurant/:restaurantId/location/:locationId/get_menu": get_menu,
            "/api/restaurants/": get_restaurants
        },
        "post": {
            "/api/add_order": add_order
        },
        "options": {
            "/api/restaurant/:restaurantId/location/:locationId/get_menu": send_headers,
            "/api/restaurants/": send_headers,
            "/api/add_order": send_headers
        }
    }

    routeReqister.registerRoutes(httpServer, apiHandlers);

    // Register global sockets with io.sockets Object
    sockets = io.sockets;
}

module.exports = {
    registerRoutes: registerRoutes
}


