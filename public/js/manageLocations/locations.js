/**
 * Created by root on 6/23/14.
 */
$(document).ready(function () {
    $('body').on('click', "[alt='deleteRestaurant']", function (e) {
        e.preventDefault();
        e.stopPropagation();

        deleteLocation(e);
        return false;
    });
});

/**
 * @function deleteLocation: Deletes a Restaurant Location!
 * @param e
 */
function deleteLocation(e) {
    // Get clicked button
    var btn = $(e.target);

    // Div of messages
    var message = $("#messages").hide();

    // Get select html
    var tr = btn.closest("tr");

    // Get restaurant specifics variables
    var locationId = btn.attr("locationId");
    var displayName = btn.attr("displayName");

    var confirm = window.confirm(i18n.t("manageLocationsPage.message.delete_confirm").replace("%name%", displayName));

    if (!confirm) return;

    var data = {
        locationId: locationId
    };

    // Ajax call
    jQuery.ajax({
        type: "POST",
        contentType: "application/json; charset=utf-8",
        url: '/admin/delete_location',
        data: JSON.stringify(data),
        success: function (data) {

            // remove table row on success.
            if (data.success) {
                tr.remove();
            }

            // Set message
            showMessage(message, data.message, "manageLocationsPage", {tag: "%name%", value: displayName});
        }
    });
}
