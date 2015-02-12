/**
 * Created by root on 4/6/14.
 */

$(document).ready(function () {

    $('body').on('click', "[alt='updatePassword']", function (e) {
        e.preventDefault();
        e.stopPropagation();

        updatePassword(e);
        return false;
    });

    $('body').on('click', "[alt='deleteRestaurant']", function (e) {
        e.preventDefault();
        e.stopPropagation();

        deleteRestaurant(e);
        return false;
    });

    // Init pagination
    //initPagination(document.restaurants);

});

/**
 * @function deleteRestaurant: Delete a Restaurant
 * @param e
 */
function deleteRestaurant(e) {
    // Get clicked button
    var btn = $(e.target);

    // Div of messages
    var message = $("#messages").hide();

    // Spinner
    var div = $("#ajaxLoaderRestaurantsForm").hide();

    // Get select html
    var tr = btn.closest("tr");

    // Get restaurant specifics variables
    var restaurantId = btn.attr("restaurantId");
    var displayName = btn.attr("displayName");

    // This is so Papa's Italiano restaurant cannot be deleted
    if (restaurantId === "ef06053c-b61a-48d4-bcf3-ad6892f29722") {
        alert("Cannot delete Papa's Italiano. Action not allowed!");
        return false;
    }

    var confirm = window.confirm(i18n.t("restaurantsPage.message.delete_confirm").replace("%displayName%", displayName));

    if (!confirm) return;

    var data = {
        restaurantId: restaurantId
    };

    // Ajax call
    jQuery.ajax({
        type: "POST",
        contentType: "application/json; charset=utf-8",
        url: '/superadmin/delete_restaurant',
        data: JSON.stringify(data),
        beforeSend: function () {
            // Show spinner.
            div.show();
            message.hide();
        },
        success: function (data) {

            // remove table row on success.
            if (data.success) {
                tr.remove();
            }

            // Set message
            showMessage(message, data.message, "restaurantsPage", {tag: "%displayName%", value: displayName});
        },
        complete: function () {
            // Hide spinner.
            div.hide();
        }
    });

}

/**
 * @function updatePassword Update the password for a staff member of an restaurant.
 * @param e JQuery Event.
 */
function updatePassword(e) {

    // Get clicked button
    var btn = $(e.target);

    // Get select html
    var td = btn.closest("td");
    var select = td.find("select");

    // Get restaurant specifici variables
    var restaurantId = btn.attr("restaurantId");
    var locationId = btn.attr("locationId");
    var fullId = restaurantId + locationId;

    // Ajax spinner
    var div = $("#ajaxLoaderStaff"+fullId).hide();

    // Message div
    var message = ($("#messagesStaff"+fullId)).hide();

    // Get selected staff.
    var staffEmail = select.find(":selected").val();

    // Check if a staff member is selected
    if (staffEmail === "") {
        showMessage(message, "restaurantsPage.message.no_staff");
        return false;
    }

    // Continue to get password
    $.msgBox({ type: "prompt",
        title: i18n.t("modals.updatePassword.title"),
        inputs: [
            { header: i18n.t("modals.updatePassword.header"), type: "text", name: "newPassword" }
        ],
        buttons: [
            { value: i18n.t("common.buttons.update") },
            {value: i18n.t("common.buttons.cancel")}
        ],
        success: function (result, values) {
            var newPassword = "";
            if (result == i18n.t("common.buttons.update")) {
                $(values).each(function (index, input) {
                    if (input.name == "newPassword") {
                        newPassword = input.value;
                    }

                    // Check if empty password
                    if (newPassword === "") {
                        showMessage(message, "restaurantsPage.message.empty_password");
                        return false;
                    }

                    // All ok: Update the password.
                    var data = {
                        restaurantId: restaurantId,
                        locationId: locationId,
                        staffId: staffEmail,
                        fieldName: "pass",
                        fieldValue: newPassword
                    };

                    // Ajax call
                    jQuery.ajax({
                        type: "POST",
                        contentType: "application/json; charset=utf-8",
                        url: '/superadmin/update_password',
                        data: JSON.stringify(data),
                        beforeSend: function () {
                            // Show spinner.
                            div.show();
                            message.hide();
                        },
                        success: function (data) {
                            // Set message
                            showMessage(message, data.message);
                        },
                        complete: function () {
                            // Hide spinner.
                            div.hide();
                        }
                    });
                });
            }
        }
    });
}

/**
 * @function changeRestaurantStatus Updates the status of an restaurant
 * @param select Html select element.
 */
function changeRestaurantStatus(select, restaurantId) {

    var fullId = restaurantId;
    // Ajax spinner
    var div = $("#ajaxLoaderStatus"+fullId).hide();
    var message = ($("#messagesStatus"+fullId)).hide();

    jQuery.ajax({
        type: "POST",
        contentType: "application/json; charset=utf-8",
        url: '/superadmin/change_status',
        data: JSON.stringify({
            restaurantId: restaurantId,
            newStatus: $(select).find(":selected").val()
        }),
        beforeSend: function () {
            div.show();
            message.hide();
        },
        success: function (data) {
            // Set message
            showMessage(message, data.message);
        },
        complete: function () {
            div.hide();
        }
    });
}
