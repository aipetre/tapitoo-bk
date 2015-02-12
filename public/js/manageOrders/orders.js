/**
 * Created by root on 3/30/14.
 */
// Define colors
var colors =  { "new": "#E9DC51", "accepted": "#d6e9c6", "launched": "", "denied": "#ee5f5b", "closed": "#c0c0c0"};

// Define variable for map.
var map, marker, infowindow = null;

$(document).ready(function () {

    initPagination(document.orders);

    // create a table of color and meaning
    var table = "<table>";
    for (var status in colors) {
        table += '<tr><td><div style="background-color: '+ colors[status]  +'; width: 50px;">&nbsp;</div></td><td><span data-i18n="ordersPage.labels.'+ status +'"></span></td></tr>';
    }
    // end table
    table += "</table>";

    // Populate legend div and translate it.
    $("#colorsLegend").html(table);
    //$("#colorsLegend").i18n();

    // hide all toggle divs
    $(function () {
        $("#collapse").on('click', function (e) {
            $('.accordion-body').each(function (index) {
                // Get table row. of where div is.
                var tr =  $(this).parent().parent().parent();
                // Is this div visible?
                var display = tr.css("display");

                // Hide only those seen on page
                if (display !== "none") {
                    $(this).collapse("hide");
                }
            });
        })
    })

    // show all toggle divs
    $(function () {
        $("#show").on('click', function (e) {
            $('.accordion-body').each(function (index) {
                // Get table row. of where div is.
                var tr =  $(this).parent().parent().parent();
                // Is this div visible?
                var display = tr.css("display");

                // Display only those seen on page
                if (display !== "none") {
                    $(this).collapse("show");
                }
            });
        })
    })

    // show all toggle divs
    $(function () {
        $("#legend").on('click', function (e) {
            var div = $("#colorsLegend");

            var display = div.css("display");
            if (display == "none") {
                div.show();
            } else {
                div.hide();
            }
        })
    })

    // Bind event on the Show Map link
    $(function () {
        $('body').on('click', "[alt='showAddress']", showAddress);
    });

    // For map support
    // Initialize map method
    function initialize() {
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
    }

    // Initialize map.
    google.maps.event.addDomListener(window, 'load', initialize);

});

/**
 * @function showAddress Display a popup with the map of the address.
 * @param e
 */
function showAddress (e) {
    // Show modal
    $("#myModal").modal();

    setTimeout(function() {
        google.maps.event.trigger(map, 'resize');
        setUpMap();
    }, 300);

    function setUpMap() {

        // Get location values
        var el = $(e.target);
        var latitude =  $(el).attr('lat');
        var longitude = $(el).attr('lng');
        var address = $(el).attr('address');

        var myLatlng = new google.maps.LatLng(latitude,longitude);

        // Set map center point.
        map.setCenter(myLatlng);

        if (!marker) {
            // Add marker
            marker = new google.maps.Marker({
                position: map.getCenter(),
                map: map
            });
        } else {
            // move marker
            // update the marker position
            marker.setPosition(map.getCenter());
        }

        // Display a info window
        infowindow = infowindow || new google.maps.InfoWindow();
        infowindow.setContent(address);
        infowindow.open(map,marker);
        google.maps.event.addListener(marker, 'click', function() {
            infowindow.open(map,marker);
        });
    }
}

/**
 * @function updateOldValue Stores the old value
 * @param e
 */
function updateOldValue(e) {
    $(e).attr('oldValue',$(e).val());
}

/**
 * @function alterOrder
 * @param e HTML select dropdown with actions
 */
