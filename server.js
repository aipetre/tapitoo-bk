#!/bin/env node
//  OpenShift sample Node application
var express = require('express');
var fs      = require('fs');
var http = require('http');
var path = require('path');
var log = require('./lib/log').get("server");


/**
 *  Define the sample application.
 */
var SampleApp = function() {

    //  Scope.
    var self = this;


    /*  ================================================================  */
    /*  Helper functions.                                                 */
    /*  ================================================================  */

    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function() {
        //  Set the environment variables we need.
        self.ipaddress = process.env.OPENSHIFT_NODEJS_IP;
        self.port      = process.env.OPENSHIFT_NODEJS_PORT || 8080;

        if (typeof self.ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            self.ipaddress = "127.0.0.1";
            self.ipaddress = "192.168.0.104";
            log.warn('No OPENSHIFT_NODEJS_IP var, using ' + self.ipaddress);
        };
    };


    /**
     *  Populate the cache.
     */
    self.populateCache = function() {
        if (typeof self.zcache === "undefined") {
            self.zcache = { 'index.html': '' };
        }

        //  Local cache for static content.
        self.zcache['index.html'] = fs.readFileSync('./index.html');
    };


    /**
     *  Retrieve entry (content) from cache.
     *  @param {string} key  Key identifying content to retrieve from cache.
     */
    self.cache_get = function(key) { return self.zcache[key]; };


    /**
     *  terminator === the termination handler
     *  Terminate server on receipt of the specified signal.
     *  @param {string} sig  Signal to terminate on.
     */
    self.terminator = function(sig){
        if (typeof sig === "string") {
           log.info('Received '+ sig +' - terminating sample app ...');
           process.exit(1);
        }
        log.info('Node server stopped.');
    };


    /**
     *  Setup termination handlers (for exit and a list of signals).
     */
    self.setupTerminationHandlers = function(){
        //  Process on exit and signals.
        process.on('exit', function() { self.terminator(); });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
            process.on(element, function() { self.terminator(element); });
        });
    };


    /*  ================================================================  */
    /*  App server functions (main app logic here).                       */
    /*  ================================================================  */

    // Removed self.createRoutes

    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function() {
		
		var app = express();
		// all environments
		app.set('views', path.join(__dirname, 'views'));
		app.set('view engine', 'twig');
        app.set("jsonp callback", true);
        app.use(express.favicon());
		//app.use(express.logger('dev'));
		app.use(express.urlencoded());
		app.use(express.methodOverride());
		app.use(express.cookieParser('t@p1t0014'));
        // Set cookie to expire after 8 hrs
        app.use(express.cookieSession({
            cookie: {
                maxAge:  8 * 60 * 60 * 1000
            }
        }));
        app.use(express.bodyParser());
		app.use(app.router);
		app.use(express.static(path.join(__dirname, 'public')));

        // 404 handling
        app.use(function(req, res, next){
            var is_ajax_request = req.xhr;

            // Check for ajax sunt 404 with body
            if (is_ajax_request) {
                res.send(404, {"error" : "Request Url and method is not defined!"});
            } else {
                // Render 404 page
                res.status(404);
                res.render('error.html.twig')
            }
        });

        self.app = http.createServer(app);
        // Removing websocktes as a transport because Open Shift does not support it.
        var io = require('socket.io').listen(self.app, {log: false, transports: ["htmlfile", "xhr-polling", "jsonp-polling"]});
		
		var routesList = new Array("login", "admin", "superadmin", "helper", "api");
		
		//  Add handlers for the app (from the routes)
		routesList.forEach(function (name) {
			var route = require('./routes/' + name);
			route.registerRoutes(app, io);
		});
    };


    /**
     *  Initializes the sample application.
     */
    self.initialize = function() {
        self.setupVariables();
        self.populateCache();
        self.setupTerminationHandlers();

        // Create the express server and routes.
        self.initializeServer();
    };


    /**
     *  Start the server (starts up the sample application).
     */
    self.start = function() {
        //  Start the app on the specific interface (and port).
        self.app.listen(self.port, self.ipaddress, function() {
            log.info('Node server started on ' + self.ipaddress + ':' + self.port);
        });
    };

};   /*  Sample Application.  */



/**
 *  main():  Main code.
 */
var zapp = new SampleApp();
zapp.initialize();
zapp.start();

