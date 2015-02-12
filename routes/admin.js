/**
 * Created by ipetre on 2/20/14.
 */

// Library to register route handlers.
var routeReqister = require("../lib/routeRegister");

// Library to make Persistence calls.
var sc = require("../lib/serverCommunication").ServerCommunication;

// String thirdparty
var S = require('string');

// Forms
var forms = require("../lib/forms");

// Helper methods
var helpers = require("../lib/helpers");

// Generate ids
var uuid = require('node-uuid');

// Get logger for this module
var log = require('../lib/log').get("adminRoute");

/**
 * @function clients Displays Clients page.
 * @param req
 * @param res
 */
function clients(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    // Default values
    var error = null;
    var view = {
        users: [],
        locations: {}
    };

    function get_clients() {
        // Make persistence request.
        sc.GetClients(req, callback);

        function callback(scResponse) {
            if (scResponse) {
                view.users = helpers.parseResult(scResponse, "client");

                // Get location display name
                if (req.session.type == "chainmanager") {
                    // Get all locations because we are displaying clients from all locations
                    helpers.getRestaurantLocations(req, locationsRetrieve);
                } else {
                    view.locations[req.session.locationId] = req.session.locationDisplayName;
                    render_page();
                }
            } else {
                error = "common.labels.persistence_error";
                // Stop and render page response
                render_page();
            }
        }
    }

    /**
     * @function locationsRetrieve Callback for retrieving locations
     * @param response Array of locations or string with error
     */
    function locationsRetrieve(response) {
        // Check result
        if (Array.isArray(response)) {
            response.forEach(function (location) {
                view.locations[location.locationId] = location.name;
            });
        } else {
            error = "common.labels.persistence_error";;
        }

        render_page();
    }

    /**
     * @function render_page Render page
     */
    function render_page(){
        // Stop and render page response
        helpers.displayPage(req, res, 'clients/index.html.twig', {
            view: view,
            error: error
        });
        // Log response. This is just to see that page was displayed.
        log.infoResponse(arguments.callee.name, res);
    }

    // Get clients
    get_clients();
}

/**
 * @function push_notifications: Pushes notification to clients for Android and iOS devices.
 * @param req
 * @param res
 * @returns {boolean}
 */