function alterOrder (e) {

    // Div of messages
    var messages = $("#messages");
    messages.hide();

    var status = $(e).find(":selected").val();

    // Getting the whole table row.
    var orderPlaceHolder = ( ( $(e).parent().parent().parent().parent() ) );
    // Getting the div with the inputs.
    var orderDetails =  $(e).parent();

    var orderId;

    // Time to delivery for notification on accepted orders
    var timeToDelivery = "";

    // Determine the order ID
    orderDetails.find('input').each(function (childKey, elementKey) {
        if ($(elementKey).attr('name') == 'orderId')
            orderId = $(elementKey).attr('value');
    });

    // Get the status span text in order to alter it after update.
    var orderStatusSpan;
    orderDetails.find('span').each(function (childKey, elementKey) {
        if ($(elementKey).attr('id') == 'orderStatus')
            orderStatusSpan = $(elementKey);
    });

    var data = {
        orderId: orderId,
        newStatus: status
    };

    // Prompt to ask for time
    if (status === "accepted") {
        // Continue to get password
        $.msgBox({ type: "prompt",
            title: i18n.t("modals.ordersAcceptPrompt.title"),
            inputs: [
                { header: i18n.t("modals.ordersAcceptPrompt.header"), type: "text", name: "timeToDelivery", value: "30 minutes" }
            ],
            buttons: [
                { value: i18n.t("common.buttons.submit") },
                {value: i18n.t("common.buttons.cancel")}
            ],
            success: function (result, values) {
                if (result == i18n.t("common.buttons.submit")) {
                    $(values).each(function (index, input) {
                        if (input.name == "timeToDelivery") {
                            timeToDelivery = input.value;
                        }

                        // Update order
                        update_order();
                    });
                } else {
                    // Get old value
                    var oldValue = $(e).attr('oldValue');
                    // Select the old value.
                    $(e).val(oldValue);
                }
            }
        });
    } else {
        // Just update order.
        update_order();
    }

    /**
     * @function update_order Calls ajax to update order and send notification (for denied and accepted orders)
     */
    function update_order() {
        jQuery.ajax({
            type: "POST",
            contentType: "application/json; charset=utf-8",
            url: "/admin/alter_order",
            dataType: "json",
            data: JSON.stringify(data),
            success: function (data) {

                if (data.result) {
                    var current_page = parseInt($("#current_page").val());
                    var show_per_page = parseInt($('#show_per_page').val());

                    // Check if the order is being closed
                    var isClosed = (status === "closed");

                    // Remove table row if order was closed
                    isClosed && orderPlaceHolder.remove();

                    // Updating pagination only when the order is closed.
                    if (isClosed) {
                        //getting the amount of elements inside content div
                        var number_of_items = Object.keys(document.orders).length;
                        //calculate the number of pages we are going to have
                        var number_of_pages = Math.ceil(number_of_items / show_per_page);

                        // The current page cannot be greater or equal to the number of pages
                        if ( current_page >= number_of_pages) {
                            current_page = number_of_pages - 1;
                        }

                        update_navigation(number_of_pages, show_per_page, current_page, document.orders);

                        // Reset pagination
                        //hide all the elements inside content div
                        $('#paginationTable > tbody').children().css('display', 'none');
                        //and show the first n (show_per_page) elements
                        $('#paginationTable > tbody').children().slice(show_per_page * current_page, show_per_page * current_page + show_per_page).css('display', 'table-row');
                    }

                    // We will send notifications for these 2 statuses.
                    if (status === "denied" || status === "accepted") {
                        // Map of message to send to client per status
                        var statusNotificationMessage = {
                            "accepted": i18n.t("ordersPage.message.accepted_order"),
                            "denied": i18n.t("ordersPage.message.denied_order")
                        }

                        // Default notification params
                        var notificationParams = {};

                        // Remove order entry from global variable.
                        for (var i = 0; i < document.orders.length; i++) {
                            var orderEntry = document.orders[i];
                            if (orderEntry.id == orderId) {

                                notificationParams = {
                                    orderNotification: true,
                                    clients: [orderEntry.client],
                                    "textMessage": statusNotificationMessage[status].replace("%timeToDelivery%" , timeToDelivery)
                                }

                                // Remove entry only if it is closed
                                isClosed && document.orders.splice(i, 1);

                                break;
                            }
                        }

                        // Send notification
                        jQuery.ajax({
                            type: "POST",
                            contentType: "application/json; charset=utf-8",
                            url: '/admin/push_notifications',
                            data: JSON.stringify(notificationParams),
                            success: function (data) {
                                var message;
                                // Check if the notification was sent.
                                if (data.result) {
                                    message = "ordersPage.message.notification_sent";
                                } else {
                                    message = "ordersPage.message.notification_error";
                                }
                                showMessage(messages, message, "ordersPage");
                            }
                        });
                    } else {
                        // Update message div.
                        showMessage(messages,  data.message, "ordersPage");
                    }

                    // Change Color of div heading
                    orderDetails.css("background", colors[status]);

                    // Update span with order status and trigger translation.
                    orderStatusSpan.attr("data-i18n", "ordersPage.labels." + status);

                    // Translate the table
                    var ordersTable = $("#paginationTable");
                    ordersTable.i18n();
                } else {
                    // Update message div.
                    showMessage(messages,  data.message, "ordersPage");
                }
            }
        });
    }
}