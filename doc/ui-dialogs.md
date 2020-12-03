# wolf.ui dialogs

wolf.ui extension add capacity for pop-up dialogs in an easy way.

the extensionadds the next tree dialogs functions to wolf.js object:
· wolf.dialog, to load a dialog out of an html file.
· wolf.messaeDialog, to show simple message dialgs.
· wolf.uiDialog, to create dialogs out of wolf.js UI templates (need knowledge about wolf.js UI templates).

## using dialgos

All dialogs on the library uses a very similar way of usage:

        wolf.dialog(<app-element>,<modal>,<dialog-data>,[buttons-definition],[controller],[creation-callback(<dialog-instance>)],[close-callback(<button-pressed>)]);

· app-element is the parent element of the dialog, the root node of the aplication is recommended, but can be any node.
· modal, boolean defining if the dialog is modal.
· dialog-data, dialog usage specific data, this type and maning depends on the dialog method used. See bottom sections.
· buttons-definition, optional but recommended, a definition of the buttons shown in the footer of the application.
· controller, controller object used to catch elements events, recommended, if not defined app-element controller will be used instead (except buttons-definitnion).
· creation-callback, callback to be executed once the dialog is ready and on screen, the dialog element is passed as parameter.
· close-callback, when buttons of buttons-definition does not have an asigned function, the default function is to close the dialog and call this callback passing
the id of the button pressed.

This gives a lot of ways to define a dialog and the associated logic.

### wolf.dialog

The easyest way to call a dialog is creating a HTML with all the content of the dialog, and call the wolf.dialog pasing the url string in the dialog-data parameter.

        wolf.dialog(element.getApplication(),true,"dialogs/car-editor.html",{
            onClose:{text:"close",cancel:true},
            onSave:{text:"save"}          
        },{
            onSave:(element,event,dialog){
                saveData(getDataFrom(dialog)); //saveData and getDataFrom are not wolf nor wolf.ui framework methods.
                dialog.close();
            }
        });

this can be defined also without controller:

        wolf.dialog(element.getApplication(),true,"dialogs/car-editor.html",{
            onClose:{text:"close"},
            onSave:{
                text:"save",
                click:(element,event,dialog) {
                    saveData(getDataFrom(dialog)); //saveData and getDataFrom are not wolf.js nor wolf.ui framework methods.
                    dialog.close();
                }
            }
        });

When defining a dialog controller, all events defined with event:... inside the HTML are handled by the dialog controller.

### wolf.messgeDialog

Intended to use simple text messages without the need of create an HTML page or advanced wolf.js UI template data.

        wolf.messageDialog(element.getApplication(),true,"Sure to delete car information?",{
            onNo:{text:"no",cancel:true},
            onYes:{
                text:"yes",
                click:(element,event,dialog) {
                    deleteCar(id); //deleteCar and id parameter are not wolf.js nor wolf.ui framework methods.
                    dialog.close();
                }
            })

Or using the result callback the dialog gets closed automatically.

        wolf.messageDialog(element.getApplication(),true,"Sure to delete car information?",{
            onNo:{text:"no",cancel:true},
            onYes:{text:"yes"},null,null,button=>{if (button=="onYes") deleteCar(id)});

If no buttons are defined a simple button with a cross icon named close will be defined by default.

        wolf.messageDialog(element.getApplication(),true,"Car information deleted");

### wolf.uiDialog

UI dialog is similar to the HTML variant wolf.dialog but passing wolf.js UI template information to the dialog.data, meant to be used as advanced dialog content definition.

### dialgos button definitions

The dialog button definition is an object that define button id, content, function and stylish, can be defined in object notation as:

    {
        <button-id>:{
            text:<text-in-the-button>,
            icon:<icon-of-the-button>,
            cancel:<boolean-to-show-cancel-stlye>,
            default:<boolean-to-show-default-style>,
            click:<function-definition>
        }
    }

· button-id is the id of this button, if the close callback is defined, the button-id name will be passed as string or
if the controller have a function with the same id will be executed instead.
· function-definition if defined then this function is executed instead of controller's one.

Multiple buttons can be defined in the definition object.