function push_notifications(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);
    // Init result.
    var result;

    // Array to push notifications to.
    var androidRegIds = [];
    var iosIds = [];

    // Array to push notification depending on the 'custom' or 'portal' ios application
    var customIosIds = [];
    var portalIosIds = [];

    // Map of RegIds and ClientIds
    var regIdToClientId = {};
    var iosIdToClient = {};

    // Clients that need to be updated
    var clientsNeedUpdate = [];

    // Is this from Orders page.
    var orderNotification = req.body.orderNotification || false;

    // Flag that signals a failure.
    var notificationFailure = false;

    // Get message.
    var textMessage = S(req.body.textMessage).trim().s;
    // Get clients.
    var clients = req.body.clients;

    // Check againg if we have clients. Overkill, I'm paranoid.
    if (clients.length == 0) {
        result = {
            result: false,
            message: "userPage.message.no_clients"
        };
        res.send(200, result);

        // Log response.
        log.infoResponse(arguments.callee.name, res, result);

        // Explicitly stop;
        return false;
    }

    // Check again that message is not empty. Overkill, I'm paranoid.
    if (textMessage.length == 0) {
        result = {
            result: false,
            message: "userPage.message.empty_text"
        };
        res.send(200, result);

        // Log response.
        log.infoResponse(arguments.callee.name, res, result);

        // Explicitly stop;
        return false;
    }

    // All good!
    // Get the Android RegIds or iOS tokenss
    for (var i = 0, length = clients.length; i< length; i++) {
        var client = clients[i];

        // Check if this client has and android registration Id. Testing with int or string 0 is for legacy reasons.
        if (client.androidID && client.androidID !== '0' && client.androidID !== 0 && client.androidID.length > 0) {
            androidRegIds.push(client.androidID);
            regIdToClientId[client.androidID] = client.id;
        }

        // Check if this client has and iOS token. Testing with int or string 0 is for legacy reasons.
        if (client.iosID && client.iosID !== '0' && client.iosID !== 0 && client.iosID.length > 0) {
            iosIds.push(client.iosID);
            iosIdToClient[client.iosID] = client;
        }
    }

    // Cache length properties
    var androidDevices = androidRegIds.length;
    var iosDevices = iosIds.length

    // Check if we have valid devices.
    if (androidDevices == 0 && iosDevices == 0) {
        result = {
            result: false,
            message: "userPage.message.no_devices"
        };

        res.send(200, result);

        // Log response.
        log.infoResponse(arguments.callee.name, res, result);

        // Explicitly stop;
        return false;
    }

    // If there are android devices send message.
    if (androidDevices > 0) {
        log.debugEntry(req, arguments.callee.name, "Sending to android devices");

        // Get GCM lib.
        var gcm = require('node-gcm');

        // Our GCM API Key. Note: Hardcoded API key.
        var sender = new gcm.Sender("AIzaSyB4OJDNkQbKoIA83Iwk0khLIEDdZWfp4cU");

        // create a message.
        var message = new gcm.Message();
        message.addDataWithKeyValue('message', textMessage);
        message.collapseKey = 'tapitoo';
        message.delayWhileIdle = false;
        //message.timeToLive = 3;

        // Try 3 times.
        sender.send(message, androidRegIds, 3, function (err, result) {

            log.debugEntry(req, arguments.callee.name, "Android push notification result:");
            log.debugEntry(req, arguments.callee.name, result);

            // We received an result
            if (result) {

                // Check for failures.
                if (result.failure > 0) {
                    // Toggle failure flag.
                    notificationFailure = true;

                    // Customer to updated
                    for (var i = 0, length = result.results.length; i < length; i++) {
                        var deviceResponse = result.results[i];

                        // If message_id is set, check for registration_id:
                        if (deviceResponse.message_id && deviceResponse.registration_id) {
                            // Create of of clients that need update. Key is client.id
                            clientsNeedUpdate.push({
                                clientId: regIdToClientId[androidRegIds[i]],
                                fieldName: "androidID",
                                fieldValue: deviceResponse.registration_id
                            });
                        } else if (deviceResponse.error) {
                            // We received some error
                            switch (deviceResponse.error) {
                                case "Unavailable":
                                    // you could retry to send it in another request.
                                    // TODO maybe retry to resend?
                                    break;

                                case "NotRegistered":
                                    // you should remove the registration ID from your server database because the application was uninstalled from the device or it does not have a broadcast receiver configured to receive
                                    clientsNeedUpdate.push({
                                        clientId: regIdToClientId[androidRegIds[i]],
                                        fieldName: "androidID",
                                        fieldValue: ""
                                    });
                                    break;

                                default:
                                    // This is reductant with above, but keeping it separate.
                                    // Otherwise, there is something wrong in the registration ID passed in the request; it is probably a non-recoverable error that will also require removing the registration from the server database.
                                    clientsNeedUpdate.push({
                                        clientId: regIdToClientId[androidRegIds[i]],
                                        fieldName: "androidID",
                                        fieldValue: ""
                                    });
                            }
                        }
                    }
                }

                // Trigger to send to iOS.
                pushNotificationTOIOS();
            } else {
                // An error occured while trying to send push notification.
                // Stopping the whole notification process here!!!
                log.debugEntry(req, arguments.callee.name, "Android push notification failure");
                log.debugEntry(req, arguments.callee.name, err);

                result = {
                    result: false,
                    message: "userPage.message.push_notifications_failure"
                };
                res.send(200, result);

                // Log response.
                log.infoResponse(arguments.callee.name, res, result);
            }
        });
    } else {
        // Just sent to iOS.
        pushNotificationTOIOS();
    }

    /**
     * @function pushNotificationTOIOS: Push notifications to iOS devices.
     */
    function pushNotificationTOIOS() {
        // If there are iOS devices send message.
        if (iosDevices > 0) {
            log.debugEntry(req, arguments.callee.name, "Sending to iOS devices start...");

            // Load path lib.
            var path = require('path');

            // Load file system lib.
            var fs = require('fs');

            // Load apn lib.
            var apn = require('apn');

            // WARNING: HARDCODED PASSPHRASE FOR IOS APPS.
            var passphrase = "tapitoo";

            // 'custom' app options
            // Full restaurant id.
            var fullRestaurantId = req.session.restaurantId;
            var customCertPath = path.join(__dirname, '../public/ios/'+ fullRestaurantId +'/tapitoo-cert.pem');
            var customKeyPath = path.join(__dirname, '../public/ios/'+ fullRestaurantId  +'/tapitoo-key.pem');
            var customApp = true;

            // 'portal' app option
            var portalCertPath = path.join(__dirname, '../public/ios/portal/tapitoo-cert.pem');
            var portalKeyPath = path.join(__dirname, '../public/ios/portal/tapitoo-key.pem');
            var portalApp = true;

            // Lookup for 'custom' and 'portal' iOS certificates
            var iOSNotificationMap = {
                "custom": {
                    cert: customCertPath,
                    key: customKeyPath
                },
                "portal": {
                    cert: portalCertPath,
                    key: portalKeyPath
                }
            };

            // Check if there are certificate files for a custom application.
            if (!fs.existsSync(customCertPath) || !fs.existsSync(customKeyPath)) {
                customApp = false;
            }

            // Check if there are certificate files for a portal application.
            if (!fs.existsSync(portalCertPath) || !fs.existsSync(portalKeyPath)) {
                portalApp = false;
            }

            // Do we have an app?
            if (!customApp && !portalApp) {
                // This is an optimization to skip filtering.
                // Just go to updated clients and exit.
                result = {
                    result: false,
                    message: "userPage.message.check_ios_certificates"
                };

                updateClients();
            } else {
                // Group the clients depending on the lastSeen flag.
                filterClientsPerApplication();

                // flag to determine if ios notifications were sent.
                var customSent = false;
                var portalSent = false;

                // send to 'custom' app if there are any ios ids.
                if (customIosIds.length > 0) {
                    // Check for the certificates.
                    if (customApp) {
                        customSent = true;
                        sendNotifications("custom", customIosIds);
                    } else {
                        log.warnEntry(req, arguments.callee.name, "There are no iOS certificates for the custom application for restaurant '"+ fullRestaurantId +"'. Skipping to send notification...");
                    }
                }

                // Send to 'portal' app if there are any ios ids.
                if (portalIosIds.length > 0) {
                    // Check if there are certificates.
                    if (portalApp) {
                        portalSent = true;
                        sendNotifications("portal", portalIosIds);
                    } else {
                        log.warnEntry(req, arguments.callee.name, "There are no iOS certificates for the portal application. Skipping to send notification...");
                    }
                }

                log.debugEntry(req, arguments.callee.name, "Sending to iOS devices end...");

                if (!customSent && !portalSent) {
                    // Return some message saying that ios notification did not work.
                    // Just go to updated clients and exit.
                    result = {
                        result: false,
                        message: "userPage.message.no_ios_notification"
                    };

                    updateClients();
                } else {
                    // Eventually update clients as well.
                    updateClients();
                }
            }

            /**
             * @function filterClientsPerApplication. Separates the iosId depending on the clients lastSeen flag.
             */
            function filterClientsPerApplication () {

                for (var i = 0, length = iosIds.length; i < length; i++) {
                    // Get iosID to send to.
                    var iosId = iosIds[i];

                    // Get the client associated with this iosId.
                    var clientDetails = iosIdToClient[iosId];

                    // Determine on which application the user has been seen.
                    // Note: Going to portal if 'lastSeen' is not set.
                    var lastSeen = clientDetails.lastSeen || "portal";

                    // Put in the appropriate array depending on lastSeen flag.
                    if (lastSeen === "portal") {
                        portalIosIds.push(iosId);
                    } else if (lastSeen === "custom") {
                        customIosIds.push(iosId);
                    }
                }
            }

            /**
             * @param sendNotifications: Sends a bulk of notifications using appropiate ios application certificates.
             * @param type String that should be either 'custom' or 'portal'
             * @param deviceIdsToSend Array of iosIds to send to notification.
             */
            function sendNotifications(type, deviceIdsToSend) {

                log.debugEntry(req, arguments.callee.name, "Sending to iOS devices using '"+ type +"' certificates");

                // Options to connect.
                var options = {
                    cert: iOSNotificationMap[type].cert,
                    key: iOSNotificationMap[type].key,
                    passphrase: passphrase
                };

                // Create connection.
                var service  = new apn.Connection(options);

                service.on('connected', function() {
                    log.debugEntry(req, arguments.callee.name, "Connected to iOS '"+ type +"'");
                });

                service.on('transmitted', function(notification, device) {
                    log.debugEntry(req, arguments.callee.name, "Notification transmitted ('"+ type +"') to:" + device.token.toString('hex'));
                });

                service.on('transmissionError', function(errCode, notification, device) {
                    log.warnEntry(req, "Notification ('"+ type +"') caused error: " + errCode + " for device ", device, notification);
                });

                service.on('timeout', function () {
                    log.debugEntry(req, arguments.callee.name, "Connection Timeout APNS ('"+ type +"')");
                });

                service.on('disconnected', function() {
                    // log.debugEntry(req, arguments.callee.name, "Disconnected from APNS ('"+ type +"')");
                });

                var feedback = new apn.Feedback(options);
                feedback.on("feedback", function(devices) {
                    // Need to separate how ios and android users are updated.
                    devices.forEach(function(item) {
                        // Do something with item.device and item.time;
                        log.infoEntry(req, arguments.callee.name, "Device: " + item.device.toString('hex') + " has been unreachable, since: " + item.time);

                        // Check if we have this device in cache
                        if (iosIdToClient[item.device.toString('hex')]) {
                            triggerClientUpdate([{
                                // Remove ios ID
                                clientId: iosIdToClient[item.device.toString('hex')].id,
                                fieldName: "iosID",
                                fieldValue: ""
                            }]);
                        } else {
                            // This else clause is probably overkill but I'm just paranoid.
                            // Search it in the clients
                            sc.GetClients(req, getClientsCallback);

                            function getClientsCallback(scResponse) {

                                // check if we have a response
                                if (scResponse) {
                                    clients = helpers.parseResult(scResponse, "client");

                                    for(var i = 0, length = clients.length; i < length; i++) {
                                        var client = clients[i];

                                        if (client.iosID && client.iosID == item.device.toString('hex')) {
                                            // Found client that could not receive the notification. Removing his iosID
                                            triggerClientUpdate([{
                                                // Remove ios ID
                                                clientId: client.id,
                                                fieldName: "iosID",
                                                fieldValue: ""
                                            }]);
                                        }
                                    }
                                }
                            }
                        }
                    });
                });

                /**
                 * @pushNotificationToMany Actual send bulk message.
                 */
                function pushNotificationToMany() {

                    var note = new apn.Notification();
                    note.setAlertText(textMessage);
                    note.badge = 1;
                    note.sound = "beep.caf";

                    service.pushNotification(note, deviceIdsToSend);
                }

                // Trigger ios notification
                pushNotificationToMany();
            }
        } else {
            // Just attempt clients.
            updateClients();
        }
    }

    /**
     * @function updateClients: Update the clients that failed to receive messages for a specific reason.
     * Updating androidID or iosID.
     */
    function updateClients() {

        if (clientsNeedUpdate.length > 0) {
            log.infoEntry(req, "Updating clients android ids");
            log.infoEntry(req, clientsNeedUpdate);

            // Trigger updates.
            triggerClientUpdate(clientsNeedUpdate);

            // Eventually send response.
            sendResponse();
        } else {
            // Send response
            sendResponse();
        }
    }

    /**
     * @function triggerClientUpdate: Triggers to update multiple Clients
     */
    function triggerClientUpdate(arrayOfClients) {
        var clientParams = arrayOfClients.shift();

        if (clientParams) {
            sc.UpdateClient(req, callbackUpdate, clientParams);

            function callbackUpdate(scResponse) {

                if (!scResponse || !scResponse.success) {
                    // Log failure.
                    log.infoEntry(req, arguments.callee.name, "Could not update client field '" + clientParams.fieldName + "' with new value '" + clientParams.fieldValue + "' for client with ID " + clientParams.clientId);
                }
                triggerClientUpdate(arrayOfClients);
            }
        }
    }

    function sendResponse() {

        // If we already have an result built, return it. It usually means some error in iOS notification.
        if (!result) {
            if (orderNotification && notificationFailure) {
                // From Orders page this means failure to transmit
                result = {
                    result: false,
                    message: "userPage.message.push_notifications_failure"
                };
            } else {
                // All ok. Some clients were notified.
                result = {
                    result: true,
                    message: "userPage.message.push_notifications_success"
                };
            }
        }

        // Send response.
        res.send(200, result);

        // Log response.
        log.infoResponse(arguments.callee.name, res, result);
    }
}

