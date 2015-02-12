$(document).ready(function () {

    // Bind event for location select.
    $("#selectLocation").on("change", changeAction);

    // If there is only one location then trigger the ajax call
    var numberOfOptions = $("#selectLocation option").length;
    var currentSelectedValue = $("#selectLocation").find(":selected").val();

    // If only one option then trigger the ajax call
    if (numberOfOptions === 1) {
        // populate ajax.
        changeAction();
    } else if (numberOfOptions === 2 && currentSelectedValue === "") {
        // If chain has only one location (for now) trigger call but first select the second options
        $("#selectLocation option").eq(1).prop("selected", true);
        // populate ajax.
        changeAction();
    }
});

/**
 * @function getLocation: Renders template for stats of the selected restaurant location.
 *@param e jQuery event
 */
function changeAction() {

    // string containing ajax and message div Id
    var idString = "StatusRestaurantLocation";
    var ajaxDiv = $("#ajaxLoader" + idString).hide();
    //var messageDiv = $("#messages" + idString).hide();

    var locationId = $("#selectLocation").find(":selected").val();

    // If location Id is empty just remove div content, otherwise get template
    if (locationId === "") {
        $("#locationContent").html("");
        Actions.noLocatoinFn();
    } else {
        jQuery.ajax({
            type: "GET",
            contentType: "application/json; charset=utf-8",
            url: Actions.ajaxUrl + "?locationId=" + encodeURIComponent(locationId),
            dataType: "html",
            beforeSend: function () {
                // Show spinner.
                ajaxDiv.show();
            },
            success: function (data) {
                $("#locationContent").html(data);
                $("#locationContent").i18n();
            },
            complete: function () {
                // Hide spinner.
                ajaxDiv.hide();
            }
        });
    }
}
