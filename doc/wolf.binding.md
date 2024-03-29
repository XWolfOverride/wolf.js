# DATA NAVIGATOR

Wolf.js expands the root object prototype with the navigate function, this navigate function allow datan path navigation with null controls and data processors execution.

For examble with this object:

    var data={
        "author":"PMS",
        "books":[
            {
                "title":"The very first",
                "date":"12-12-1866",
                "publishedBy":{
                    "name":"Ancient publisher"
                }
            }
        ]
    }

is easy to get the name of the publisher of the first book with:

    data.navigate("books/0/publishedBy/name");

note the usage of the index in arrays.

or the title:

    data.navigate("books/0/title");

but if the path refer to the next book or the first book does not exists this return undefined, and do not throw any errors.

## NAVIGATOR PROCESSORS

TODO!

# MODEL

TODO!

# READ & BIND

Using the data navigator rules, any field or text node defined in the html between { and } will refer to this path and the data will be used instead of the text.

if the binding is done in a HTML attribute and the result is null, undefined or empty string, the attribute will not be drawn on HTML.
if it is a text node the text node will be empty.

the binding can be mixed with literals:

    <div>And the winner is {winner}.</div>

or

    <img src="images/{picture}.jpg">

in this case a null or undefined data will have the same effect as an empty string.

The reference between the HTML element and the data path is maintaned and handled in the way that any chagne to the model will update automatically the HTML on screen

# WRITE
By default wolf framework does not write back the data on form inputs to the model when changes but there is a way to define it using the wolf:write attribute.

The wolf:write attribute uses a string with up to tree parts separated by colon (:) character
the parts are:

    <wolf:write="event:modelpath:valuepath"></wolf>

where:
· __event__ is the DOM event raised by the HTML element when data is edited (Ex: change event for input, or input event on contenteditable=true elements) can be omitted, by default is "change"
· __modelpath__ is the path in the model where the data will be writen, the path follows all the navigator rules, context path is used.
· __valuepath__ is the path from the element instance with the value to be saved, the path follows all the navigator rules.

There is also special cases for wolf:write

if wolf:write attribute is defined wihtout value or with a value of "" an automatic assignment logic is fired. Works for input elements with simple bindings

if wolf:write is set to "none" then the wolf:write is not set for this input this key is needed to ignore elements when the wolf_write attribute is set to automatic on the framework configuration.

## Automatic write configuration

with __wolf.configuration.autoWriteBinding__ (default false) the wolf:write attribute is applied to all supported elements.