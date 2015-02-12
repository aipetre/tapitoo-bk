// Maybe set different locations.
var siberia = new google.maps.LatLng(60, 105);
var newyork = new google.maps.LatLng(40.69847032728747, -73.9514422416687);
var browserSupportFlag =  new Boolean();
var initialLocation, geocoder, map, marker, infowindow = null;
var messageDiv = null;
var ajaxDiv = null;

$(document).ready(function () {
    // reset marker and infowindow.
    marker = null;
    infowindow = null;

    var idString = "locationForm";
    messageDiv = $("#messages" + idString);
    ajaxDiv = $("#ajaxLoader" + idString);

    // Initialize map method
    function initialize() {
        // Reset global map values.

        geocoder = new google.maps.Geocoder();
        var mapOptions = {
            zoom: 10,
            mapTypeControl: false,
            streetViewControl: false,
            zoomControlOptions: {
                style: google.maps.ZoomControlStyle.SMALL
            }
        };
        // Create map
        map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);

        // Get values.
        var latitude = $("#locationLat").val();
        var longitude = $("#locationLng").val();

        if (latitude != "" && longitude != "") {
            // Set inital location to the saved one.
            initialLocation = new google.maps.LatLng(latitude, longitude);
            // Set map location
            map.setCenter(initialLocation);
            // Add also marker.
            addMarker();
            // Display proper buttons
            $("#addLocation").css("display", "none");
            $("#saveLocation").css("display", "inline");

        } else {
            // Display proper buttons
            $("#addLocation").css("display", "inline");
            $("#saveLocation").css("display", "none");
            // Try W3C Geolocation (Preferred)
            if(navigator.geolocation) {

                browserSupportFlag = true;
                navigator.geolocation.getCurrentPosition(function(position) {
                    initialLocation = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
                    map.setCenter(initialLocation);
                }, function() {
                    handleNoGeolocation(browserSupportFlag);
                });
            }
            // Browser doesn't support Geolocation
            else {
                browserSupportFlag = false;
                handleNoGeolocation(browserSupportFlag);
            }
        }

        function handleNoGeolocation(errorFlag) {
            if (errorFlag == true) {
                console.log("Geolocation service failed.");
                initialLocation = newyork;
            } else {
                console.log("Your browser doesn't support geolocation. We've placed you in Siberia.");
                initialLocation = siberia;
            }
            map.setCenter(initialLocation);
        }
    }

    // Initialize map.
    initialize();
});

function updateLocationFromText() {
    // Hide message div
    messageDiv.hide();

    // Get address value,
    var newAddress = $('input[name=locationAddress]').val();

    // Remove add location button if it exists and make the save location button visible.
    $("#addLocation") && $("#addLocation").remove();
    $("#saveLocation").css("display", "inline");

    // Attempt to find a location.
    geocoder.geocode( { 'address': newAddress}, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {

            if (results.length) {
                map.setCenter(results[0].geometry.location);
                addMarker();
            } else {
                showMessage (messageDiv, "mapPage.location_fail");
            }
        }
        else{
            showMessage (messageDiv, "mapPage.location_fail");
        }
    });
}

// Add a marker to the map and push to the array.
function addMarker() {
    if (marker == null) {
        marker = new google.maps.Marker({
            position: map.getCenter(),
            draggable:true,
            animation: google.maps.Animation.DROP,
            map: map
        });

        // Set initial location when putting on map.
        updateLocation();

        // Add dragend event listener
        google.maps.event.addListener(marker, 'dragend', updateLocation);

        // Add drag event listener, to hide info window
        google.maps.event.addListener(marker, 'drag', function() {
            infowindow.close();
        });
    } else {
        // update the marker position
        marker.setPosition(map.getCenter());

        // update the location.
        updateLocation();
    }
}

// Updates the hidden inputs
function updateLocation() {

    var LatLng = marker.getPosition();
    var data = {
        latitude: LatLng.lat(),
        longitude : LatLng.lng()
    }

    $("#locationLat").val(data.latitude);
    $("#locationLng").val(data.longitude);

    // Create new info window
    infowindow = infowindow || new google.maps.InfoWindow();

    // Get Street Address
    var latlng = new google.maps.LatLng(data.latitude, data.longitude);
    geocoder.geocode({'latLng': latlng}, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            if (results[0]) {
                infowindow.setContent(results[0].formatted_address);
                $("#address").val(results[0].formatted_address);
                // Only update visible text field when we have just one address
                $('input[name=locationAddress]').val(results[0].formatted_address);
                // Display info window.
                infowindow.open(map,marker);
            }
        } else {
            showMessage (messageDiv, "mapPage.location_fail");
        }
    });
}

// Saves the set location
function saveLocation() {
    var data = {
        locationId: $("#selectLocation").find(":selected").val(), // Get the selected location.
        "latitude": $("#locationLat").val(),
        "longitude" : $("#locationLng").val(),
        "address" : $("#address").val()
    }

    jQuery.ajax({
        type: "POST",
        contentType: "application/json; charset=utf-8",
        url: "/admin/save_location",
        dataType: "json",
        data: JSON.stringify(data),
        beforeSend: function () {
            // Show spinner.
            ajaxDiv.show();
            messageDiv.hide();
        },
        success: function (data) {
            showMessage(messageDiv, data.message);
        },
        complete: function () {
            // Hide spinner.
            ajaxDiv.hide();
        }
    });
}
