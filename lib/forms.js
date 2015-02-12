/**
 * Created by root on 3/8/14.
 */

var forms = require('forms'),
    fields = forms.fields,
    widgets = forms.widgets,
    validators = forms.validators;

var usStates = new Array({'name': 'Alabama', 'abbrev': 'AL'}, {'name': 'Alaska', 'abbrev': 'AK'},
    {'name': 'Arizona', 'abbrev': 'AZ'}, {'name': 'Arkansas', 'abbrev': 'AR'}, {'name': 'California', 'abbrev': 'CA'},
    {'name': 'Colorado', 'abbrev': 'CO'}, {'name': 'Connecticut', 'abbrev': 'CT'}, {'name': 'Delaware', 'abbrev': 'DE'},
    {'name': 'Florida', 'abbrev': 'FL'}, {'name': 'Georgia', 'abbrev': 'GA'}, {'name': 'Hawaii', 'abbrev': 'HI'},
    {'name': 'Idaho', 'abbrev': 'ID'}, {'name': 'Illinois', 'abbrev': 'IL'}, {'name': 'Indiana', 'abbrev': 'IN'},
    {'name': 'Iowa', 'abbrev': 'IA'}, {'name': 'Kansas', 'abbrev': 'KS'}, {'name': 'Kentucky', 'abbrev': 'KY'},
    {'name': 'Louisiana', 'abbrev': 'LA'}, {'name': 'Maine', 'abbrev': 'ME'}, {'name': 'Maryland', 'abbrev': 'MD'},
    {'name': 'Massachusetts', 'abbrev': 'MA'}, {'name': 'Michigan', 'abbrev': 'MI'}, {'name': 'Minnesota', 'abbrev': 'MN'},
    {'name': 'Mississippi', 'abbrev': 'MS'}, {'name': 'Missouri', 'abbrev': 'MO'}, {'name': 'Montana', 'abbrev': 'MT'},
    {'name': 'Nebraska', 'abbrev': 'NE'}, {'name': 'Nevada', 'abbrev': 'NV'}, {'name': 'New Hampshire', 'abbrev': 'NH'},
    {'name': 'New Jersey', 'abbrev': 'NJ'}, {'name': 'New Mexico', 'abbrev': 'NM'}, {'name': 'New York', 'abbrev': 'NY'},
    {'name': 'North Carolina', 'abbrev': 'NC'}, {'name': 'North Dakota', 'abbrev': 'ND'}, {'name': 'Ohio', 'abbrev': 'OH'},
    {'name': 'Oklahoma', 'abbrev': 'OK'}, {'name': 'Oregon', 'abbrev': 'OR'}, {'name': 'Pennsylvania', 'abbrev': 'PA'},
    {'name': 'Rhode Island', 'abbrev': 'RI'}, {'name': 'South Carolina', 'abbrev': 'SC'}, {'name': 'South Dakota', 'abbrev': 'SD'},
    {'name': 'Tennessee', 'abbrev': 'TN'}, {'name': 'Texas', 'abbrev': 'TX'}, {'name': 'Utah', 'abbrev': 'UT'},
    {'name': 'Vermont', 'abbrev': 'VT'}, {'name': 'Virginia', 'abbrev': 'VA'}, {'name': 'Washington', 'abbrev': 'WA'},
    {'name': 'West Virginia', 'abbrev': 'WV'}, {'name': 'Wisconsin', 'abbrev': 'WI'}, {'name': 'Wyoming', 'abbrev': 'WY'}
);

// Returns the desired form
function create_new_form(string) {

    var form = null;
    switch (string) {
        case 'my_account_form':
            var form = forms.create({
                email: fields.email({required: true}),
                locationId: fields.string({
                    choices: {},
                    widget: widgets.select()
                }),
                pass: fields.password(),
                passConfirm:  fields.password({
                    validators: [validators.matchField('pass')]
                })

            });
            break;

        case 'add_staff_form':
            var form =  forms.create({
                type: fields.string({
                    choices: {manager: 'manager', operator: 'operator'},
                    required: true,
                    widget: widgets.multipleRadio()
                }),
                locationId: fields.string({
                    choices: {},
                    widget: widgets.select()
                }),
                email: fields.email({required: true}),
                pass: fields.password({required: true}),
                passConfirm:  fields.password({
                    required: true,
                    validators: [validators.matchField('pass')]
                })
            });
            break;

        case 'edit_staff_form':
            var form =  forms.create({
                type: fields.string({
                    choices: {manager: 'manager', operator: 'operator'},
                    required: true,
                    widget: widgets.multipleRadio()
                }),
                locationId: fields.string({
                    choices: {},
                    widget: widgets.select()
                }),
                email: fields.email({required: true}),
                pass: fields.password(),
                passConfirm:  fields.password({
                    validators: [validators.matchField('pass')]
                })
            });
            break;

        case 'sigunp':
            var form =  forms.create({
                displayName: fields.string({required: true}),
                locationDisplayName: fields.string({required: true}),
                isChain: fields.string({
                        widget: widgets.checkbox()
                }),
                email: fields.email({required: true}),
                pass: fields.password({required: true}),
                passConfirm:  fields.password({
                    required: true,
                    validators: [validators.matchField('pass')]
                })
            });
            break;

        case 'location_add':
            var form = forms.create({
                locationDisplayName: fields.string({required: true})
            });
            break
    }

    return form;
}

var my_field = function (name, object) {

    var label = '<label class="control-label" for="name" data-i18n="formFields.' + name +'"></label>'
    var error = object.error ? '<div><span for="name" generated="true" class="error" style="display: inline;" data-i18n="' + object.error.split(" ").join("").trim(".") + '"></span></div>' : '';
    var widget = '<div class="controls">' + object.widget.toHTML(name, object) + error + '</div>';
    return '<div class="control-group' + (error !== '' ? ' error' : '')  + '">' + label + widget + '</div>';
}

module.exports = {
    my_field: my_field,
    create_new_form: create_new_form
}
