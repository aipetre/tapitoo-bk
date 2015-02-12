var categoryToAddTo = "";
var accordionGeneratedOrder = 0;

$(document).ready(function () {
// Handler for .ready() called.
    function categoryObj() {
        this.categoryId;
        this.categoryName;
        this.productsArray = new Array();
    }

    function productObj() {
        this.productName;
        this.productPrice;
        this.productCurrency;
        this.productStatus;
        this.productDescription;
        this.resizedPic;
        this.normalPic;
    }

    // Get modal message div.
    var messageDivModal = $("#messagesImageUploadForm");

// save changes
    $('#saveChangesMenu').on('click', function (e) {
            // turn menu into json
            var products = new Array();
            var categoryIndex = 0;
            // loop through all category names
            $("tbody[id$='-inner']").each(function (key, element) {
                var categoryName = $(element).attr("catName");
                var categoryId = $(element).attr("catId");

                var category = new categoryObj();
                category.categoryId = categoryId;
                category.categoryName = categoryName;
                //get all products under category
                var productIndex = 0;
                $("tbody[catName='" + categoryName + "'] > tr").each(function (key, element) {
                    // parsing each product node...
                    var product = new productObj();
                    $(element).find('*').each(function (childKey, elementKey) {
                        if ($(elementKey).attr('type') == 'hidden') {
                            if ($(elementKey).attr('name') == 'id') product.id = $(elementKey).attr('value');
                            if ($(elementKey).attr('name') == 'productName') product.productName = $(elementKey).attr('value');
                            if ($(elementKey).attr('name') == 'productPrice') product.productPrice = $(elementKey).attr('value');
                            if ($(elementKey).attr('name') == 'priceCurrency') product.priceCurrency = $(elementKey).attr('value');
                            if ($(elementKey).attr('name') == 'productStatus') product.productStatus = $(elementKey).attr('value');
                            if ($(elementKey).attr('name') == 'productDescription') product.productDescription = $(elementKey).attr('value');
                            if ($(elementKey).attr('name') == 'resizedPic') product.resizedPic = $(elementKey).attr('value');
                            if ($(elementKey).attr('name') == 'normalPic') product.normalPic = $(elementKey).attr('value');
                        }
                    });
                    category.productsArray[productIndex] = product;
                    productIndex++;
                });
                products[categoryIndex] = category;
                categoryIndex++;
            });

            //get all products
            jQuery.ajax({
                type: "POST",
                contentType: "application/json; charset=utf-8",
                url: '/admin/update_menu',
                data: JSON.stringify({
                    categoriesAndProducts: products,
                    oldProducts: document.oldProducts ? document.oldProducts : {}
                }),
                success: function (data) {

                    // Update old products
                    document.oldProducts = data.oldProducts;

                    // Update the catId fields with the new categories
                    for (var i= 0, length = data.categoryIds.length; i < length; i++) {
                        // Get category details
                        var categoryId = data.categoryIds[i].categoryId;
                        var categoryName = data.categoryIds[i].categoryName;
                        // Div accordion
                        var divAccordiation = $("div[catName='" + categoryName + "']");
                        divAccordiation.attr("catId", categoryId);
                        divAccordiation.attr("catName", categoryName);
                        // Table of products
                        var tableOfProducts = $("tbody[catName='" + categoryName + "']");
                        tableOfProducts.attr("catId", categoryId);
                        tableOfProducts.attr("catName", categoryName);
                    }

                    // Update the productId fields with new products
                    for (var i = 0, length = data.productIds.length; i < length; i++) {
                        var rowNumber;
                        $("tbody[catId='" + data.productIds[i].categoryId + "'] > tr").each(function (key, element) {

                            $(element).find('*').each(function (childKey, elementKey) {
                                if ($(elementKey).attr('type') == 'hidden') {
                                    if ($(elementKey).attr('name') == 'productName' && $(elementKey).attr('value') === data.productIds[i].productName) {
                                        rowNumber = key;
                                    }
                                }
                            });
                        });

                        if (typeof rowNumber != "undefined") {
                            var row = $("tbody[catId='" + data.productIds[i].categoryId + "'] > tr")[rowNumber];

                            // Update id of product
                            $(row).find('*').each(function (childKey, elementKey) {
                                if ($(elementKey).attr('type') == 'hidden') {
                                    if ($(elementKey).attr('name') == 'id')  {
                                        $(elementKey).attr('value', data.productIds[i].productId);
                                    }
                                }
                            });
                        }


                    }

                    // Set message
                    $("#messages").attr("data-i18n", data.message);
                    $("#messages").i18n();
                    $("#messages").show();
                }
            });

        }

    )

// add new category
    $(function () {
        $("[alt='addCategory']").on('click', function (e) {
            openCreateNewMenuCategoryMessageBox();
        })
    })

    $(function () {
        $("[alt='saveProductChanges']").on('click', function (e) {

        })
    })

    function openCreateNewMenuCategoryMessageBox() {
        $.msgBox({ type: "prompt",
            title: i18n.t("modals.newMenuCategory.create"),
            inputs: [
                { header: i18n.t("modals.newMenuCategory.header"), type: "text", name: "categoryName" }
            ],
            buttons: [
                { value: i18n.t("common.buttons.create") },
                {value: i18n.t("common.buttons.cancel")}
            ],
            success: function (result, values) {
                var v = "";
                if (result == i18n.t("modals.newMenuCategory.buttons.create")) {
                    $(values).each(function (index, input) {
                        if (input.name == "categoryName") v = input.value;
                    });

                    var categDiv = $("div[catName='" + $.trim(v) + "']");

                    // Check if a category with the same name exists.
                    if (categDiv.length > 0) {
                        // Warn that category with the same name exists.
                        alert(i18n.t("menuPage.duplicate_category").replace("%categoryName%", v));
                        return false;
                    } else if (v.replace(" ", "").length > 0) {
                        //append new accordion to dom
                        addNewCategory(v);
                    }
                }
            }
        });
    }


    function addNewCategory(categoryName) {
        jQuery.ajax({
            type: "POST",
            contentType: "application/json; charset=utf-8",
            url: "/helper/append_category",
            dataType: "html",
            data: JSON.stringify({
                categoryDetails: {
                    categoryName: categoryName,
                    categoryId: ""
                }
            }),
            success: function (result) {
                $("#menuContent").append(result);
                $("#menuContent").i18n();
            }
        });
    }

    // accordion category listeners
    $(function () {
        $('body').on('click', "[alt='accordionButtonAddProduct']", function (e) {
            e.preventDefault();
            e.stopPropagation();
            // This selects div with class = "accordation".
            var el = $(e.target).parents().eq(3);
            categoryToAddTo = el.find("table > tbody");
            categoryName = ( $(el).attr('catName') );
            openCreateNewProductMessageBox(categoryName);
        })
    });

    $(function () {
        $('body').on('click', "[alt='editCategoryButton']", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var el = ( ( $(e.target).parents().eq(3) ) );
            categoryName = ( el.attr('id') );
            openEditCategory(categoryName);
        })
    })

    $(function () {
        $('body').on('click', "[alt='deleteCategoryButton']", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var el = ( ( $(e.target).parents().eq(3) ) );
            categoryName = ( el.attr('catName') );
            categoryId = ( el.attr('catId') );
            deleteCategory(categoryName, categoryId);
        })
    })

    function deleteCategory(categoryName, categoryId) {

        if (typeof categoryId != "undefined" && categoryId != "") {
            var message = i18n.t("menuPage.delete_category_confirm");
            var confirm = window.confirm(message.replace("%categoryName%", categoryName));

            if (!confirm) return;

            jQuery.ajax({
                type: "POST",
                contentType: "application/json; charset=utf-8",
                url: '/admin/delete_category',
                data: JSON.stringify({
                    categoryId : categoryId,
                    fieldName: "deleted",
                    fieldValue: true
                }),
                success: function (data) {
                    // Get div to delete.
                    var categoryRow = $("div[catId='" + categoryId + "']");
                    $("#messages").attr("data-i18n", data.message);
                    $("#messages").i18n();

                    if (data.result) {
                        $("#messages").html($("#messages").text().replace("%categoryName%", categoryName));
                        categoryRow.remove();
                    }

                    // Display
                    $("#messages").show();
                    // Scroll top.
                    $('html, body').animate({ scrollTop:  $("#menuPage").offset().top }, 'slow');
                }
            });
        } else  {
            // Category wasn't even saved. Just remove it
            var categoryRow = $("div[catName='" + categoryName + "']");
            categoryRow.remove();
        }
    }

