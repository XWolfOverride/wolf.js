# NAVIGATOR

As the application can be divided into multiple fragments the fragment composition in screen can be automated with paths in the URL hash creating
an effect of paths inside the page.

For this wolf provide the Navigator object.

A navigator can be created using:

    wolf.createNavigator(element, "app/navigation.json", (navigator) => {
    });

The first parameter is the element that will handle the navigation this must be a framework managed element, the application root is recommended refer to [introduction](wolf.introduction.md).
The second is the path of the navigation json containing all the navigation definitnion.
The third is a callback, executed when the navigation is loaded and first navigation raised.

## NAVIGATION PATH

The navigator uses a path after the hash symbol in the url to create the ilusion of a filesystem based on path patterns.

## NAVIGATION DEFINITION JSON

The navigation file is a json object with the next structure

    {
        "<navigationid>":{
            "pattern":"<pattern definition>",
            "set":{
                // simple definition
                "<element id>":"<file to include>",
                // extended definition
                "<element id>":{
                    "to":"<file to include>",
                    "event":"<event name to raise in the included controller>",
                    "then":{
                        //more elements to map once this fragment is ready, same structure as "set" node.
                    }
            },
            "event":"<event name to raise when all "set" elements are ready with all the "then" dependencies in the controller of the first "set" element>"
        }
    }

· <navigationid> is the id of the navigation, any navigation order will use this id.
· <pattern definition> is the path pattern to use for this navigation, can contain data parts, see path structure section below.
· <element id> is the id of an element in the HTML that will hold the included html, refer to [introduction](wolf.introduction.md) for details about fragments and inclusion.
· <file to include> is the path of the html fragment file to include.
· <event name to raise in the included controller> is the name of the event inside the loaded fragment controller that will be executed when this fragment is ready ignoring the status of any sub include.
· <event name to raise when all "set" elements are ready with all the "then" dependencies in the controller of the first "set" element> is the name of the event inside the first element controller to be executed when all the navigation process is ready.

Note: The "then" section on a extended definitnion will be processed only when the "to" file to include has been satisfied and all the new DOM ready.

Note: If any of the event names have a "/" starting character, the event is executed on the application controller instead.

## PATH STRUCTURE

TODO!