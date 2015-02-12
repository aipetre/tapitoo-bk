$(document).ready(function () {

    // Get location drop-down.
    var selectLocation = $('#id_locationId');
    // Get page type layout title.
    var layoutTitle = $("#layoutTitle").val();
    // Get logged user type.
    var loggedInUserType = $("#loggedInUserType").val();
    // Get type of user that is edited
    var editedUserType = $("#editedUserType").val();


    if (layoutTitle === "my_account") {
        // Hide location dropdown for my account page
        selectLocation.attr('disabled', 'disabled');
        selectLocation.closest(".control-group").css("display","none");
    } else if (layoutTitle === "edit_staff") {
         // cannot edit the "Location" drop-down make it read-only but keep it's value.
         selectLocation.attr('readonly', 'readonly');
    }

    // assign behaviour when staff type if being changed.
//    $("input[name=type]:radio").change(function (e) {
//        if ($(e.target).val() === "manager") {
//            // Make location drop-down disabled when type is manager.
//            selectLocation.attr('disabled', 'disabled');
//            selectLocation.closest(".control-group").css("display","none");
//        }
//        else {
//            // Make location drop-down un-disabled when type is operator.
//            selectLocation.removeAttr('disabled');
//            selectLocation.closest(".control-group").css("display","block");
//        }
//    });
});