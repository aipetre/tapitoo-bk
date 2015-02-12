$(document).ready(function () {

    $("#saveOpeningHours").on('click', function (e) {
        var data = {};

        $("#hoursForm").find("select").each(function () {
            // Need to get rid of "form_" from name to construct data properly
            var dropdownName = $(this).attr("id").replace("form_", "");
            var selectedValue = $(this).find(":selected").val();
            data[dropdownName] = selectedValue;
        });

        jQuery.ajax({
            type: "POST",
            contentType: "application/json; charset=utf-8",
            url: "/admin/save_opening_hours",
            dataType: "json",
            data: JSON.stringify(data),
            success: function (data) {
                $("#messages").attr("data-i18n", data.message);
                $("#messages").i18n();
                $("#messages").show();
            }
        });
        return false;
    });

    function populate(selector) {
        var select = $(selector);
        var selectedOption = $(selector + "_option").val();
        var hours, minutes, ampm;
        var flagMorning = true;
        // Append special options
        select.append($('<option></option>')
            .attr('value', "closed")
            .attr('data-i18n', "common.labels.closed"));

        select.append($('<option></option>')
            .attr('value', "midnight")
            .attr('data-i18n', "common.labels.midnight"));

        for(var i = 30; i <= 1430; i += 30){
            hours = Math.floor(i / 60);
            minutes = i % 60;
            if (minutes < 10){
                minutes = '0' + minutes; // adding leading zero
            }

            if (hours % 24 == 12) {
                ampm = 'PM';
            } else {
                ampm = hours % 24 < 12 ? 'AM' : 'PM';
            }

            hours = hours % 12;
            if (hours === 0){
                hours = 12;
            }

            if (hours < 10){
                hours = '0' + hours; // adding leading zero
            }

            var optionValue = hours + ':' + minutes + ' ' + ampm;
            select.append($('<option></option>')
                .attr('value', optionValue)
                .text(optionValue));
        }

        // Set selected value
        select.val(selectedOption);
    }
    var dropdowns = new Array('sunday_opening_hours', 'sunday_closing_hours', 'monday_opening_hours', 'monday_closing_hours', 'tuesday_opening_hours', 'tuesday_closing_hours', 'wednesday_opening_hours', 'wednesday_closing_hours', 'thursday_opening_hours', 'thursday_closing_hours', 'friday_opening_hours', 'friday_closing_hours', 'saturday_opening_hours', 'saturday_closing_hours');
    dropdowns.forEach(function (name) {
        populate('#' + name); // use selector for your select
    });
});
