$(document).ready(function () {

    // Get hidden message divs
    var messages = $("#messages");
    var messagesModal = $("#messagesModal");

    // Get clients to send notification to. Default empty array.
    var clientsToBeNotified = [];

    // Get existing clients
    var clients = jQuery.parseJSON($("input[name=clientsData]").val()) || [];
    initPagination(clients);

    $("#showMassNotification").on('click', function (e) {

        // Hide message divs.
        messages.hide();
        messagesModal.hide();

        // Reset clients to be notified. ALWAYS!
        clientsToBeNotified = [];

        // Get checked clients
        $("input[name=users\\[\\]]").each(function() {
            // If it's checked add it to the list
            if (this.checked) {
                var userToBeAdded = jQuery.parseJSON(this.value);
                clientsToBeNotified.push(userToBeAdded);
            }
        });

        // If we have clients display modal windows
        if (clientsToBeNotified.length > 0) {
            $("#myModal").modal();
        } else {
            // Display error
            showMessage(messages,  "userPage.message.no_clients");
        }
    });

    $("#sendMassMessage").on('click', function (e) {

        // Hide message divs.
        messages.hide();
        messagesModal.hide();

        // Get message.
        var pushText = jQuery.trim($("#textMessage").val());

        // Check that we don't send empty message.
        if (pushText.length == 0) {
            showMessage(messagesModal, "userPage.message.empty_text");
            return false;
        }

        jQuery.ajax({
            type: "POST",
            contentType: "application/json; charset=utf-8",
            url: '/admin/push_notifications',
            data: JSON.stringify({
                    'clients': clientsToBeNotified,
                    'textMessage': pushText
            }),
            success: function (data) {
                showMessage(messages,  data.message);
            }
        });

    });

    // bind type event to this text inputy
    $("#searchClients").bind("click", searchBy);

    // Bind event on enter keypress.
    $("#searchClientName").bind("keyup", function (e) {
        //Enter keycode
        var code = e.keyCode || e.which;
        if(code == 13) {
            //Do something
            searchBy();
        }
    });

    /**
     * @function searchBy: Filters an object by the value of a specific property.
     */
    function searchBy() {
        var text = $("#searchClientName"),
            typeSearch = text.attr("searchBy"),
            valueSearched = text.val() || ".*",
            pattern = new RegExp(valueSearched, 'i'),
            emptySearch = $("#emptySearch"),
            divContent = $("#tableContent"),
            newData = [];

        // Reset clients to be notified.
        clientsToBeNotified = [];

        // Hide table of clients & pagination plus empty search div.
        emptySearch.hide();

        // Search in data
        $.grep(clients, function(entry, index){
            // Look in the appropiate object property
            if (pattern.test (entry[typeSearch].toString())) {
                // Push new data for pagination
                newData.push(entry);
            }
        });

        // Show data if filter returns something
        if (newData.length > 0) {

            jQuery.ajax({
                type: "POST",
                contentType: "application/json; charset=utf-8",
                url: "/helper/clients",
                dataType: "html",
                data: JSON.stringify({
                    clients: newData
                }),
                success: function (result) {
                    divContent.html(result);
                    divContent.i18n();

                    // Reset pagination
                    initPagination(newData);

                    //Show again table and pagination.
                    divContent.show();
                }
            });
        } else {
            // empty search, show nothing
            emptySearch.show();
            divContent.hide();
        }
    }

});