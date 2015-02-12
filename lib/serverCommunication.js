/**
 * Created by ipetre on 2/20/14.
 */

// Get logger for this module
var log = require('./log').get("ServerCommunication");

function ServerCommunication() {

    // This is URL to persistence.
    // Change this on deploy tp other servers.
    //this.baseUrl = "http://185.16.40.185:8080/persistance/";
    this.baseUrl = "http://persistance-tapitoo.rhcloud.com/";

    // Define function name and it's URL.
    this.map = {
        // SuperAdmin
        TapitooSetUp: "TapitooSetUp",
        DeleteRestaurant: "DeleteRestaurant",
        GetAllRestaurants: "GetAllRestaurants",
        ChangeRestaurantStatus: "ChangeRestaurantStatus",
        // Restaurant
        // Manage Locations
        AddNewLocationToRestaurant: "AddNewLocationToRestaurant",
        DeleteLocationForRestaurant: "DeleteLocationForRestaurant",
        GetRestaurantLocations: "GetRestaurantLocations",
        // Location
        GetLocation: "GetLocation",
        SetLocation: "SetLocation",
        // Delivery area
        GetDeliveryArea: "GetDeliveryArea",
        SetDeliveryArea: "SetDeliveryArea",
        // Opening Hours
        GetOpeningHours: "GetOpeningHours",
        SetOpeningHours: "SetOpeningHours",
        // Delivery Fees
        GetMinimumDeliveryFee: "GetMinimumDeliveryFee",
        SetMinimumDeliveryFee: "SetMinimumDeliveryFee",
        SetDeliveryFee: "SetDeliveryFee",
        GetDeliveryFee: "GetDeliveryFee",
        // Menu
        CreateCategory: "CreateCategory",
        CreateProduct: "CreateProduct",
        GetProducts: "GetProducts",
        UpdateProductField: "UpdateProductField",
        UpdateCategoryField: "UpdateCategoryField",
        GetMenuForClient: "GetMenuForClient",
        // Accounts
        AddStaffMember: "AddStaffMember",
        GetStaffMembers: "GetStaffMembers",
        DeleteStaffMember: "DeleteStaffMember",
        GetStaffMemberForLocation : "GetStaffMemberForLocation",
        EditStaffMember: "EditStaffMember",
        // Clients
        AddClient: "AddClient",
        GetClients: "GetClients",
        UpdateClient: "UpdateClient",
        // Orders
        CreateOrder: "CreateOrder",
        GetOrders: "GetOrders",
        AlterOrder: "AlterOrder",
        // Login
        AuthStaffMember: "AuthStaffMember",
        // Stats
        GetAllStats: "GetAllStats"
    };

    /**
     * @function callRemote: Actually makes request to Persistence with the given url.
     * @param callback Function to be called to return
     * @param url Url to persistence
     * @param req Incomming Server Response or Object that mimics same data. Used for login purposes, userId, restaurantId, location Id
     */
    function callRemote(callback, url, req) {

        var options = {
            url: url,
            timeout: 60000 // Note: Hardcoded timeout in milliseconds.
        };

        var request = require("request");

        request(options, function(error, response, body) {
            // Check if we have error and log it.
            if (error) {
                log.warnPersistenceResponse(url, req, error);
            }

            // Log the raw response.
            log.infoPersistenceResponse(url, req, body);

            // Note: Need to surround in try catch to avoid application crash!
            try {
                var data = JSON.parse(body);
            }
            catch(e) {
                // Log the exception.
                log.warnPersistenceResponse(url, req, "Exception happended while converting response");
                log.warnPersistenceResponse(url, req, e);
                data = null;
            }

            callback(data);
        });
    }

    // I'm lazy to define 100 methods, dynamically declare
    for (var requestMethod in this.map) {
        var url = this.baseUrl + this.map[requestMethod];
        function addMethod(fullUrl) {
              return function (req, callback, params) {
                var newUrl = null;
                var firstParam = true;

                // Add legacy parameters. Very nasty!
                if (req != null) {
                    var requiredParams = new Array("restaurantId", "locationId");
                    requiredParams.forEach(function (paramName) {
                        // Check if value isn't null
                        if (req.session[paramName] !== null) {
                            // Check if we glue with ? or &
                            if (firstParam) {
                                newUrl = fullUrl + "?" + paramName + "=" + encodeURIComponent(req.session[paramName]);
                                firstParam = false;
                            } else {
                                newUrl += "&" + paramName + "=" + encodeURIComponent(req.session[paramName]);
                            }
                        }
                    });
                    firstParam = false;
                }

                if (params) {
                    for (param in params) {
                        // Check if we glue with ? or &
                        if (firstParam) {
                            newUrl = fullUrl + "?" + param + "=" + encodeURIComponent(params[param]);
                            firstParam = false;
                        } else {
                            newUrl += "&" + param + "=" + encodeURIComponent(params[param]);
                        }
                    }
                } else {
                    newUrl = newUrl ? newUrl : fullUrl;
                }

                // Log the url to be called.
                log.infoPersistenceRequest(newUrl, req);

                // Trigger call
                callRemote(callback, newUrl, req);
            }
        };
        // Add method
        this[requestMethod] = addMethod(url);
    }
};

var sc = new ServerCommunication();

module.exports = {
    ServerCommunication: sc
}