/**
 * @function add_location: Displays Restaurant > Add Location page
 * @param req
 * @param res
 */
function add_location(req, res){

    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);
    var error;

    var location_add = forms.create_new_form('location_add');

    location_add.handle(req, {
        success: function (form) {
            // there is a request and the form is valid
            // form.data contains the submitted data
            var data = form.data;

            // Create location Id.
            data.locationId = uuid.v4();

            // Create location for restaurant.
            sc.AddNewLocationToRestaurant(req, createLocationCallback, data);

            function createLocationCallback(scResponse) {

                if (scResponse) {

                    if(scResponse.success === true) {
                        // Render succes page
                        log.infoEntry(req, arguments.callee.name, "New restaurant location added redirecting to /admin/mange_locations...");
                        res.redirect("/admin/manage_locations");
                    } else {
                        // Something went wrong
                        log.warnEntry(req, arguments.callee.name, "Could not add new restaurant location");

                        helpers.displayPage(req, res, 'add_location/index.html.twig', {
                            form: form.toHTML(function (name, object) { return forms.my_field(name, object); } ),
                            error: "common.labels.changes_failure"
                        });
                    }
                } else {
                    // Problem with persistence
                    log.warnEntry(req, arguments.callee.name, "Persistence encountered an issue while adding a new location for restaurant.");
                    helpers.displayPage(req, res, 'add_location/index.html.twig', {
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
            helpers.displayPage(req, res, 'add_location/index.html.twig', {
                form: form.toHTML(function (name, object) { return forms.my_field(name, object); } ),
                error: ""
            });
            // Log response. This is just to see that page was displayed.
            log.infoResponse(arguments.callee.name, res);
        },
        empty: function (form) {
            // there was no form data in the request
            helpers.displayPage(req, res, 'add_location/index.html.twig', {
                form: form.toHTML(function (name, object) { return forms.my_field(name, object); } ),
                error: ""
            });
            // Log response. This is just to see that page was displayed.
            log.infoResponse(arguments.callee.name, res);
        }
    });

}

/**
 * @function manage_locations: Displays Restaurant > Manage Locations page
 * @param req
 * @param res
 */
function manage_locations(req, res) {
    // Display page..
    render_location_template(req, res, 'manage_locations/index.html.twig');

}

/**
 * @function delete_location: Deletes a restaurant location, via AJAX.
 * @param req
 * @param res
 */
function delete_location(req, res){
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);
    var result;

    sc.DeleteLocationForRestaurant(req, callback, req.body);

    function callback(scResponse) {

        if (scResponse) {
            var success = scResponse.success ? true : false;

            result = {
                success: success,
                message: success ? "manageLocationsPage.message.delete_success": "common.labels.changes_failure"
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
 * @function render_location_template: Renders location select drop-down for any page.
 * @param req
 * @param res
 * @param template Template to render
 */
function render_location_template(req, res, template) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    if (helpers.renderRestaurantLocations(req, res, template)) {
        // Log response. This is just to see page was displayed.
        log.infoResponse(arguments.callee.name, res);
    }
}

/**
 * @function location: Displays Restaurant > Location page.
 * @param req
 * @param res
 */
function location(req, res) {
    // Show drop-down.
    render_location_template(req, res, 'location/index.html.twig');
}

/**
 * @function get_location: Get the location details for a Location of an Restaurant. Renders a template
 * @param req
 * @param res
 */
function get_location(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    // Set default view values
    var view = {
        locationLat: "",
        locationLng: "",
        address: ""
    }
    var error = null;

    // Send location also
    var locationId = req.query.locationId;
    sc.GetLocation(req, callback, {locationId: locationId});

    function callback (scResponse) {

        if (scResponse) {
            var result = JSON.parse(scResponse.result);

            if (Object.keys(result).length > 0) {
                var latLng = result[0].location.LatLng ? JSON.parse(result[0].location.LatLng) : null;
                view = {
                    locationLat: latLng && latLng.latitude ? latLng.latitude : null,
                    locationLng: latLng && latLng.longitude ? latLng.longitude: null,
                    address: result[0].location.address ? result[0].location.address: null
                };
            }
        } else {
            error = "common.labels.persistence_error";
        }

        res.render('location/location.html.twig', {
            view: view,
            error: error
        });
        // Log response. This is just to see page was displayed.
        log.infoResponse(arguments.callee.name, res);
    }
}

/**
 * @function save_location: Saves the location in Persistence, via AJAX.
 * @param req
 * @param res
 */
function save_location(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    // Mapping
    var params = {
        locationId: req.body.locationId,
        "latLng": JSON.stringify({
            "latitude" : req.body.latitude,
            "longitude" : req.body.longitude
        }),
        "address" : req.body.address
    };

    sc.SetLocation(req, callback, params);

    function callback(scResponse) {

        if (scResponse) {
            var result = {
                "result": scResponse.success ? scResponse.success : false,
                "message": scResponse.success ? "common.labels.changes_saved"  :"common.labels.changes_failure"
            };
        } else {
            log.warnEntry(req, arguments.callee.name, "Could not save location.");
            var result = {
                "result": false,
                "message": "common.labels.persistence_error"
            };
        }

        res.send(200, result);

        // Log response.
        log.infoResponse(arguments.callee.name, res, result);
    }
}

/**
 * @function opening_hours: Displayes Restaurant > Opening hours page.
 * @param req
 * @param res
 */
function opening_hours(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    // Set default view values
    var view = {
        sunday_opening_hours: "",
        sunday_closing_hours: "",
        monday_opening_hours: "",
        monday_closing_hours: "",
        tuesday_opening_hours: "",
        tuesday_closing_hours: "",
        wednesday_opening_hours: "",
        wednesday_closing_hours: "",
        thursday_opening_hours: "",
        thursday_closing_hours: "",
        friday_opening_hours: "",
        friday_closing_hours: "",
        saturday_opening_hours: "",
        saturday_closing_hours: ""
    }

    var error = null;

    sc.GetOpeningHours(req, callback);

    function callback (scResponse) {

        if (scResponse) {
            var result = JSON.parse(scResponse.result);

            if(Object.keys(result).length > 0) {
                var openingHours = result[0].restaurant.openingHours ? JSON.parse(result[0].restaurant.openingHours) : {};

                if (Object.keys(openingHours).length > 0) {
                    view = openingHours;
                }
            }
        } else {
            error = "common.labels.persistence_error";
        }

        helpers.displayPage(req, res, 'opening_hours/index.html.twig', {
            view: view,
            error: error
        });
        // Log response. This is just to see page was displayed.
        log.infoResponse(arguments.callee.name, res);
    }
}

/**
 * @function save_opening_hours: Saves the opening hours for the restaurant.
 * @param req
 * @param res
 */
function save_opening_hours(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    // Mapping
    var params = {
        openingHours : JSON.stringify(req.body)
    };

    sc.SetOpeningHours(req, callback, params);

    function callback(scResponse) {

        if (scResponse) {
            var result = {
                "result": scResponse.success ? scResponse.success : false,
                "message": scResponse.success ? "common.labels.changes_saved"  :"common.labels.changes_failure"
            };
        } else {
            log.warnEntry(req, arguments.callee.name, "Could not save opening hours.");
            var result = {
                "result": false,
                "message": "common.labels.persistence_error"
            };
        }

        res.send(200, result);

        // Log response.
        log.infoResponse(arguments.callee.name, res, result);
    }
}

/**
 * @function delivery: Displays Restaurant > Delivery Area page.
 * @param req
 * @param res
 */
function delivery(req, res) {
    // Show dropdown
    render_location_template(req, res,  'delivery/index.html.twig');
}

/**
 * @function get_delivery_area: Renders delivery area page for a restaurant location.
 * @param req
 * @param res
 */
function get_delivery_area(req, res) {
    // Set default view values
    var view = {
        locationLat: "",
        locationLng: "",
        address: "",
        deliveryRadius: 0,
        warning: false
    }
    var error = null;

    // Send location also
    var locationId = req.query.locationId;
    sc.GetLocation(req, getLocationCallback, {locationId: locationId});

    function getLocationCallback (scResponse) {

        if (scResponse) {
            // Note Assuming scResponse contains location
            var result = JSON.parse(scResponse.result);

            if (Object.keys(scResponse).length > 0) {
                var latLng = result[0].location.LatLng ? JSON.parse(result[0].location.LatLng) : {};

                if (Object.keys(latLng).length > 0) {
                    view = {
                        locationLat: latLng &&  latLng.latitude ? latLng.latitude : null,
                        locationLng: latLng && latLng.longitude ? latLng.longitude : null,
                        address: result[0].location.address ? result[0].location.address : null
                    };
                } else {
                    view.warning = true;
                }
            } else {
                view.warning = true;
            }

            // Note very good, need to make another call to get radius every time even if location not set
            sc.GetDeliveryArea(req, getDeliveryAreaCallback, {locationId: locationId});
        } else {
            error = "common.labels.persistence_error";
        }
    }

    function getDeliveryAreaCallback(scResponse) {

        if (scResponse) {
            var result = JSON.parse(scResponse.result);

            if (Object.keys(result).length > 0) {
                view.deliveryRadius = !isNaN(result[0].location.deliveryArea) ? result[0].location.deliveryArea : 0;
            }
        } else {
            error = "common.labels.persistence_error";
        }

        res.render('delivery/delivery.html.twig', {
            view: view,
            error: error
        });
        // Log response. This is just to see page was displayed.
        log.infoResponse(arguments.callee.name, res);
    }
}

/**
 * @function save_delivery: Saves the delivery area for the restaurant, via AJAX.
 * @param req
 * @param res
 */
function save_delivery(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    // Mapping
    var params = {
        locationId: req.body.locationId,
        deliveryArea : req.body.radius
    };

    sc.SetDeliveryArea(req, callback, params);

    function callback(scResponse) {

        if (scResponse) {
            var result = {
                "result": scResponse.success ? scResponse.success : false,
                "message": scResponse.success ? "common.labels.changes_saved"  :"common.labels.changes_failure"
            };
        } else {
            log.warnEntry(req, arguments.callee.name, "Could not save delivery area.");
            var result = {
                "result": false,
                "message": "common.labels.persistence_error"
            };
        }

        res.send(200, result);

        // Log response.
        log.infoResponse(arguments.callee.name, res, result);
    }
}

/**
 * @function location: Displays Restaurant > Location page.
 * @param req
 * @param res
 */
function delivery_fees(req, res) {
    // Show drop-down.
    render_location_template(req, res, 'delivery_fees/index.html.twig');
}

/**
 * @function delivery_fees: Displays the Restaurant > Delivery Fees page.
 * @param req
 * @param res
 */
function get_delivery_fees (req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    var error;

    var view = {};

    // Send location also
    var locationId = req.query.locationId;
    sc.GetMinimumDeliveryFee(req, minDeliveryFeeCallcack, {locationId: locationId});

    function minDeliveryFeeCallcack(scResponse) {


        if (scResponse) {

            var location = helpers.parseResult(scResponse, "location");

            var minDeliveryFee = location[0].minDeliveryFee;

            view.minDeliveryFee = minDeliveryFee ? minDeliveryFee: 0;

            getDeliveryFee();

        } else {
            log.warnEntry(req, arguments.callee.name, "Could not retrieve MinimumDeliveryFee");
            error = "common.labels.persistence_error";
            helpers.displayPage(req, res, 'delivery_fees/index.html.twig', {
                error: error
            });
            // Log response. This is just to see page rendered.
            log.infoResponse(arguments.callee.name, res);
        }
    }

    function getDeliveryFee() {
        sc.GetMinimumDeliveryFee(req, deliveryFeeCallback, {locationId: locationId});

        function deliveryFeeCallback(scResponse) {


            if (scResponse) {

                var location = helpers.parseResult(scResponse, "location");

                var deliveryFee = location[0].deliveryFee;

                view.deliveryFee = deliveryFee ? deliveryFee: 0;

                helpers.displayPage(req, res, 'delivery_fees/delivery_fees.html.twig', {
                    view: view
                });
                // Log response. This is just to see if page is rendered.
                log.infoResponse(arguments.callee.name, res);
            } else {
                error = "common.labels.persistence_error";
                helpers.displayPage(req, res, 'delivery_fees/delivery_fees.html.twig', {
                    error: error
                });

                // Log response. This is just to see if page is rendered.
                log.warnEntry(req, arguments.callee.name, "Could not retrieve Delivery Fee");
                log.infoResponse(arguments.callee.name, res);
            }
        }
    }
}

/**
 * @function save_delivery_fees: Saves the minimum delivery fee and the order fee for the restaurant.
 * @param req
 * @param res
 */
function save_delivery_fees (req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    // Mapping
    var paramsinimumDeliveryFee = {
        locationId: req.body.locationId,
        minDeliveryFee : req.body.minDeliveryFee
    };

    sc.SetMinimumDeliveryFee(req, setMinFeeCallback, paramsinimumDeliveryFee);

    function setMinFeeCallback(scResponse) {

        if (scResponse) {
            saveDeliveryFee();
        } else {
            var result = {
                result: false,
                error: "common.labels.persistence_error"
            };
            res.send(200, result);

            // Log response.
            log.warnEntry(req, arguments.callee.name, "Could not save MinimumDeliveryFee");
            log.infoResponse(arguments.callee.name, res, result);
        }
    }

    function saveDeliveryFee() {

        var paramsDeliveryFee = {
            locationId: req.body.locationId,
            deliveryFee : req.body.deliveryFee
        };

        sc.SetDeliveryFee(req, setDeliveryFeeCallback, paramsDeliveryFee);

        function setDeliveryFeeCallback (scResponse) {

            if (scResponse) {
                var result = {
                    "result": scResponse.success ? scResponse.success : false,
                    "message": scResponse.success ? "common.labels.changes_saved"  :"common.labels.changes_failure"
                };
                res.send(200, result);

                // Log response.
                log.infoResponse(arguments.callee.name, res, result);
            } else {
                var result = {
                    result: false,
                    error: "common.labels.persistence_error"
                }

                res.send(200, result);

                // Log response.
                log.warnEntry(req, arguments.callee.name, "Could not save DeliveryFee");
                log.infoResponse(arguments.callee.name, res, result);
            }
        }
    }
}

/**
 * @function menu: Displays Restaurant > Menu page
 * @param req
 * @param res
 */
function menu(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    var categories = new Array();
    var products = new Array();
    var oldProducts = {};
    var error = null;

    sc.GetProducts(req, callback);

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
                    oldProducts[product.id] = product;
                }
            }

            for(var categoryId in productsPerCat) {
                products.push(productsPerCat[categoryId]);
                categories.push({
                    "categoryId": allCategories[categoryId].categoryId,
                    "categoryName": allCategories[categoryId].categoryName
                })
            }
        } else {
            log.warnEntry(req, arguments.callee.name, "Could not get products");
            error = "common.labels.persistence_error";
        }

        helpers.displayPage(req, res, 'menu/index.html.twig', {
            error: error,
            categories : categories,
            allProductsArray: products,
            oldProducts: oldProducts
        });

        // Log response. This is just to see if page is rendered.
        log.infoResponse(arguments.callee.name, res);
    }
}

/**
 * @function delete_product: Deletes a product on Menu page, via AJAX.
 * @param req
 * @param res
 */
function delete_product(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    sc.UpdateProductField(req, callback, req.body);

    function callback(scResponse) {

        if (scResponse) {
            var success =  scResponse.success ? scResponse.success : false;
            var result = {
                "result": success,
                "message": success ? "menuPage.deleted_product" : "common.labels.changes_failure"
            };
        } else {
            log.warnEntry(req, arguments.callee.name, "Could not delete product.");
            var result = {
                "result": false,
                "message": "common.labels.persistence_error"
            };
        }

        res.send(200, result);

        // Log response.
        log.infoResponse(arguments.callee.name, res, result);
    }
}

/**
 * @function delete_category: Deletes a whole category on Menu page, via AJAX.
 * @param req
 * @param res
 */
function delete_category(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    sc.UpdateCategoryField(req, callback, req.body);

    function callback(scResponse) {

        if (scResponse) {
            var success =  scResponse.success ? scResponse.success : false;
            var result = {
                "result": success,
                "message": success ? "menuPage.deleted_category" : "common.labels.changes_failure"
            };
        } else {
            log.warnEntry(req, arguments.callee.name, "Could not delete category.");
            var result = {
                "result": false,
                "message": "common.labels.persistence_error"
            };
        }

        res.send(200, result);

        // Log response.
        log.infoResponse(arguments.callee.name, res, result);
    }
}

/**
 * @function update_menu: Saves the menu changes, via AJAX.
 * @param req
 * @param res
 */
function update_menu(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    res.setHeader('content-type', 'application/json');

    var categoriesAndProducts = req.body.categoriesAndProducts;
    var oldProducts = req.body.oldProducts;

    var categoryIds = new Array();
    var productIds = new Array();


    addCategoryAndProducts(categoriesAndProducts);

    function addCategoryAndProducts (categoriesAndProducts) {
        var category = categoriesAndProducts.shift();
        var categoryId;

        if (category) {
            if (category.categoryId === "") {
                // Add category
                log.infoEntry(req, arguments.callee.name, "Adding category " + category.categoryName);
                var params = {
                    categoryId: uuid.v4(), // Generate the categoryId
                    categoryName: category.categoryName
                };

                sc.CreateCategory(req, addCategoryCallback, params);
            } else {
                updateOrCreateProducts();
            }
        } else {
            // FINISH
            var result = {
                "result": true,
                "message": "common.labels.changes_saved",
                "categoryIds" : categoryIds,
                "productIds": productIds,
                "oldProducts": oldProducts
            };

            res.send(200, result);

            // Log response.
            log.infoEntry(req, arguments.callee.name, "Done adding categories");
            log.infoResponse(arguments.callee.name, res, result);
        }

        function updateOrCreateProducts() {
            var categoryId = category.categoryId;
            var products = category.productsArray;

            // Determine Products to be added and which one to be updated
            var productsToBeAdded = [];
            var productsToBeUpdated = [];
            for (var i = 0; i < products.length; i++) {
                if (products[i].id == "") {
                    productsToBeAdded.push(products[i]);
                } else {
                    productsToBeUpdated.push(products[i]);
                }
            }

            // trigger update sequence
            log.infoEntry(req, arguments.callee.name, "Trigger updating products for existing category " + categoryId);
            updateProductPerCategory(categoryId);

            function updateProductPerCategory(categoryId) {
                var product = productsToBeUpdated.shift();

                if (product) {
                    // Get the current status of the product.
                    var oldProduct = oldProducts[product.id];

                    // Transform the fileds into an Object name:value
                    var arrayOfFields = [];
                    for(propName in product) {
                        if (propName != "id") {
                            var object = {};
                            object[propName] = product[propName];
                            arrayOfFields.push(object);
                        }
                    }

                    updateProductFields();
                    function updateProductFields() {
                        var param = arrayOfFields.shift();

                        if (!param) {
                            // Update next product
                            updateProductPerCategory(categoryId);
                        } else {
                            // Get name
                            var productFieldName = Object.keys(param)[0];
                            // Get value
                            var productFieldValue = param[Object.keys(param)[0]];

                            // WARNING: Checking for undefined may cause problems in the future. Look if priceCurrency can be always set with 0 length string.
                            // Check if the value is not undefined. This is fix for priceCurrency.
                            if (typeof oldProduct[productFieldName] === "undefined" || (S(oldProduct[productFieldName]).trim().s === S(productFieldValue).trim().s)) {
                                // Field unchanged skip
                                updateProductFields();
                            } else {
                                // Update field
                                var params = {
                                    productId: product.id,
                                    fieldName: productFieldName,
                                    fieldValue: productFieldValue
                                };

                                sc.UpdateProductField(req, callback, params);
                            }
                        }

                        function callback(scResponse) {

                            if (scResponse) {
                                if (scResponse.success) {
                                    // Update oldProducts with new info of the product
                                    oldProducts[product.id] = product;

                                    // Update next field
                                    updateProductFields();
                                }
                            } else {
                                var result = {
                                    "result": false,
                                    "message": "common.labels.changes_failure",
                                    "categoryIds" : categoryIds,
                                    "productIds": productIds,
                                    "oldProducts": oldProducts
                                };
                                res.send(200, result);
                                // Log response.
                                log.infoEntry(req, arguments.callee.name, "Could not update product field");
                                log.infoResponse(arguments.callee.name, res, result);
                            }
                        }
                    }
                } else {
                    // Trigger new products to be added
                    log.infoEntry(req, arguments.callee.name, "Finished updating products for existing category " + categoryId);
                    log.infoEntry(req, arguments.callee.name, "Trigger adding products for existing category " + categoryId);
                    addProductPerCategory(productsToBeAdded, categoryId);
                }
            }
        }

        function addCategoryCallback(scResponse) {

            if (scResponse && scResponse.success) {
                var createdCategory = helpers.parseResult(scResponse, "cat");
                var categoryId = createdCategory[0].categoryId;

                log.infoEntry(req, arguments.callee.name, "Added category with id: " + category.categoryName);

                // Remember added category id
                categoryIds.push({
                    categoryId: categoryId,
                    categoryName: category.categoryName
                });

                // Trigger product adding
                var products = category.productsArray;
                addProductPerCategory(products, categoryId);
            } else {
                var result = {
                    "result": false,
                    "message": "common.labels.changes_failure",
                    "categoryIds" : categoryIds,
                    "productIds": productIds,
                    "oldProducts": oldProducts
                };

                res.send(200, result);

                // Log response.
                log.infoEntry(req, arguments.callee.name, "Could not add category " + category.categoryName);
                log.infoResponse(arguments.callee.name, res, result);
            }
        }

        function addProductPerCategory(products, categoryId) {
            var product = products.shift();

            if (product) {

                log.infoEntry(req, arguments.callee.name, "Adding product "  + product.productName + " to category with id " + categoryId);

                // Tie to category.
                product.categoryId = categoryId;
                // Generate id for product
                product.productId = uuid.v4();

                // Set id equal to productId.
                product.id = product.productId;

                // DELETE id to avoid any conflicts
                //delete product.id;

                sc.CreateProduct(req, addProductCallback, product);

            } else {
                // FINISH
                log.infoEntry(req, arguments.callee.name, "Done adding products for category with id:" + categoryId);
                // Add rest of categories.
                addCategoryAndProducts(categoriesAndProducts);
            }

            function addProductCallback(scResponse) {

                if (scResponse && scResponse.success) {
                    // Update oldProducts with new product
                    oldProducts[product.productId] = product;

                    // Continue adding products
                    productIds.push({
                        categoryId: product.categoryId,
                        productId: product.productId,
                        productName: product.productName
                    });
                    addProductPerCategory(products, categoryId)
                } else {
                    var result = {
                        "result": false,
                        "message": "common.labels.changes_failure",
                        "categoryIds" : categoryIds,
                        "productIds": productIds,
                        "oldProducts": oldProducts
                    };

                    res.send(200, result);

                    //Log response.
                    log.infoEntry(req, arguments.callee.name, "Could not add product " + product.productName);
                    log.infoResponse(arguments.callee.name, res, result);
                }
            }
        }
    }
}

/**
 * @function orders: Displays Order page.
 * @param req
 * @param res
 */
function orders(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    var error;
    var ordersList = [];
    var products = {};

    sc.GetOrders(req, callback);

    function callback(scResponse) {

        if (scResponse) {
            // TODO Filter by order status
            ordersList = helpers.parseResult(scResponse, "order", ["client", "products", "quantities"]);

            // Check if we have orders.
            var numOrders = ordersList.length;
            if (numOrders > 0) {
                // Need to set productId, NOT just id
                for (var i = 0; i < numOrders; i++) {
                    var total = 0;
                    for(var j = 0; j < ordersList[i].products.length; j++){
                        ordersList[i].products[j].productId = ordersList[i].products[j].id;
                        ordersList[i].products[j].quantity = ordersList[i].quantities[j];
                        total += ordersList[i].products[j].productPrice * ordersList[i].products[j].quantity;
                    }

                    // Transform latLng
                    ordersList[i].latLng = JSON.parse(ordersList[i].latLng);

                    // Set total price.
                    ordersList[i].total = total;
                    // Set received date.
                    var dateObject = new Date(ordersList[i].timestamp * 1000);
                    ordersList[i].date = dateObject.getDate() + '/' + dateObject.getMonth() + '/' + dateObject.getFullYear() + ' ' + dateObject.getHours() + ':' +  (dateObject.getMinutes()<10?'0':'') + dateObject.getMinutes() + ':' + (dateObject.getSeconds()<10?'0':'') + dateObject.getSeconds();
                }
                getProducts();
            } else {
                // Show page with this message.
                error = "ordersPage.message.no_orders";
                displayPage ();
            }
        } else {
            // Show page with this message.
            log.warnEntry(req, arguments.callee.name, "Could not get orders");
            error = "common.labels.persistence_error";
            displayPage ();
        }
    }

    function getProducts () {

        sc.GetProducts(req, callback);

        function callback (scResponse) {

            if (scResponse) {
                var allArrayProducts =  helpers.parseResult(scResponse, "prod");

                allArrayProducts.forEach(function (product) {

                    products[product.id] = product;
                });

                // Display page.
                displayPage ();
            } else {
                // Show page with this message.
                log.warnEntry(req, arguments.callee.name, "Could not get products");
                error = "common.labels.persistence_error";
                displayPage ();
            }
        }
    }

    function displayPage () {
        helpers.displayPage(req, res, 'orders/index.html.twig', {
            error: error,
            allProducts: products,
            orders : ordersList
        });

        //Log response.This is just to see that page is rendered.
        log.infoResponse(arguments.callee.name, res);
    }
}

/**
 * @function stats: Displays Stats page
 * @param req
 * @param res
 */
function stats(req, res) {
    // Show drop-down.
    render_location_template(req, res, 'stats/index.html.twig');
}

function get_stats(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    // Define default views.
    var error;
    var view = {
        numbersOfOrdersServedThisMonth: {},
        numberOfClients: {},
        bestSellingProducts: [],
        bestCustomers: []
    }

    // Send location also.
    var locationId = req.query.locationId;
    // Get all stats.
    sc.GetAllStats(req, getAllStatsCallback, {locationId: locationId});

    function getAllStatsCallback(scResponse) {

        if (scResponse) {
            // Parse result for each Stats category.
            var numbersOfOrdersServedThisMonth = scResponse.numbersOfOrdersServedThisMonth;
            var numberOfClients = scResponse.numberOfClients;
            var bestSellingProducts = scResponse.bestSellingProducts;
            var bestCustomers = scResponse.bestCustomers;

            // Number of orders this month.
            if (numbersOfOrdersServedThisMonth.success) {
                // Get number of orders.
                view.numbersOfOrdersServedThisMonth.value = JSON.parse(numbersOfOrdersServedThisMonth.result)[0]["count(order)"];

                // Check if there is data, otherwise show some message
                if (view.numbersOfOrdersServedThisMonth.value.length == 0) {
                    view.numbersOfOrdersServedThisMonth.error = "statsPage.message.not_enough_info";
                }
            } else {
                view.numbersOfOrdersServedThisMonth.error = "statsPage.message.not_enough_info";
            }

            // Number of clients
            if (numberOfClients.success) {
                view.numberOfClients.value =  JSON.parse(numberOfClients.result)[0]["count(client)"];

                // Check if there is data, otherwise show some message
                if (view.numberOfClients.value.length == 0) {
                    view.numberOfClients.error = "statsPage.message.not_enough_info";
                }
            } else {
                view.numberOfClients.error = "statsPage.message.not_enough_info";
            }

            // Best selling product
            if (bestSellingProducts.success) {
                view.bestSellingProducts =  JSON.parse(bestSellingProducts.result);

                // Check if there is data, otherwise show some message
                if (view.bestSellingProducts.length == 0) {
                    view.bestSellingProducts.error = "statsPage.message.not_enough_info";
                }
            } else {
                view.bestSellingProducts.error = "statsPage.message.not_enough_info";
            }

            // Best customers bestCustomers
            if (bestCustomers.success) {
                // Parse result.
                view.bestCustomers =  JSON.parse(bestCustomers.result);

                // Check if there is data, otherwise show some message
                if (view.bestCustomers.length == 0) {
                    view.bestCustomers.error = "statsPage.message.not_enough_info";
                }
            } else {
                view.bestCustomers.error = "statsPage.message.not_enough_info";
            }
        } else {
            log.warnEntry(req, arguments.callee.name, "Could not retrieve GetAllStats.");
            view.error = "common.labels.persistence_error";
        }

        // Display page.
        displayPage ();
    }

    function displayPage () {
        res.render('stats/stats.html.twig', {
            error: error,
            view: view
        });

        //Log response.This is just to see that page is rendered.
        log.infoResponse(arguments.callee.name, res);
    }
}

/**
 * @function my_account: Displays My Account page when logged user is modifying his own account.
 * @param req
 * @param res
 */
function my_account(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    // Set account to act upon
    req.params.staffEmail = req.session.userId;
    edit_staff(req, res);
}

/**
* @function staff: Displays Accounts page page.
* @param req
* @param res
*/
function staff(req, res) {
    // Show drop-down.
    render_location_template(req, res, 'staff/index.html.twig');
}

/**
 * @function get_staff: Renders Accounts per location via ajax
 * @param req
 * @param res
 */
function get_staff(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    var error = null;

    var staffMembers = new Array();

    // Cache the locationId.
    var locationId = helpers.getLocationId(req);

    // Build params to send to GetStaffMemberForLocation.
    var params = {
        locationId: locationId
    }

    // Always use GetStaffMemberForLocation because we need to map the locationId to the staff.
    sc.GetStaffMemberForLocation(req, callback, params);

    function callback(scResponse) {

        if (scResponse) {

            // Get array of staff members.
            var staff = helpers.parseResult(scResponse, "staff");

            // Removed logged in user
            for (var i=0; i< staff.length; i++) {

                // Do not add logged in user and chainmanager.
                if(req.session.userId != staff[i].email && staff[i].type !== "chainmanager") {
                    // Set locationId
                    staff[i].locationId = locationId;
                    staffMembers.push(staff[i]);
                }
            }
        } else {
            log.warnEntry(req, arguments.callee.name, "Could not get staff members.");
            error = "common.labels.persistence_error";
        }

        helpers.displayPage(req, res, 'staff/staff_list.html.twig', {
            staffMembers: staffMembers,
            error: error
        });

        //Log response.This is just to see that page is rendered.
        log.infoResponse(arguments.callee.name, res);
    }
}

/**
 * @function add_staff: Displays Accounts > Add Staff page and handles POST action as well
 * @param req
 * @param res
 */
function add_staff(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    var error = null;

    var locationOptions = {};

    // Set page layout title
    var layoutTitle = "add_staff";
    var form_action = "/admin/add_staff";


    var add_staff_form = forms.create_new_form('add_staff_form');

    helpers.getRestaurantLocations(req, function (result) {

        // Check if we got an array
        if (Array.isArray(result)) {

            result.forEach(function (entry){
                locationOptions[entry.locationId] = entry.name;
            });

            add_staff_form.fields.locationId.choices = locationOptions;

            add_staff_form.handle(req, {
                success: function (form) {
                    // there is a request and the form is valid
                    // form.data contains the submitted data

                    var data = form.data;
                    // Do not send confirm password field.
                    delete data.passConfirm;

                    // Do not send locationId if it is an empty string.
                    if(data.locationId === "") {
                        delete data.locationId;
                    }

                    // Need to set username otherwise AddStaffMember request will fail
                    data.username = data.email;

                    // Get encrypt lib.
                    var shasum = require('crypto').createHash('sha1');

                    // Encrypt password
                    data.pass = shasum.update(data.pass).digest('base64');

                    sc.AddStaffMember(req, addStaffCallback, data);

                    function addStaffCallback(scResponse) {

                        if (scResponse) {
                            if (scResponse.success) {
                                // Redirect to list
                                res.redirect("/admin/staff");
                            }
                            error = !scResponse.success ? "common.labels.changes_failure" : null;
                        } else {
                            log.warnEntry(req, arguments.callee.name, "Could not add staff member");
                            error = "common.labels.persistence_error"
                        }

                        helpers.displayPage(req, res, 'staff/manage_staff.html.twig', {
                            layoutTitle: layoutTitle,
                            form_action: form_action,
                            error: error,
                            form: form.toHTML(function (name, object) { return forms.my_field(name, object); } )
                        });
                        //Log response.This is just to see that page is rendered.
                        log.infoResponse(arguments.callee.name, res);
                    }
                },
                error: function (form) {
                    // the data in the request didn't validate,
                    // calling form.toHTML() again will render the error messages
                    helpers.displayPage(req, res, 'staff/manage_staff.html.twig',  {
                        layoutTitle: layoutTitle,
                        form_action: form_action,
                        form: form.toHTML(function (name, object) { return forms.my_field(name, object); } )
                    });
                    //Log response.This is just to see that page is rendered.
                    log.infoResponse(arguments.callee.name, res);
                },
                empty: function (form) {
                    // there was no form data in the request
                    helpers.displayPage(req, res, 'staff/manage_staff.html.twig',  {
                        layoutTitle: layoutTitle,
                        form_action: form_action,
                        form: form.toHTML(function (name, object) { return forms.my_field(name, object); } )
                    });
                    //Log response.This is just to see that page is rendered.
                    log.infoResponse(arguments.callee.name, res);
                }
            });
        } else {
            error = result;
            helpers.displayPage(req, res, 'staff/manage_staff.html.twig', {
                form: "",
                error: error
            });

            //Log response.This is just to see that page is rendered.
            log.warnEntry(req, arguments.callee.name, "Could not get location options");
            log.infoResponse(arguments.callee.name, res);
        }
    });
}

/**
 * @function edit_staff: Displays Accounts > Edit Staff page and handles POST action as well
 * @param req
 * @param res
 */
function edit_staff(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);
    // Default params.
    var error;
    var view = {};

    var isAccountPage = req.url == "/admin/my_account";
    var locationOptions = {};

    // Cache location id.
    var locationId = helpers.getLocationId(req);

    // Set page layout title
    // For URL /admin/my_account use "my_account"
    // For URL /admin/edit_staff/ use "edit_staff"
    var layoutTitle = isAccountPage ? "my_account" :"edit_staff";

    // Remember user type and layout Title of page.
    view.loggedInUserType = req.session.type;
    view.layoutTitle = layoutTitle;

    var staffEmail = req.params.staffEmail;

    // For URL /admin/my_account use "/admin/my_account"
    // For URL /admin/edit_staff/encodedUrl use "/admin/edit_staff/encodedEmail"
    var form_action = isAccountPage ? "/admin/my_account" : "/admin/edit_staff/" + encodeURIComponent(staffEmail);

    log.debugEntry(req, arguments.callee.name, "Will be using form action: " + form_action);

    helpers.getRestaurantLocations(req, function (result) {

        // Check if we got an array
        if (Array.isArray(result)) {

            result.forEach(function (entry){
                locationOptions[entry.locationId] = entry.name;
            });

            // If we couldn't determine locationId attempt to find ALL users to allow chain manager to edit his account.
            if (locationId == null) {
                sc.GetStaffMembers(req, callback);
            } else {
                // Build params to send to GetStaffMemberForLocation.
                var params = {
                    locationId: locationId
                }

                // Always use get staff member per location because we need to map the location Id  of the staff which is edited.
                sc.GetStaffMemberForLocation(req, callback, params);
            }

        } else {
            error = result;
            helpers.displayPage(req, res, 'staff/manage_staff.html.twig', {
                form: "",
                error: error
            });

            //Log response.This is just to see that page is rendered.
            log.warnEntry(req, arguments.callee.name, "Could not get location options");
            log.infoResponse(arguments.callee.name, res);
        }
    });

    function callback (scResponse) {

        if (scResponse) {
            // Get array of staff members.
            var staffMembers = helpers.parseResult(scResponse, "staff");
            var currentStaff;

            for (var i=0; i< staffMembers.length; i++) {

                if(staffEmail == staffMembers[i].email) {
                    currentStaff = staffMembers[i];
                    break;
                }
            }

            if (typeof currentStaff == "undefined") {
                // TODO some bad page error maybe?
                log.warnEntry(req, arguments.callee.name, "Currently logged staff not found, redirecting to /admin/staff");
                res.redirect("/admin/staff");
                return;
            }

            // Decide which form to use.
            var my_from = isAccountPage ? forms.create_new_form('my_account_form') : forms.create_new_form('edit_staff_form');

            // Set options for Location.
            my_from.fields.locationId.choices = locationOptions;

            // Keep the type of the user that is being edited.
            view.editedUserType = currentStaff.type == "null" ? "manager" : currentStaff.type;

            my_from.handle(req, {
                success: function (form) {
                    // there is a request and the form is valid
                    // form.data contains the submitted data

                    var data = form.data;
                    // Do not send confirm password field.
                    delete data.passConfirm;

                    // Do not try to update password
                    if (S(data.pass).trim().s.length === 0) {
                        delete data.pass;
                    }

                    var arrayOfFields = new Array();
                    for (var propName in data) {
                        var object = {};
                        object[propName] = data[propName];
                        arrayOfFields.push(object);
                    }

                    updateStaffFields();

                    function updateStaffFields () {
                        var param = arrayOfFields.shift();

                        if (!param) {
                            helpers.displayPage(req, res, 'staff/manage_staff.html.twig', {
                                error: "common.labels.changes_saved",
                                layoutTitle: layoutTitle,
                                form_action: form_action,
                                view: view,
                                form: form.toHTML(function (name, object) { return forms.my_field(name, object); } )
                            });
                        } else {
                            // Get name
                            var fieldName = Object.keys(param)[0];
                            // Get value
                            var fieldValue = param[Object.keys(param)[0]]

                            if (fieldName === "pass") {
                                // Get encrypt lib.
                                var shasum = require('crypto').createHash('sha1');
                                // Encrypt password
                                fieldValue = shasum.update(fieldValue).digest('base64');
                            }

                            var params = {
                                staffId: staffEmail,
                                fieldName: fieldName, // Get name
                                fieldValue: fieldValue // Get value
                            };

                            // Do not send locationId if it is an empty string.
                            if(data.locationId !== "") {
                                params.locationId = data.locationId // specifically add locationId.
                            }

                            sc.EditStaffMember(req, callback, params);
                        }

                        function callback (scResponse) {
                            if (scResponse) {

                                if (Object.keys(param)[0] == "email") {
                                    // Update from action
                                    form_action.replace(staffEmail,param[Object.keys(param)[0]]);

                                    if (req.session.userId == staffEmail) {
                                        req.session.userId =param[Object.keys(param)[0]];
                                    }

                                    // Finally update field which is used as staff ID
                                    staffEmail = param[Object.keys(param)[0]];
                                }

                                if (scResponse.success) {
                                    updateStaffFields();
                                } else {
                                    helpers.displayPage(req, res, 'staff/manage_staff.html.twig', {
                                        error: "common.labels.changes_failure",
                                        layoutTitle: layoutTitle,
                                        form_action: form_action,
                                        form: form.toHTML(function (name, object) { return forms.my_field(name, object); } )
                                    });
                                    //Log response.This is just to see that page is rendered.
                                    log.infoResponse(arguments.callee.name, res);
                                }
                            } else {
                                log.warnEntry(req, arguments.callee.name, "Could not update staff fields");
                                error = "common.labels.persistence_error";
                                helpers.displayPage(req, res, 'staff/manage_staff.html.twig', {
                                    error: error,
                                    layoutTitle: layoutTitle,
                                    form_action: form_action,
                                    view: view,
                                    form: form.toHTML(function (name, object) { return forms.my_field(name, object); } )
                                });
                                //Log response.This is just to see that page is rendered.
                                log.infoResponse(arguments.callee.name, res);
                            }
                        }
                    }
                },
                error: function (form) {
                    // the data in the request didn't validate,
                    // calling form.toHTML() again will render the error messages
                    helpers.displayPage(req, res, 'staff/manage_staff.html.twig', {
                        layoutTitle: layoutTitle,
                        form_action: form_action,
                        view: view,
                        form: form.toHTML(function (name, object) { return forms.my_field(name, object); } )

                    });
                    //Log response.This is just to see that page is rendered.
                    log.infoResponse(arguments.callee.name, res);
                },
                empty: function (form) {
                    // there was no form data in the request
                    if (form.fields.type) {
                        form.fields.type.value = view.editedUserType;
                        form.fields.type.selected = view.editedUserType;
                    }
                    form.fields.email.value =  currentStaff.email;
                    // Set selected the value of the of the staff for locationId.
                    form.fields.locationId.value = locationId;

                    helpers.displayPage(req, res, 'staff/manage_staff.html.twig', {
                        layoutTitle: layoutTitle,
                        form_action: form_action,
                        view: view,
                        form: form.toHTML(function (name, object) { return forms.my_field(name, object); } )
                    });
                    //Log response.This is just to see that page is rendered.
                    log.infoResponse(arguments.callee.name, res);
                }
            });
        } else {
            error = "common.labels.persistence_error";
            helpers.displayPage(req, res, 'staff/manage_staff.html.twig', {
                form: "",
                error: error
            });

            //Log response.This is just to see that page is rendered.
            log.warnEntry(req, arguments.callee.name, "Could not get staff members");
            log.infoResponse(arguments.callee.name, res);
        }
    }
}

