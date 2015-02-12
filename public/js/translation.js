$(document).ready(function () {

    var supportedLanguages = new Array("en", "ro");

    var language_complete = getCookie("i18next").split("-");
    var language = (language_complete[0]);

    if (language == "dev" || supportedLanguages.indexOf(language) == -1) {
        language = "en";
    }

    i18n.init({
        // As deep as the path goes as many as "../" you have to put!!
        resGetPath: "../../../../locales/translation.__lng__.json",
        lng: language,
        debug: false // Set this to false on production
    }, updateContent);

    function updateContent() {
        // save to use translation function as resources are fetched
        // Translate top right sections 
        $("#topRightBar").i18n();
        // Translate Menu
        $(".mainnav").i18n();

        // Pagination
        if ($(".pagination").length > 0) {
            $(".pagination").i18n();
        }

        // Users page
        if ($("#userPage").length > 0) {
            $("#userPage").i18n();
        }

        // Menu page 
        if ($("#menuPage").length > 0) {
            $("#menuPage").i18n();
        }

        // Reservations page.
        if ($("#reservationPage").length > 0) {
            $("#reservationPage").i18n();
        }

        // Commands page
        if ($("#ordersPage").length > 0) {
            $("#ordersPage").i18n();
        }

        // Stats page
        if ($("#statsPage").length > 0) {
            $("#statsPage").i18n();
        }

        // Manage locations
        if ($("#manageLocationsPage").length > 0) {
            $("#manageLocationsPage").i18n();
        }

        // Add Location
        if ($("#addLocationPage").length > 0) {
            $("#addLocationPage").i18n();
        }

        // Map page
        if ($("#mapPage").length > 0) {
            $("#mapPage").i18n();
        }

        // Delivery page
        if ($("#deliveryPage").length > 0) {
            $("#deliveryPage").i18n();
        }

        // Delivery Fees page
        if ($("#deliveryFeePage").length > 0) {
            $("#deliveryFeePage").i18n();
        }

        // Staff page
        if ($("#staffPage").length > 0) {
            $("#staffPage").i18n();
        }

        // Opening Hours Page
        if ($("#openingHoursPage").length > 0) {
            $("#openingHoursPage").i18n();
        }

        // Login Page
        if ($("#loginPage").length > 0) {
            $("#loginPage").i18n();
        }

        // My Account Page
        if ($("#myAccountPage").length > 0) {
            $("#myAccountPage").i18n();
        }

        // Superadmin
        // Add Restaurant
        if ($("#addRestaurantPage").length > 0) {
            $("#addRestaurantPage").i18n();
        }

        // Superadmin
        // Restaurants
        if ($("#restaurantsPage").length > 0) {
            $("#restaurantsPage").i18n();
        }

        // 404 page
        if ($("#errorPage").length > 0) {
            $("#errorPage").i18n();
        }

    }

    // Set to ro language
    $("#imgRoSelect").click(function () {
        // Delete cookie
        deleteCookie("i18next");
        // Create again, expires in 7 days.
        setCookie("i18next", "ro", 7);

        i18n.setLng("ro", updateContent);
    });

    // Set to en language
    $("#imgEnSelect").click(function () {
        // Delete cookie
        deleteCookie("i18next");
        // Create again, expires in 7 days.
        setCookie("i18next", "en", 7);

        i18n.setLng("en", updateContent);
    });

    function setCookie(cname, cvalue, exdays) {
        var d = new Date();
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        var expires = "expires=" + d.toGMTString();
        document.cookie = cname + "=" + cvalue + "; " + expires;
    }

    function getCookie(cname) {
        var name = cname + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = $.trim(ca[i]);
            if (c.indexOf(name) == 0)
                return c.substring(name.length, c.length);
        }
        return "";
    }

    function deleteCookie(name) {
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }

});