// end listeners

    function openEditCategory(categoryName) {
        $.msgBox({ type: "prompt",
            title: "Edit menu category",
            inputs: [
                { header: "New category name", type: "text", name: "categoryName" }
            ],
            buttons: [
                { value: "Edit" },
                {value: "Cancel"}
            ],
            success: function (result, values) {
                var newCategoryName = "";
                if (result == "Edit") {
                    $(values).each(function (index, input) {
                        if (input.name == "categoryName") newCategoryName = input.value;
                    });
                    //append new accordion to dom
                    rewriteCategoryName(categoryName, newCategoryName);
                }
            }
        });
    }

    function rewriteCategoryName(oldCategoryName, newCategoryName) {
        //span 2
        $("#" + oldCategoryName + "-visible").text(newCategoryName);
        $("#" + oldCategoryName + "-visible").attr('id', newCategoryName + "-visible");
        //tbody
        $("#" + oldCategoryName + "-inner").attr('id', newCategoryName + "-inner");
        // parent element
        $("#" + oldCategoryName).attr('id', newCategoryName);
    }

    function isString(o) {
        if (o == null) return false;
        return typeof o == "string" || (typeof o == "object" && o.constructor === String);
    }

    // add new product
    function addNewProduct(table, productName, productPrice, priceCurrency, productStatus, productDescription, resizedPic, normalPic) {
        var el = table;

        var status
        if (productStatus == "false") {
            status = "common.labels.not_available";
        } else {
            status = "common.labels.available";
        }

        jQuery.ajax({
            type: "POST",
            contentType: "application/json; charset=utf-8",
            url: "/helper/append_product",
            dataType: "html",
            data: JSON.stringify({
                product: {
                    id: "",
                    productName: productName,
                    productPrice: productPrice,
                    priceCurrency: priceCurrency,
                    productStatus: productStatus,
                    productDescription: productDescription,
                    resizedPic: resizedPic,
                    normalPic: normalPic
                }
            }),
            success: function (result) {
                el.append(result);
                el.i18n();
            }
        });
    }

    function modalShow(dialog, product, row) {

        // Hide this div on new modal window.
        messageDivModal.hide();

        dialog = dialog || "add";

        if (dialog == "edit") {
            $("#productNameModal")[0].value = product.productName;
            $("#productPriceModal")[0].value = product.productPrice;
            $("#validateSelect")[0] ? $("#validateSelect")[0].value = product.priceCurrency : null; // currency
            $("#productStatusModal")[0].value = product.productStatus ? product.productStatus : "true";
            $("#productShortDescriptionModal")[0].value = product.productDescription;
            $("#productImageModal")[0].value = product.resizedPic ? product.resizedPic : "/img/menu/defaultPic.jpg";
            $("#productSiteImageModal")[0].value = product.normalPic ? product.normalPic : "/img/menu/defaultPic.jpg";

        } else {
            $("#productNameModal")[0].value = "";
            $("#productPriceModal")[0].value = "";
            $("#productShortDescriptionModal")[0].value = "";
            $("#productImageModal")[0].value = "/img/menu/defaultPic.jpg";
            $("#productSiteImageModal")[0].value = "/img/menu/defaultPic.jpg";
        }

        // Reset image
        $("#uploadImage")[0].value = "";
        // Very important: Reset upload image files
        files = {};

        var map = {
            add: saveChangesProductHandler,
            edit: editChangesProductHandler
        }

        // Remove any click events
        $("#saveChangesProduct").unbind("click");
        $("#saveChangesProduct").click(function () {map[dialog](row, product)});
    }

    function editChangesProductHandler (row, product) {

        // Update hidden values
        row.find('*').each(function (childKey, elementKey) {
            if ($(elementKey).attr('type') == 'hidden') {
                if ($(elementKey).attr('name') == 'productName') $(elementKey).attr('value', $("#productNameModal")[0].value);
                if ($(elementKey).attr('name') == 'productPrice') $(elementKey).attr('value', $("#productPriceModal")[0].value);
                if ($(elementKey).attr('name') == 'priceCurrency') $(elementKey).attr('value', $("#validateSelect")[0] ? $("#validateSelect")[0].value : null);
                if ($(elementKey).attr('name') == 'productStatus') $(elementKey).attr('value', $("#productStatusModal")[0].value);
                if ($(elementKey).attr('name') == 'productDescription') $(elementKey).attr('value', $("#productShortDescriptionModal")[0].value);
                if ($(elementKey).attr('name') == 'resizedPic') $(elementKey).attr('value', $("#productImageModal")[0].value);
                if ($(elementKey).attr('name') == 'normalPic') $(elementKey).attr('value', $("#productSiteImageModal")[0].value);
            }
        });

        // Update product Image
        $("#productImagePlaceHolder" + product.id).attr("src", $("#productImageModal")[0].value);

        // Update displayed values
        row.find('td').each(function (childKey, elementKey) {
            if ($(elementKey).attr('id') == 'productName') {
                // Modify product name text
                $(elementKey).find('span').each(function (child, element) {
                    $(element).text($("#productNameModal")[0].value);
                });
            }
            if ($(elementKey).attr('id') == 'productPrice') $(elementKey).html($("#productPriceModal")[0].value);
            if ($(elementKey).attr('id') == 'priceCurrency') $(elementKey).html($("#validateSelect")[0] ? $("#validateSelect")[0].value : null);
            if ($(elementKey).attr('id') == 'productStatus') $(elementKey).attr("data-i18n", $("#productStatusModal")[0].value == "false" ? "common.labels.not_available" : "common.labels.available");
            if ($(elementKey).attr('id') == 'productDescription') $(elementKey).html($("#productShortDescriptionModal")[0].value);
            // This is the image!. Maybe do something different
            if ($(elementKey).attr('id') == 'resizedPic') $(elementKey).html($("#productImageModal")[0].value);
            if ($(elementKey).attr('id') == 'normalPic') $(elementKey).html($("#productSiteImageModal")[0].value);
        });
        // Translate
        row.i18n();
    }

    function saveChangesProductHandler(e) {
        var productName = $("#productNameModal")[0].value;
        var productPrice = $("#productPriceModal")[0].value;
        var priceCurrency = $("#validateSelect")[0] ? $("#validateSelect")[0].value : null; // currency
        var productStatus = $("#productStatusModal")[0].value;
        var productDescription = $("#productShortDescriptionModal")[0].value;
        var resizedPic = $("#productImageModal")[0].value;
        var normalPic = $("#productSiteImageModal")[0].value;


        // you hardcoded currency, moron!!!
        addNewProduct(categoryToAddTo, productName, productPrice, priceCurrency, productStatus, productDescription, resizedPic, normalPic);
    }

    function openCreateNewProductMessageBox() {
        $("#myModal").modal({onShow: modalShow()});
    }