/**
 * @function delete_staff: Deletes a staff member, via AJAX
 * @param req
 * @param res
 */
function delete_staff(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    // Create params.
    var params = {
        staffEmail: req.body.staffEmail
    }

    // Add locationId for chainmanagers
    if (req.session.type == "chainmanager") {
        params.locationId = req.body.locationId;
    }

    sc.DeleteStaffMember(req, callback, params);

    function callback(scResponse) {

        if (scResponse) {
            var result = {
                "result": scResponse.success ? scResponse.success : false,
                "message": scResponse.success ? "staffPage.delete_msg" : "common.labels.changes_failure"
            };
        } else {
            log.warnEntry(req, arguments.callee.name, "Could not delete staff.");
            var result = {
                "result": false,
                "message": "common.labels.persistence_error"
            };
        }

        res.send(200, result);

        //Log response
        log.infoResponse(arguments.callee.name, res, result);
    }
}

/**
 * @function alter_order: Alters the status of an order for a restaurant.
 * @param req
 * @param res
 */
function alter_order (req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    var result;
    sc.AlterOrder(req, callback, req.body);

    function callback(scResponse) {

        if (scResponse) {
            var result = {
                "result": scResponse.success ? scResponse.success : false,
                "message": scResponse.success ? "ordersPage.order_update" : "common.labels.changes_failure"
            };
        } else {
            log.warnEntry(req, arguments.callee.name, "Could not alter order.");
            var result = {
                "result": false,
                "message": "common.labels.persistence_error"
            };
        }

        res.send(200, result);

        //Log response
        log.infoResponse(arguments.callee.name, res, result);
    }
}

