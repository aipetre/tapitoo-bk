/**
 * Created by root on 7/3/14.
 */
$(document).ready(function () {

    $("#saveFees").on('click',  function (e) {

        var idString = "deliveryFeeForm";
        var messageDiv = $("#messages" + idString);
        var ajaxDiv = $("#ajaxLoader" + idString);

        var data = {
            locationId: $("#selectLocation").find(":selected").val(), // Get the selected location.
            minDeliveryFee: $("#minDeliveryFee").val(),
            deliveryFee: $("#deliveryFee").val()
        };

        jQuery.ajax({
            type: "POST",
            contentType: "application/json; charset=utf-8",
            url: "/admin/save_delivery_fees",
            dataType: "json",
            data: JSON.stringify(data),
            beforeSend: function () {
                // Show spinner.
                ajaxDiv.show();
                messageDiv.hide();
            },
            success: function (data) {
                showMessage(messageDiv, data.message);
                $("#messages").attr("data-i18n", data.message);
                $("#messages").i18n();
                $("#messages").show();
            },
            complete: function () {
            // Hide spinner.
            ajaxDiv.hide();
        }
        });

        return false;
    });
});