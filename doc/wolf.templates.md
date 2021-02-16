# Templates definitinos

    TODO: (used to reuse the html structure without fetching from server again, also for include templates inside templates)

# Template structure

    TODO: (about internal tamplate structure and meaning)

t (as template)
t.$t string with the name of the DOM tag, or null for text node representation
t.$ array of child elements or string/binding for text nodes can be undefined
t.#name represent the attribute named #name and the string/binding value
t.$e a dictionary with all events, can be undefined

# Template types

    TODO: (about wolf: and non wolf: templates)

# Tamplate events

    about available events where to set and were are raised

## t.$init(template)

    Used on wolf elements, raised when reading the template with al information and child information has been loaded.
    Template instance is passed by parameter.
    the returned value will replace the tamplate definition in the tempalte tree, a return of null will omit the template at all and returning undefined will no take effect.

## t.$ctor(element, template, context)

    Used on wolf elements, raised when rendering the DOM of the template but the DOM is not inserted in the document yet.
    The DOM element, the rendered template and the context object are passed.

## ext.onRender(element, template, context)

    Used on Context object 
    The DOM element, the rendered template and the context object are passed.