/**
 * @upload_image Upload an image via ajax
 * @param req
 * @param res
 */
function upload_image(req, res) {

    // Helper to get extenions
    function getExtension(filename) {
        var ext = path.extname(filename||'').split('.');
        return ext[ext.length - 1];
    }

    // Load path lib.
    var path = require('path');

    // Load file system lib.
    var fs = require('fs');

    // Place to store files.
    var uploadDir = "/public/img/menu/";

    // File that is uploaded.
    var fileToUpload = req.files[0];

    // Place where tmp file is
    var tmpPath = fileToUpload.path;
    // Get extenion
    var fileExt = getExtension(tmpPath);

    // The new file name.
    var picId = uuid.v1();
    var newFilename = picId + "." +fileExt;
    var thumb = "thumb_" + picId + "." + fileExt;

    // Where the file is moved.
    var filePath = path.join(__dirname, '..' + uploadDir + newFilename);
    var thumbFilePath = path.join(__dirname, '..' + uploadDir + thumb);

    // Used to show the img in the browser.
    var sitePath = "/img/menu/" + newFilename;
    var thumbPath = "/img/menu/" + thumb;

    // Actuall move.
    var source = fs.createReadStream(tmpPath);
    var dest = fs.createWriteStream(filePath);

    source.pipe(dest);
    source.on('end', function() {
        // NOTE: We need filePath for external APIs and sitePath for displaying in the browser.

        var qt = require('quickthumb');

        qt.convert({
            src: filePath,
            dst: thumbFilePath,
            width: 100,
            height: 100
        }, function (err, path) {

            if (err) {
                res.send(200, {
                    success: false,
                    message: "common.labels.upload_failed"
                });
            } else {
                var result = {
                    success: true,
                    normalPic: sitePath,
                    resizedPic: thumbPath,
                    message: "common.labels.upload_success"
                };

                res.send(200, result);
            }

            //Log response
            log.infoResponse(arguments.callee.name, res, result);
        });

    });
    source.on('error', function(err) {
        var result = {
            success: false,
            message: "common.labels.upload_failed"
        };

        res.send(200, result);
        //Log response
        log.infoResponse(arguments.callee.name, res, result);
    });
}

