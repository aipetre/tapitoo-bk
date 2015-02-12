$(document).ready(function () {
    var baseUrl = window.location.protocol+"//"+window.location.host;
    var socket = io.connect(baseUrl);

    // add_order event
    socket.on('add_order', appendOrder);
});


/**
 * Checks the counter values of the notifications and if one is bigger than 0 it displays the popup.
 */
function displayNotification() {
    var notifications = new Array("ordersNotification");
    var updateTitle = false;

    for (var i = 0; i < notifications.length; i++) {
        var str = notifications[i];
        var counterValue = parseInt($("#" + str).attr("counter")) + 1;
        if (counterValue > 0) {
            updateTitle = true;
            $("#" + str).html(counterValue);
            $("#" + str).attr("counter", counterValue);
            $("#" + str).css("visibility", "visible");
        }
    }

    if (updateTitle) {
        document.title = "("+ counterValue +") New Orders";
        var audio = document.getElementById("audio");
        audio.play();
    }
}

// Create a uniqueid
// http://stackoverflow.com/questions/12223529/create-globally-unique-id-in-javascript
function generateUid(separator) {
    /// <summary>
    ///    Creates a unique id for identification purposes.
    /// </summary>
    /// <param name="separator" type="String" optional="true">
    /// The optional separator for grouping the generated segmants: default "-".
    /// </param>

    var delim = separator || "-";

    function S4() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }

    return (S4() + S4() + delim + S4() + delim + S4() + delim + S4() + delim + S4() + S4() + S4());
};

function appendOrder(data) {

    // Is this our restaurant
    if (data.restaurantId != document.restaurantId || data.locationId != document.locationId) {
        return;
    }

    var ordersTable =$('#paginationTable > tbody');

    // Check if we have orders
    if(Array.isArray(data.products) && data.products.length > 0) {

        // Append to page if this is Orders page
        if ($("#ordersPage").length > 0) {
            // Set this so as to be unique on page
            var index = generateUid();

            // Push Order in global variable
            document.orders = document.orders ? document.orders : [data];
            document.orders.push(data);

            var parameters = {
                "index": index,
                "details": data,
                "allProducts": document.products
            };

            jQuery.ajax({
                type: "POST",
                contentType: "application/json; charset=utf-8",
                url: "/helper/append_order",
                dataType: "html",
                data: JSON.stringify(parameters),
                success: function (result) {

                    // Check if we are on orders page.
                    if ($("#ordersPage").length > 0) {
                        var current_page = parseInt($("#current_page").val());
                        var show_per_page = parseInt($('#show_per_page').val());

                        // Add order
                        if (ordersTable.children().length === 0) {
                            // Insert first row.
                            $('#paginationTable').append("<tbody>" + result + "</tbody>");
                            // Translate now, because tbody is not defined below.
                            $('#paginationTable').i18n();
                        } else {
                            // Append to existing rows.
                            ordersTable.prepend(result);
                        }

                        // Reset pagination
                        //hide all the elements inside content div
                        ordersTable.children().css('display', 'none');
                        //and show the first n (show_per_page) elements
                        ordersTable.children().slice(show_per_page * current_page, show_per_page * current_page + show_per_page).css('display', 'table-row');

                        // Call to translate.
                        ordersTable.i18n();

                        // Reset pagination
                        // TODO Keep current page.
                        initPagination(document.orders);
                    }
                }
            });
        }

        // Notify in browser.
        displayNotification();
    } else {
        console.log("There is a problem:", data);
    }
}

/**
 * This is a global function.
 * @function showMessage: Displays the message div with the given message translated
 * @param div Target Html div.
 * @param message Text that maps from translation file.
 * @param idToFocus Id of an html element to focus
 * @param replace Object with tags to be replaced in the message. Object should contain 'tag' property with tag that is being replaced and 'value' property with value to be put.
 */
function showMessage (div, message, idToFocus, replace) {
    div.attr("data-i18n", message);
    div.i18n();
    if (replace) {
        var html = div.html()
        var newValue = html.replace( replace.tag, replace.value);
        div.html(newValue);
    }
    div.show();

    if (idToFocus) {
        // Scroll to top
        $('html, body').animate({ scrollTop:  $("#" + idToFocus).offset().top }, 'slow');
    }

}