// product button listeners
    $(function () {
        $('body').on('click', "[alt='editProductButton']", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var td = ( ( $(e.target).parent() ) );

            var tableRow = td.closest("tr");

            var product = new productObj();
            tableRow.find('input').each(function (childKey, elementKey) {
                if ($(elementKey).attr('name') == 'id') product.id = $(elementKey).attr('value');
                if ($(elementKey).attr('name') == 'productName') product.productName = $(elementKey).attr('value');
                if ($(elementKey).attr('name') == 'productPrice') product.productPrice = $(elementKey).attr('value');
                if ($(elementKey).attr('name') == 'priceCurrency') product.priceCurrency = $(elementKey).attr('value');
                if ($(elementKey).attr('name') == 'productStatus') product.productStatus = $(elementKey).attr('value');
                if ($(elementKey).attr('name') == 'productDescription') product.productDescription = $.trim($(elementKey).attr('value'));
                if ($(elementKey).attr('name') == 'resizedPic') product.resizedPic = $.trim($(elementKey).attr('value'));
                if ($(elementKey).attr('name') == 'normalPic') product.normalPic = $.trim($(elementKey).attr('value'));
            });


            $("#myModal").modal({onShow: modalShow("edit", product, tableRow)});
        })
    })

    $(function () {
        $('body').on('click', "[alt='deleteProductButton']", function (e) {
            e.preventDefault();
            e.stopPropagation();
//            var el = ( ( $(e.target).parent() ) );
//            el.remove();
            var tableRow = $(e.currentTarget).closest("tr");
            var productId;
            var productName;
            tableRow.find('input').each(function (childKey, elementKey) {
                if ($(elementKey).attr('name') == 'id')
                    productId = $(elementKey).attr('value');

                if ($(elementKey).attr('name') == 'productName')
                    productName = $(elementKey).attr('value');

            });

            if (typeof productId != "undefined" && productId != "") {
                var confirm = window.confirm(i18n.t("menuPage.delete_product_confirm").replace("%productName%", productName));

                if (!confirm) return;

                jQuery.ajax({
                    type: "POST",
                    contentType: "application/json; charset=utf-8",
                    url: '/admin/delete_product',
                    dataType: "json",
                    data: JSON.stringify({
                        "productId": productId,
                        "fieldName": "deleted",
                        "fieldValue": true
                    }),
                    success: function (data) {
                        $("#messages").attr("data-i18n", data.message);
                        $("#messages").i18n();

                        if (data.result) {
                            // Remove the deleted product from the cache.
                            delete document.oldProducts[productId];
                            $("#messages").html($("#messages").text().replace("%productName%", productName));
                            tableRow.remove();
                        }
                        // Show div.
                        $("#messages").show();
                        // Scroll top
                        $('html, body').animate({ scrollTop:  $("#menuPage").offset().top }, 'slow');
                    }
                });

            } else {
                tableRow.remove();
            }
        })
    })