/**
 * @function registerRoutes: Registers handles for each route.
 * @param httpServer
 */
function registerRoutes(httpServer) {

    var loginHandlers = {
        get: {
            // Restaurant
            "/admin/manage_locations": manage_locations,
            "/admin/add_location": add_location,
            "/admin/location": location,
            "/admin/get_location": get_location,
            "/admin/opening_hours": opening_hours,
            "/admin/delivery": delivery,
            "/admin/get_delivery_area": get_delivery_area,
            "/admin/delivery_fees": delivery_fees,
            "/admin/get_delivery_fees": get_delivery_fees,
            "/admin/menu": menu,
            // Clients
            "/admin/clients": clients,
            // Orders
            "/admin/orders": orders,
            // Stats
            "/admin/stats": stats,
            "/admin/get_stats": get_stats,
            // Accounts
            "/admin/my_account": my_account,
            "/admin/add_staff": add_staff,
            "/admin/edit_staff/:staffEmail/location/:locationId": edit_staff,
            "/admin/staff": staff,
            "/admin/get_staff": get_staff
        },
        "post": {
            // Restaurant
            "/admin/add_location": add_location, // Add location form submit
            "/admin/delete_location": delete_location,
            "/admin/save_location": save_location,
            "/admin/save_delivery": save_delivery,
            "/admin/save_delivery_fees": save_delivery_fees,
            "/admin/save_opening_hours": save_opening_hours,
            "/admin/update_menu": update_menu,
            "/admin/delete_product": delete_product,
            "/admin/delete_category": delete_category,
            "/admin/upload_image": upload_image,
            // Clients
            "/admin/push_notifications": push_notifications,
            // Accounts
            "/admin/my_account": my_account,
            "/admin/add_staff": add_staff,
            "/admin/edit_staff/:staffEmail": edit_staff,
            "/admin/delete_staff": delete_staff,
            // Orders
            "/admin/alter_order": alter_order
        }
    }

    routeReqister.registerRoutes(httpServer, loginHandlers, routeReqister.pageTypes.restaurant);
}

module.exports = {
    registerRoutes: registerRoutes
}