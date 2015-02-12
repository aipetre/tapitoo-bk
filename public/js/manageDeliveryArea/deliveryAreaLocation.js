var deliveryRadius, map, marker;


$(document).ready(function () {
    // Reset marker and circle.
    marker = null;
    deliveryRadius = null;

    var radius = $("#deliveryRadius").val();

    // Initialize map method
    function initialize() {

        var mapOptions = {
            zoom: 12,
            mapTypeControl: false,
            streetViewControl: false,
            zoomControlOptions: {
                style: google.maps.ZoomControlStyle.SMALL
            }
        };
        // Create map
        map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);

        if (document.locationLat != "" && document.locationLng != "") {
            // Set inital location to the saved one.
            initialLocation = new google.maps.LatLng(document.locationLat, document.locationLng);
            // Set map location
            map.setCenter(initialLocation);

            // Add also marker.
            marker = new google.maps.Marker({
                position: map.getCenter(),
                map: map
            });

            updateRadius(radius);
        } else {
            // Do nothing
        }
    }

    if (!document.noLocation) {

        // Initialize map.
        initialize();

        /* Min Value Slider */
        $( "#radiusSlider" ).slider({
            range: "min",
            value: radius,
            min: 0,
            max: 16,
            step: 0.1,
            slide: function( event, ui ) {
                $( "#radiusAmount" ).text ( ui.value + " Km" );

                // Update map radius
                updateRadius( ui.value);
            }
        });

        $( "#radiusAmount" ).text ( $( "#radiusSlider" ).slider( "value" ) + " Km" );

    }

});

// Updates map radius
function updateRadius(km) {
    $('#deliveryRadius').val(km);

    var deliveryRadiusOptions = {
        strokeColor: '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#FF0000',
        fillOpacity: 0.35,
        map: map,
        center: marker.getPosition(),
        radius: (km * 1000)
    };
    if(!deliveryRadius){ deliveryRadius =  new google.maps.Circle(deliveryRadiusOptions); }
    else { deliveryRadius.setOptions(deliveryRadiusOptions); }

};

// Saves the set location
function saveDeliveryArea() {
    var idString = "DeliveryAreaForm";
    var messageDiv = $("#messages" + idString);
    var ajaxDiv = $("#ajaxLoader" + idString);

    var data = {
        radius: $('#deliveryRadius').val(),
        locationId: $("#selectLocation").find(":selected").val(), // Get the selected location.
        latitude: document.locationLat,
        longitude: document.locationLng
    };

    jQuery.ajax({
        type: "POST",
        contentType: "application/json; charset=utf-8",
        url: "/admin/save_delivery",
        dataType: "json",
        data: JSON.stringify(data),
        beforeSend: function () {
            // Show spinner.
            ajaxDiv.show();
            messageDiv.hide();
        },
        success: function (data) {
            showMessage(messageDiv, data.message)
        },
        complete: function () {
            // Hide spinner.
            ajaxDiv.hide();
        }
    });
}