// sortable
    $(function () {
        $("[alt='sortable']").sortable();
        $("[alt='sortable']").disableSelection();

        $("[alt='sortable']").sortable({
            stop: function (event, ui) {
                var data = "";

                $("[alt='sortable']").each(function (i, el) {
                    var p = $(el).text().toLowerCase().replace(" ", "_");
                    data += p + "=" + $(el).index() + ",";
                });
            }
        });

    });

    // hide all toggle divs
    $(function () {
        $("#collapse").on('click', function (e) {

            $('.accordion-body').each(function (index) {
                $(this).collapse("hide");
            });
        })
    });

    // show all toggle divs
    $(function () {
        $("#show").on('click', function (e) {

            $('.accordion-body').each(function (index) {
                $(this).collapse("show");
            });
        })
    });

    // Variable to store your files
    var files;

    // Add events
    $('input[type=file]').on('change', prepareUpload);

    // Grab the files and set them to our variable
    function prepareUpload(event) {
        files = event.target.files;
    }

    // Upload image.
    $(function () {
        $('body').on('click', "[alt='uploadImage']", function (e) {
            e.preventDefault();
            e.stopPropagation();

            if(typeof files !== "undefined" && Object.keys(files).length > 0) {
                var ajaxDiv = $("#ajaxLoaderImageUploadForm").show();
                var data = new FormData();
                $.each(files, function(key, value) {
                    data.append(key, value);
                });

                jQuery.ajax({
                    url: "/admin/upload_image",
                    type:"POST",
                    data: data,
                    dataType: 'json',
                    processData: false, // Don't process the files
                    contentType: false, // Set content type to false as jQuery will tell the server its a query string request
                    success: function(data) {
                        if (data.success) {
                            // Success upload
                            // Thumb Image.
                            $("#productImageModal")[0].value = data.resizedPic;
                            // Full Image.
                            $("#productSiteImageModal")[0].value = data.normalPic;

                            // Reset files
                            files = {};
                        }

                        // Hide ajax loading
                        showMessage(messageDivModal, data.message);
                        ajaxDiv.hide();
                    }
                });
            }
            return false;
        })
    });
});