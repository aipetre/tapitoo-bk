/**
 * Created by root on 4/19/14.
 */
// the logger singleton
var logger = null;

// fileAppender: shouldn't have to cache this
var fileAppender = null;

// To prettyfy body.
var pd = require('pretty-data').pd;

/**
 * @function prettyPrintBody: helper function to print a body
 * @param body
 */
function prettyPrintBody(body) {
    var result = typeof body == 'object' && Object.keys(body).length ? pd.json(body) : typeof body == 'string' && body.length ? pd.xml(body) : '';
    return result;
}

// Initialize the logger, use a typical location for the file
function configure() {

    if (logger != null) {
        return logger;
    }

    // init the basics
    // FIXME: need to replace with a log package that allows rotation to rename to the date instead of appending a number
    var logDir = '/logs', maxFileSize = '10000000', maxBackups = 3, consoleReportLevel = 'FATAL';

    // Set logging level.
    // On production this should be at a minimum a WARN or a INFO (logs more stuff).
    // On development this should be DEBUG
    var fileReportLevel = 'WARN';

    // Get the logger based on the lokiConfig
    logger = require('log4js');

    // Load path lib.
    var path = require('path');

    // Normalize filename. Must do this for ALL config-stored filenames.
    var logFilePath = path.join(__dirname, "../" + logDir + "/log.txt");

    // Configure the logger by adding the appenders
    logger.configure({
        appenders: [
            {
                type: "logLevelFilter", // This is a recursive appender,
                // filters log messages and
                // sends them to its own appender.

                level: consoleReportLevel, // Only certain logs are written to console. We may make this configurable later

                appender: { // the filter's appender, console
                    type: 'console',
                    category: 'all'
                }
            }
        ],
        replaceConsole: true
    });

    // Need to explicitly create the file appender, since creating once and using using 'all' doesn't seem to work
    // Need to cache fileAppender for future use, to work around issue with 'all' for appenders.
    logger.loadAppender('file');
    fileAppender = logger.appenders.file(logFilePath, null, maxFileSize, maxBackups);

    // Explicitly add the console. Do not do this in configure. We need to have a handle to the file appender for future categories writing to the same file
    logger.addAppender(fileAppender, 'console');

    // Set the global log level. NOTE: this will override the log level filter above.
    logger.setGlobalLogLevel(fileReportLevel);

    // Return singleton as result. currently not used.
    return logger;
}

