# NAVIGATOR

TODO!

# READ

TODO!

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