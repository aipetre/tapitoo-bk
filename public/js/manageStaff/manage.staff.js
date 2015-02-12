$(document).ready(function () {


});

var Actions = {
    noLocatoinFn: function () {
        document.locationLat = "";
        document.locationLng = "";
    },
    ajaxUrl : "/admin/get_staff"
};

function deleteStaff(button) {
    // Ask first
    var confirm = window.confirm(i18n.t("staffPage.delete_confirm"));

    if (!confirm) return false;

    var tableRow = $(button).closest("tr");

    var idString = "staffForm";
    messageDiv = $("#messages" + idString);
    ajaxDiv = $("#ajaxLoader" + idString);

    var staffEmail;
    var staffName;
    var locationId;

    tableRow.find('input').each(function (childKey, elementKey) {
        if ($(elementKey).attr('name') == 'staffEmail')
            staffEmail = $(elementKey).attr('value');

        if ($(elementKey).attr('name') == 'staffName')
            staffName = $(elementKey).attr('value');

        if ($(elementKey).attr('name') == 'staffLocationId')
            locationId = $(elementKey).attr('value');
    });

    jQuery.ajax({
        type: "POST",
        contentType: "application/json; charset=utf-8",
        url: '/admin/delete_staff',
        dataType: "json",
        data: JSON.stringify({'staffEmail': staffEmail, 'locationId':locationId}),
        beforeSend: function () {
            // Show spinner.
            ajaxDiv.show();
            messageDiv.hide();
        },
        success: function (data) {
            messageDiv.attr("data-i18n", data.message);
            messageDiv.i18n();
            if (data.result) {
                messageDiv.html(messageDiv.text().replace("%staffName%", staffName));
                tableRow.remove();
            }
            messageDiv.show();
        },
        complete: function () {
            // Hide spinner.
            ajaxDiv.hide();
        }
    });
}