// Get Log4js logger. Only one channel now. get the lokiConfig for the logger
function getLogger(category) {


    // Default log category
    category = typeof category == 'string' ? 'tapitoo:' + category : 'tapitoo';

    // Add a few useful methods to the prototype.
    // FIXME: should createTranslation a real class for this instead of adding it here in the factory
    var loggerInstance = logger.getLogger(category);

    // Need to explicitly set the file appender for this category since 'all' doesn't seem to work
    // Do this AFTER creating the logger instance.
    logger.addAppender(fileAppender, category);

    /**
     * @function getReqMethodHostPortURL Helper method to create logging information.
     * @param req
     * @returns {*}
     */
    function ReqMethodHostPortURL(req) {

        // Sometimes responses use _headers
        var headers = req.headers || req._headers;
        var requestHost = headers ? headers.host : '127.0.0.1';
        var url = req.url || req.path || '/'
        var result = req.method + ' ' + requestHost + url;
        return result;
    }

    /**
     * @function logEntry: convenience method for simple log entries
     * @param logLevel
     * @param req Note: This must always be set. Should at least contain session otherwise it will blow..
     * @param functionName
     * @param text Message
     */
    logEntry = function (logLevel, req, functionName, text) {
        var text = text ? prettyPrintBody(text) : '';

        // There should be a userId, restaurantId and locationId for all requests
        var type =  req.session.type || "";
        var userId =  req.session.userId || '';
        // Construct full user id containgin also type.
        var fullUserId = userId + ":" +type;
        var restaurantId = req.session.restaurantId || "";
        var locationId = req.session.locationId || "";

        logTransaction.call(this, logLevel, fullUserId, restaurantId, locationId,  functionName, "\nEntry: " + text);
    }

    /**
     * @function logTransaction: Simple logger for formatting logs for user
     * @param logLevel Level to log at
     * @param fullUserId
     * @param restaurantId
     * @param locationId
     * @param functionName function name
     * @param other args. optional
     */
    logTransaction = function (logLevel, fullUserId, restaurantId, locationId, functionName) {

        // Get the loglevel. Should always be set
        var logLevel = logLevel || 'debug';

        // There should be a fullUserId
        var prefix = fullUserId ? fullUserId : '';

        // There should be a restaurantId
        prefix+= restaurantId ? ':' + restaurantId : '';

        // There should be a locationId
        prefix+= locationId ? ':' + locationId : '';

        // There may be a function name
        prefix += functionName ? ':' + functionName : '';

        // set the rest of the arguments to pass down
        var args = null;
        if (arguments.length > 5) {
            arguments[4] = prefix;
            args = Array.prototype.slice.call(arguments, 4);
        }
        else {
            args = [prefix];
        }

        // Call the appropriate logger
        this[logLevel].apply(this, args);
    }

    /**
     * @function logRequest: Helper function to log requests
     * @param req
     */
    logRequest = function (logLevel, functionName, req) {
        var body = req.body ? "\n" + prettyPrintBody(req.body) : '';

        // Output message
        var reqMethodHostPortURL = ReqMethodHostPortURL(req);

        // There should be a userId, restaurantId and locationId for all requests
        var type =  req.session.type || "";
        var userId =  req.session.userId || '';
        // Construct full user id containgin also type.
        var fullUserId = userId + ":" +type;
        var restaurantId = req.session.restaurantId || "";
        var locationId = req.session.locationId || "";

        logTransaction.call(this, logLevel, fullUserId, restaurantId, locationId,  functionName, "Request " + reqMethodHostPortURL + body);
    }

    /**
     * @function logPersistenceRequest: Helper function to log Persistence request.
     * @param req
     */
    logPersistenceRequest = function (logLevel, url, req) {

        if (req != null) {
            // There should be a userId, restaurantId and locationId for all requests
            var type =  req.session.type || "";
            var userId =  req.session.userId || '';
            // Construct full user id containgin also type.
            var fullUserId = userId + ":" +type;
            var restaurantId = req.session.restaurantId || "";
            var locationId = req.session.locationId || "";
        }

        logTransaction.call(this, logLevel, fullUserId, restaurantId, locationId, "Request " + url);
    }

    /**
     * @function logResponse: Helper function to log responses
     * @param response A response object containing statusCode request, path, body
     * @param responseBody A raw xml or jSON object. NOTE: the response's body is preferred over this if response.body or response._body set
     */
    logResponse = function (logLevel, functionName, response, responseBody) {
        var theMessage = '';

        // Get the loglevel.
        logLevel = logLevel || 'debug';

        // Allow proper pretty printing of response
        if (typeof response == 'object' && typeof response.req == 'object') {
            var reqMethodHostPortURL = ReqMethodHostPortURL(response.req);

            // We should have req in the response.
            var req = response.req;

            // There should be a userId, restaurantId and locationId for all requests
            var type =  req.session.type || "";
            var userId =  req.session.userId || '';
            // Construct full user id containgin also type.
            var fullUserId = userId + ":" +type;
            var restaurantId = req.session.restaurantId || "";
            var locationId = req.session.locationId || "";
            var statusCode = response.statusCode || '';
            theMessage = "Response " + statusCode + " " + reqMethodHostPortURL;
        }

        // raw or encoded message of present response
        if (typeof responseBody == 'string') {
            theMessage += "\nraw body\n" + responseBody;
        }

        // Encoded result. May never use this!
        else if (responseBody != null && typeof responseBody == 'object' && Object.keys(responseBody).length) {
            var prettyResponse = prettyPrintBody(responseBody);
            theMessage += "\nformatted body\n" + prettyResponse;
        }

        // Log the message
        logTransaction.call(this, logLevel, fullUserId, restaurantId, locationId, functionName, theMessage);
    }

    /**
     * @function logPersistenceResponse: Helper function to log Persistence responses.
     */
    logPersistenceResponse = function (logLevel, url, req ,response) {
        var theMessage = '';

        // Get the loglevel.
        logLevel = logLevel || 'debug';

        // Check if req is not null and get needed variables.
        if (req != null) {
            // There should be a userId, restaurantId and locationId for all requests
            var type =  req.session.type || "";
            var userId =  req.session.userId || '';
            // Construct full user id containgin also type.
            var fullUserId = userId + ":" +type;
            var restaurantId = req.session.restaurantId || "";
            var locationId = req.session.locationId || "";
        }

        theMessage = "Response is:";

        // raw or encoded message of present response
        if (typeof response == 'string') {
            theMessage += "\nraw body\n" + response;
        }

        // Encoded result. May never use this!
        else if (response != null && typeof response == 'object' && Object.keys(response).length) {
            var prettyResponse = prettyPrintBody(response);
            theMessage += "\nformatted body\n" + prettyResponse;
        }

        // Log the message
        logTransaction.call(this, logLevel, fullUserId, restaurantId, locationId, url, theMessage);
    }

    // Explicitly modify the prototype for the logger to behave like a bunyun logger, for use in Restify.
    var loggerInstancePrototype = Object.getPrototypeOf(loggerInstance);
    ['Trace', 'Debug', 'Info', 'Warn', 'Error', 'Fatal'].forEach(
        function (levelString) {

            // Need to get the level object, for transformation of the log level to an object.
            var curLevelObject = logger.levels.toLevel(levelString);

            // Overwrite existing behavior for the sake of bunyun compatibility
            var lowercaseLevelString = levelString.toLowerCase();

            // Add a convenient method for logging responses
            // NOTE: not added to prototype
            var customLoggers = {
                Request: logRequest,
                PersistenceRequest: logPersistenceRequest,
                Entry: logEntry,
                Response: logResponse,
                PersistenceResponse: logPersistenceResponse,
                Transaction: logTransaction
            };
            for (i in customLoggers) {
                loggerInstancePrototype[lowercaseLevelString + i] =
                    (function (loggerId) {
                        return function () {
                            var args = Array.prototype.slice.call(arguments);
                            args.unshift(lowercaseLevelString);
                            customLoggers[loggerId].apply(this, args);
                        }
                    })(i);
            }

            // Overload the prototype definition of the log function
            loggerInstancePrototype[lowercaseLevelString] = function () {
                var isLevelEnabled = this.isLevelEnabled(curLevelObject);

                // Just return if level is enabled if there are no arguments
                if (!arguments.length) {
                    return isLevelEnabled;
                }

                // Perform normal logging
                if (isLevelEnabled) {
                    var args = Array.prototype.slice.call(arguments);
                    args.unshift(curLevelObject);

                    // Not sure why getting prototype is so hard.
                    var thisPrototype = Object.getPrototypeOf(this);
                    thisPrototype.log.apply(this, args);
                }
            };
        }
    );

    return loggerInstance;
}

function getBogusLogger () {

    var logger = {};

    var arrayMap = {
        info : "info",
        debug : "debug",
        warn: "warn",
        debugRequest: "debugRequest",
        infoRequest: "infoRequest",
        debugResponse: "debugResponse",
        infoResponse: "infoResponse",
        infoPersistenceRequest: "infoPersistenceRequest",
        infoPersistenceResponse: "infoPersistenceResponse",
        warnPersistenceResponse: "warnPersistenceResponse",
        traceEntry: "traceEntry",
        infoEntry: "infoEntry",
        debugEntry: "debugEntry",
        warnEntry: "warnEntry"
    }

    for (var requestMethod in arrayMap) {
        // Add method
        logger[requestMethod] = function () {};
    }

    return logger;

}

// Exports
module.exports = {
    //get: getBogusLogger, // This is a bogus logger
    get: getLogger, // This is the correct logger
    getLogger: getLogger
};

//Note: Un comment below to enable logger.
// Configure!
configure();
