/**
 * Created by root on 3/14/14.
 */

// Library to register route handlers.
var routeReqister = require("../lib/routeRegister");

// Generate ids
var uuid = require('node-uuid');

// Get logger for this module
var log = require('../lib/log').get("helperRoute");

// Helper methods
var helpers = require("../lib/helpers");

// Used to add a new order to table with id="paginationTable" in Orders page
function append_order(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    res.render('order.html.twig', {
        index: req.body.index,
        details: req.body.details,
        allProducts: req.body.allProducts
    });

    // Log response. This is just to see that item was displayed.
    log.infoResponse(arguments.callee.name, res);
}

/**
 * @function canStaffDeleteCategoryAndProduct Decides what flag to set for deletion. Location managers cannot delete category and products
 * @param req Incomming request
 * @returns {} Object containing 'canDelete' and 'canAdd' properties
 */
function canStaffDeleteCategoryAndProduct(req) {
    var properties = {
        canDelete: true,
        canAdd: true
    };
    var canDelete = true;
    var canAdd = true;

    if (req.session.type == "manager" && req.session.isChain == "true") {
        properties = {
            canDelete: false,
            canAdd: false
        };
    }

    return properties;
}

// Used to append a category on Menu Page
function append_category(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    var properties = canStaffDeleteCategoryAndProduct(req);

    res.render('category.html.twig', {
        categoryIndex:  uuid.v4(),
        categoryDetails: req.body.categoryDetails,
        canDelete: properties.canDelete,
        canAdd: properties.canAdd
    });

    // Log response. This is just to see that item was displayed.
    log.infoResponse(arguments.callee.name, res);
}

// Used to append a category on Menu Page
function append_product(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    var properties = canStaffDeleteCategoryAndProduct(req);

    res.render('product.html.twig', {
        product: req.body.product,
        canDelete: properties.canDelete
    });

    // Log response. This is just to see that item was displayed.
    log.infoResponse(arguments.callee.name, res);
}

// Used to redraw the clients table after filtering
function clients(req, res) {
    // Log incoming request.
    log.infoRequest(arguments.callee.name, req);

    var locations = [];

    // Get location display name
    if (req.session.type == "chainmanager") {
        // Get all locations because we are displaying clients from all locations
        helpers.getRestaurantLocations(req, locationsRetrieve);
    } else {
        locations[req.session.locationId] = req.session.locationDisplayName;
        render_template();
    }

    /**
     * @function locationsRetrieve Callback for retrieving locations
     * @param response Array of locations or string with error
     */
    function locationsRetrieve(response) {
        // Check result
        if (Array.isArray(response)) {
            response.forEach(function (location) {
                locations[location.locationId] = location.name;
            });
        } else {
            // Nothing for locations
        }

        render_template();
    }

    function render_template() {
        res.render('clients/clients.html.twig', {
            users: req.body.clients,
            locations: locations
        });

        // Log response. This is just to see that item was displayed.
        log.infoResponse(arguments.callee.name, res);
    }
}

/**
 * @function registerRoutes: Registers handles for each route.
 * @param httpServer
 */
function registerRoutes(httpServer) {

    var loginHandlers = {
        "post": {
            // Restaurant
            "/helper/append_order": append_order,
            // Menu Category
            "/helper/append_category": append_category,
            // Menu Product
            "/helper/append_product": append_product,
            // Re create clients table
            "/helper/clients": clients
        }
    }

    routeReqister.registerRoutes(httpServer, loginHandlers, true);
}

module.exports = {
    registerRoutes: registerRoutes
}
