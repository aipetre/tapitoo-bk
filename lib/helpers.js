/**
 * Created by root on 4/5/14.
 */

// Library to make Persistence calls.
var sc = require("../lib/serverCommunication").ServerCommunication;

/**
 * @function get_global_params: Gets the restaurant and location id and the type of the logged in user
 * @param req
 * @return {} Object containing
 */
function get_global_params (req) {

    return {
        restaurantId: req.session.restaurantId,
        locationId: req.session.locationId,
        displayName: req.session.displayName,
        locationDisplayName: req.session.locationDisplayName,
        isChain: req.session.isChain,
        type: req.session.type
    }
}

/**
 * @function parseResult: Gets the needed information of a particular entity from the result property of Persistence response.
 * @param scResponse Persistence response
 * @param entityName Entity name to look for in result object
 * @returns {Array}
 */
function parseResult (scResponse, entityName, additionalInfo) {

    var result = JSON.parse(scResponse.result);

    var returnArray = [];

    for (var i = 0; i < result.length; i++) {

        var mainEntity = result[i][entityName];
        if (mainEntity) {
            // Check if there is more here
            if (additionalInfo) {
                for(var j = 0 ; j < additionalInfo.length; j++) {
                    var subEntity = result[i][additionalInfo[j]];
                    if (subEntity) {
                        mainEntity[additionalInfo[j]] = subEntity;
                    }
                }
            }
            returnArray.push(mainEntity);
        }
    }

    return returnArray;
}

function displayPage(req, res, template, params) {
    res.render(template, {
        layoutTitle: params.layoutTitle ? params.layoutTitle : null,
        form_action: params.form_action ? params.form_action: null,
        form: params.form ? params.form: null,
        users: params.users ? params.users: null,
        view: params.view ? params.view : null,
        categories :  params.categories ? params.categories: null,
        allProductsArray:  params.allProductsArray ? params.allProductsArray: null,
        oldProducts: params.oldProducts ? params.oldProducts: null,
        orders: params.orders ? params.orders : null,
        allProducts: params.allProducts ? params.allProducts : null,
        staffMembers: params.staffMembers ? params.staffMembers: null,
        restaurants: params.restaurants ? params.restaurants: null,
        error: params.error ? params.error : null,
        globals: get_global_params(req)
    });
}

/**
 * @function getRestaurantLocations: Get locations for an restuarant.
 * @param req Request Object
 * @param cb
 */
function getRestaurantLocations(req, cb) {
    var result = [];

    sc.GetRestaurantLocations(req, callback);

    function callback(scResponse) {
        if(scResponse) {
            var locations = parseResult(scResponse, "location");

            locations.forEach(function (location) {

                // If there is no type then this is via /api/restaurants/
                if (typeof req.session.type === "undefined" || (req.session.type && req.session.type === "chainmanager")) {
                    result.push({
                        name: location.displayName,
                        locationId: location.id
                    });
                } else {
                    // Only add the location of the manager of that location.
                    if (location.id === req.session.locationId) {
                        result.push({
                            name: location.displayName,
                            locationId: location.id
                        });
                    }
                }
            });
            cb(result);
        } else {
            result = null;
            cb(result);
        }
    }
}

/**
 * @function renderRestaurantLocations: Retrieves location options and renders template.
 * @param req Request Object.
 * @param res Response Object.
 * @param template String with template to renter
 * @returns true
 */
function renderRestaurantLocations (req, res, template) {
    // Set default view values
    var view = {
        locations: []
    }
    var error = null;

    getRestaurantLocations(req, locationsRetrieve);

    function locationsRetrieve(result) {

        if (Array.isArray(result)) {
            view.locations = result;
        } else {
            error = result;
        }

        displayPage(req, res, template, {
            view: view,
            error: error
        });

        return true;
    }
}

/**
 * @function getLocationId Get location id to use
 * @param req Incomming request
 * @returns {*}
 */
function getLocationId(req) {
    var locationId;

    if (req.query.locationId) {
        // Get from query parameter.
        locationId = req.query.locationId;
    } else if (req.params.locationId) {
        // Get from url
        locationId = req.params.locationId;
    } else if (req.body.locationId) {
        // Get from post
        locationId = req.body.locationId;
    } else {
        // Get from session. For single restaurant managers and location managers.
        locationId = req.session.locationId;
    }
    return locationId;
}

module.exports = {
    parseResult: parseResult,
    displayPage: displayPage,
    getRestaurantLocations: getRestaurantLocations,
    renderRestaurantLocations: renderRestaurantLocations,
    getLocationId: getLocationId
}