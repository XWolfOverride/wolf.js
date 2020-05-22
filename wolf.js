/*  wolf 0.6, a lightweight framework for web page creation.
 *  Copyright 2020 XWolfOverride (under lockdown)
 *
 *  Licensed under the MIT License
 * 
 *  Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 *  and associated documentation files (the "Software"), to deal in the Software without restriction,
 *  including without limitation the rights to use, copy, modify, merge, publish, distribute,
 *  sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 * 
 *  The above copyright notice and this permission notice shall be included in all copies or
 *  substantial portions of the Software.
 * 
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
 *  BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 *  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 *  DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * @typedef {object} element DOM element node
 */

var wolf = (() => {
    'use strict';

    // ==== Global tools ==== 
    if (!Object.prototype.merge)
        Object.defineProperty(Object.prototype, "merge", {
            writable: true,
            value: function (src) {
                if (!src)
                    return this;
                for (var key in src)
                    this[key] = src[key];
                return this;
            }
        });

    window.byId = id => document.getElementById(id);

    // ==== Kernel ==== resources loading, initializaiton and process handling
    var K = (() => {
        var objs = {}; //Map of objects by url

        /**
         * Declare an xWeb object,
         * any string parameter will be treated as dependence and the object parameter will be loaded and
         * passed prior to the object initialization function.
         * @param {object} objd object definition
         * @param {function} [callback] callback to be called once the object has been loaded
         */
        function instantiate(objd, callback) {
            var deps = {};
            var constructor;
            // ==== Process arguments
            for (var i in objd) {
                var a = objd[i];
                switch (typeof (a)) {
                    case "string":
                        deps[a] = null;
                        break;
                    case "function":
                        if (constructor)
                            throw new Error("Object definition with multiple constructors");
                        constructor = a;
                }
            }
            if (!constructor)
                throw new Error("Object definition without logic body");
            // ==== Process dependencies
            function checkFinish() {
                if (!constructor)
                    return;
                for (var a in deps) {
                    if (!deps[a])
                        return;
                }
                var args = [];
                for (var a in deps)
                    args.push(deps[a]);
                var obj = constructor.apply({}, args);
                constructor = null;
                callback && callback(obj);
            }
            function checkFactory(name) { //Function factory, a way to isaolate parameter value by scope
                return (obj) => {
                    deps[name] = obj;
                    checkFinish();
                }
            }
            for (var i in deps)
                require(i, checkFactory(i));
            checkFinish();
        }

        /**
         * Fetch an object from url and instantiate
         * @param {string} url Url of object to fetch
         * @param {function} [callback] callback to be called once the object has been loaded
         * @param {fetcher_callfail} [callfail] callback to be called once the object has been loaded
         */
        function require(url, callback) {
            if (!url)
                return;
            url = new URL(url, document.baseURI).href;
            var obj = objs[url];
            if (!obj) {
                TOOLS.wGet(url, data => {
                    var inc = Function(`'use strict';return ${data};\n//# sourceURL=${url}`);
                    instantiate(inc(), (lobj) => {
                        objs[url] = lobj;
                        callback && callback(lobj);
                    });
                });
            } else
                callback && callback(obj);
        }

        /**
         * Object for callback storage and handling
         * @constructor
         */
        function CallbackList() { // Meant to be used with 'new' instanciation, do not use the return object
            var cbs = [];

            /**
             * Add the callback to the list of pending callbacks to be executed
             * @param {function} callback callback to add
             * @param {*} ctx context of the callback
             * @param {array} params parameters to use on execution (see fire) 
             */
            function add(callback, ctx, params) {
                callback && cbs.push({ cb: callback, ctx: ctx, p: params });
            }

            /**
             * Execute the callback list in order of adding, if params argument is not null the add params will be ignored 
             * @param {array} params execute all the callbacks with this parameters and not the one specified in add method
             */
            function fire(params) {
                var cblist = cbs;
                cbs = []; //Clear callback list and avoid execution repetition
                for (var i in cblist) {
                    var cb = cblist[i];
                    cb.cb.apply(cb.ctx, params ? params : cb.p);
                }
            }

            this.add = add;
            this.fire = fire;
        };

        /**
         * Load Handler for multiple load control.
         * Create a new instance with new, passing the callback to execute when on finished.
         * Before starting a load request, call method enter()
         * Once data is dloaded, call the leave() method
         * If the last leave is called, then the onFinish callback gets executed
         * @param {function} onFinish 
         */
        function LoadHandler(onFinish) {
            var counter = 0;
            onFinish = [onFinish];
            function fireFinish() {
                for (var i in onFinish)
                    onFinish[i]();
            }
            /**
             * Enter one level of wait state
             */
            this.enter = function () {
                counter++;
            }
            /**
             * Leaves one level of wait state, when all wait states gets clear then fires onFinish.
             */
            this.leave = function () {
                counter--;
                if (counter <= 0) {
                    counter = 0;
                    fireFinish();
                }
            }
            /**
             * Clear all the wait states and fire onFinish.
             */
            this.clear = function () {
                counter = 0;
                fireFinish();
            }
            /**
             * Returns true if the onFinis has been fired.
             */
            this.isDone = function () {
                return coutner == 0;
            }

            /**
             * Add another callback to execute when wait states cleared.
             * Callbacks are executed sequentially
             * @param {function} functionFinish callback to add
             */
            this.addFinish = function (functionFinish) {
                onFinish.push(functionFinish);
            }
        }

        return {
            require: require,
            CallbackList: CallbackList,
            LoadHandler: LoadHandler,
        }
    })();

    // ==== Data === data model and binding
    var D = (() => {
        var processors = {};
        var model = new Model();

        /**
         * Navigate object properties and sub-objects based on path string separated by '/'.
         *  - Array index are treated as another property.
         *  if the path contains a part starting with '^' this data in the path will be passed to a processor function
         * @param {*} data Object to navigate properties
         * @param {string|string[]} path Path of desired data on object, can be an array of paths, in case of array of paths the first one with data will be returned
         * @param {*} [context] context object, if supplied context objects will be passed to processors
         * @param {element} [context.element] DOM element of data processed when calling from binding
         */
        function getProperty(data, path, context) {
            if (!path)
                return data;
            if (Array.isArray(path)) {//Array path search
                var value;
                for (var i in path) {
                    value = getProperty(data, path[i], context);
                    if (value !== undefined)
                        return value;
                }
                return;
            }
            var npath = path.split('/');
            var pdata = data;
            for (var i in npath) {
                var part = npath[i];
                if (!part)
                    continue; // "" return same object "////" is the same object too and this is good
                if (part[0] == '^') { //Apply processor
                    var procName = part.substr(1);
                    var fmt = processors[procName];
                    if (fmt)
                        pdata = fmt(pdata, context);
                    else
                        throw new Error("Processor '" + procName + "' not found.");
                } else
                    pdata = pdata ? pdata[part] : undefined;
            }
            return (pdata);
        }

        /**
         * Navigate object properties and sub-objects based on path string separated by '/' and sets the value at the end
         *  - Array index are treated as another property.
         *  if the path contains a part starting with '^' this data in the path will be passed to a processor function
         *  if the last node is a processor the value will be passed to the processor.
         * @param {*} data Object to navigate properties.
         * @param {string} path Path of desired data on object, can be an array of paths, in case of array of paths the first one with data will be returned.
         * @param {*} value Value to set on object's path.
         * @param {*} [context] context object, if supplied context objects will be passed to processors.
         * @param {element} [context.element] DOM element of data processed when calling from binding.
         */
        function setProperty(data, path, value, context) {
            if (!path)
                throw new Error("Path needed");
            var npath = path.split('/');
            var pdata = data;
            var ilast = npath.length - 1;
            for (var i = 0; i < ilast; i++) {
                var part = npath[i];
                if (!part)
                    continue; // "" return same object "////" is the same object too
                if (part[0] == '^') { //Apply processor (for GET here)
                    var procName = part.substr(1);
                    var fmt = processors[procName];
                    if (fmt)
                        pdata = fmt(pdata, context);
                    else
                        throw new Error("Processor '" + procName + "' not found.");
                    if (!pdata) {
                        console.warn("A path processor broke the navigation.");
                    }
                } else {
                    if (!pdata[part])
                        pdata = pdata[part] = {};
                    else
                        pdata = pdata[part];
                }
            }
            var part = npath[ilast];
            if (!part)
                throw new Error("Path missing last path node, last path node can't be missing");
            if (part[0] == '^') { //Apply processor (for SET here)
                var procName = part.substr(1);
                var fmt = processors[procName];
                if (fmt)
                    fmt(pdata, value, context);
                else
                    throw new Error("Processor '" + procName + "' not found on set.");
            } else
                pdata[part] = value;
        }

        if (!Object.prototype.navigate)
            Object.defineProperty(Object.prototype, "navigate", {
                writable: true,
                value: function (path, context) {
                    return getProperty(this, path, context);
                }
            });

        /**
         * Register a processors in available processors
         * @param {string} name name of processors (without '^')
         * @param {processor_callback} callback 
         * @callback processor_callback
         * @param {*} data data to process
         * @param {*} [context] additional data
         * @param {element} [context.element] DOM element of data processed when calling from binding
         */
        function registerDataProcessor(name, callback) {
            processors[name] = callback;
        }

        /**
         * Return the current model
         */
        function getModel() {
            return model;
        }

        /**
         * Manages the model of data
         * @param {*} data data for this model
         */
        function Model(data) {
            data = data || {};
            var bindings = {};
            /**
             * Return the data on de model at that path
             * @param {string} path 
             * @param {*} context 
             */
            function getModelProperty(path, context) {
                return getProperty(data, path, context);
            }

            /**
             * Sets the data on the model at that path
             * @param {string} path 
             * @param {*} value 
             * @param {*} context 
             */
            function setModelProperty(path, value, context) {
                setProperty(data, path, value, context);
                refreshModelPath(path);
            }

            /**
             * Refresh all the bindings on the specified path and childs
             * @param {string} path Path where start updating
             */
            function refreshModelPath(path) {
                if (path == '/')
                    path = undefined;
                else if (path && path[0] != '/')
                    path = '/' + path;
                for (var p in bindings) {
                    if (!path ||
                        (p.length == path.length && p == path) ||
                        (p.length > path.length && p.substr(0, path.length) == path && p[path.length] == '/')) {
                        var blist = bindings[p];
                        var i = 0;
                        while (i < blist.length) {
                            var bindEx = blist[i];
                            if (!document.body.contains(bindEx.node))
                                blist.splice(i, 1);
                            else {
                                if (bindEx.write)
                                    bindEx.write();
                                i++;
                            }
                        }
                    }
                }
            }

            /**
             * Refresh all bindings of this element and childs
             * @param {element} element 
             */
            function refreshModelElement(element) {
                for (var p in bindings) {
                    bindings[p].forEach(bindEx => {
                        if (element.contains(bindEx.node) && bindEx.write)
                            bindEx.write();
                    });
                }
            }

            /**
             * Register the binding executor for a binding path in this model
             * @param {string} path Binding path
             * @param {*} bexec Binding executor object
             * @param {*} bexec.node Node or element for bind (if the element is not on document the binding executor gets erased)
             * @param {*} bexec.read Read function
             * @param {*} bexec.write Write function
             */
            function registerBindingExecutor(path, binding) {
                if (path && path[0] != '/')
                    path = '/' + path;
                var blist = bindings[path];
                if (!blist) {
                    blist = bindings[path] = [];
                }
                blist.push(binding);
            }

            this.getProperty = getModelProperty;
            this.setProperty = setModelProperty;
            this.refresh = refreshModelPath;
            this.refreshElement = refreshModelElement;
            this.registerBindingExecutor = registerBindingExecutor;
        }

        /**
         * Creates a data binding, a binding begins with '{' and ends with '}'
         * @param {string} path path of binding
         */
        function Binding(path) {
            function parseBinding(path) {
                var bindingParts = [];
                var value = "";
                var insideBind = false;
                for (var i in path) {
                    var ch = path[i];
                    if (insideBind) {
                        if (ch == '}') {
                            insideBind = false;
                            if (value)
                                bindingParts.push({ bind: true, path: value });
                            value = "";
                        } else
                            value += ch;
                    } else {
                        if (ch == '{') {
                            if (value)
                                bindingParts.push({ bind: false, value: value });
                            insideBind = true;
                            value = "";
                        } else {
                            value += ch;
                        }
                    }
                }
                if (insideBind)
                    throw new Error("Not closed binding.");
                if (value)
                    bindingParts.push({ bind: false, value: value });
                return bindingParts;
            }
            var parts = parseBinding(path);

            /**
             * Executes the binding and return the value 
             * @param {*} [context] additional data
             * @param {element} [context.element] DOM element of data processed when calling from binding
             * @param {string} [type] type of field if "string" undefined values will be returned as ""
             */
            function read(context, type) {
                var value;
                var contextPath = context.element.getContextPath;
                for (var i in parts) {
                    var part = parts[i];
                    var v;
                    if (part.bind) {
                        v = model.getProperty(contextPath(part.path), context);
                    } else
                        v = part.value;
                    if (value === undefined)
                        value = v;
                    else if (v !== undefined)// If v is undefined no concatenation is done at all
                        value = String(value) + v;
                }
                if (type === "string" && value === undefined)
                    value = "";
                return value;
            }

            /**
             * Register the binding executor for all binding parts
             * @param {*} bexec Binding executor object
             * @param {*} bexec.node Node or element for bind (if the element is not on document the binding executor gets erased)
             * @param {*} bexec.read Read function
             * @param {*} bexec.write Write function
             */
            function registerBindingExecutor(bexec) {
                for (var i in parts) {
                    var part = parts[i];
                    if (part.bind) {
                        var processoridx = part.path.indexOf("^");
                        if (processoridx >= 0) {
                            var path = part.path.substr(0, processoridx);
                            while (path && path[path.length - 1] == "/")
                                path = path.substr(0, path.length - 1);
                            model.registerBindingExecutor(path, bexec);
                        } else
                            model.registerBindingExecutor(part.path, bexec);
                    }
                }
                bexec.write();
            }

            /**
             * Binds a text node
             * @param {element} textNode text node to bind
             */
            function bindTextNode(textNode) {
                registerBindingExecutor({
                    node: textNode,
                    read: null,
                    write: function () {
                        textNode.nodeValue = read({ element: textNode }, "string");
                    }
                });
            }

            /**
             * Binds an element attribute
             * @param {*} element 
             * @param {*} attribute 
             */
            function bindElementAttribute(element, attribute) {
                //TODO: Register events for reading value
                function standard() {
                    return {
                        node: element,
                        read: null,
                        write: function () {
                            element.setAttribute(attribute, read({ element: element }, "string"));
                        }
                    }
                }
                switch (element.tagName) {
                    default:
                        registerBindingExecutor(standard());
                        break;
                }
                return element;
            }

            /**
             * Bind repeater nodes
             * @param {*} parent Parent node (for document localization)
             * @param {*} sibling Next sibling node (for document localization)
             * @param {*[]} templates template array of childs to add on each repetition 
             */
            function bindRepeater(parent, sibling, templates) {
                var repeatItems = [];
                if (parts.length != 1 || !parts[0].bind)
                    throw new Exception("wolf:repeat does not allow composed bindings, use single one");
                var pathbar = parts[0].path;
                if (pathbar && pathbar[pathbar.length - 1] != '/')
                    pathbar += '/';
                //v0.1 delete all and refill
                function populate(data) {
                    repeatItems.forEach(item => parent.removeChild(item));
                    repeatItems = []

                    if (!data || !data.forEach)
                        return; // Not an array binded
                    for (var k in data) {
                        templates.forEach(templ => {
                            var elements = UI.instanceTemplate(templ, { parent: parent, contextPath: pathbar + k });
                            elements.forEach(element => {
                                repeatItems.push(element);
                                parent.insertBefore(element, sibling);
                            });
                        })
                    }
                }
                registerBindingExecutor({
                    node: parent,
                    read: null,
                    write: function () {
                        populate(read({ element: parent, mode: "repeater" }));
                    }
                });
            }

            this.bindTextNode = bindTextNode;
            this.bindElementAttribute = bindElementAttribute;
            this.bindRepeater = bindRepeater;
        }

        return {
            getProperty: getProperty,
            setProperty: setProperty,
            registerDataProcessor: registerDataProcessor,
            getModel: getModel,
            Binding: Binding,
        };
    })()

    // ==== UI ==== screen elements and applications handling
    var UI = (() => {
        var frgs = {}, navigatorController;

        /** Initializes an application, an application is only a definition of the container element in the document
         * and the url of the application controller, a single web page can contains several applications
         * @param {string} ctrlUrl url for the application controller
         * @param {element} element the parent document element
         */
        function initApp(ctrlUrl, element) {
            K.require(ctrlUrl, (ctrl) => {
                processElement(element, {
                    type: "#app",
                    controller: ctrl,
                    a: {},
                    w: {}
                }, element.parentElement);
                if (ctrl.manifest) {
                    //process manifest here
                }
                if (ctrl.init) {
                    ctrl.init(element);
                }
            });
            // NOTE: data-stack es la pila de contextos de dato que se usa en la aplicación y en los bindings
        }

        var wolfElements = {
            /**
             * <wolf:fragment>
             * fragment definition, fragment can be loaded from urls and can have a cotnroller that is propagated on all childs
             */
            "fragment": {
                init: template => {
                    if (template.w.controller) {// Move controller
                        template.controller = template.w.controller;
                        delete template.w.controller;
                    }
                    if (template.w.id)
                        frgs["#" + template.w.id] = template;
                    /**
                     * Inserts the element into a parent element (replacing any content)
                     * @param {element} parentElement 
                     */
                    function insertTo(parentElement) {
                        var nodes = instanceTemplate(template, { parent: parentElement });
                        while (parentElement.childNodes.length > 0)
                            parentElement.removeChild(parentElement.childNodes[0]);
                        for (var i in nodes)
                            parentElement.appendChild(nodes[i]);
                        var ptmpl = parentElement.getTemplate();
                        if (!ptmpl.controller || ptmpl.fragmentedController) {
                            ptmpl.controller = template.controller;
                            ptmpl.fragmentedController = true;
                        }
                        if (template.controller && template.controller.init) {
                            template.controller.init(parentElement);
                        }
                    }
                    template.insertTo = insertTo;
                },
                ctor: (template, ext) => {
                    var nodes = [];
                    for (var i in template.c) {
                        var nns = instanceTemplate(template.c[i], ext);
                        for (var j in nns)
                            nodes.push(nns[j]);
                    }
                    return nodes;
                },
                id: {
                    bindable: false
                },
                controller: {
                    bindable: false
                }
            },

            /**
             * <wolf:repeat>
             * repeat all child elements, also adgust the context data for each repetition
             */
            "repeat": {
                init: template => {
                    if (!template.w.items)
                        throw new Error("item attribute is mandatory on wolf:repeat");
                    if (!(template.w.items instanceof D.Binding))
                        throw new Error("item attribute must be a binding wolf:repeat");
                    if (!template.c || !template.c.length == 0)
                        throw new Error("wolf:repeat requires a child");
                },
                ctor: template => {
                    var hook = document.createElement(template.c[0].type);
                    setTimeout(() => {
                        template.w.items.bindRepeater(hook.parentElement, hook.nextSibling, template.c);
                        hook.parentElement.removeChild(hook);//Clear hook
                    });
                    return [hook];
                },
                items: {
                    bindable: true,
                }
            }
        }

        /**
         *  Definitions for wolf tag attibutes when processing the elements.
         *  for extended processors with multiple options (for example events) use a # before the
         *  processor name (see event processor)
         */
        var wolfAttributes = (() => {
            return {
                /**
                 * wolf:include
                 * Includes an external HTML fragment into this element.
                 */
                "include": {
                    bindable: false,
                    processor: function (element, value, template) {
                        loadFragmentTo(value, element);
                    }
                },

                /**
                 * wolf:repeat
                 * alias for <wolf:repeat> element
                 */
                "repeat": {
                    bindable: true,
                    initTemplate: template => {
                        var items = template.w.repeat;
                        if (!(items instanceof D.Binding))
                            throw new Error("Only bindings can be used on xwolf:repeat");
                        delete template.w.repeat;
                        return {
                            type: "wolf:repeat",
                            w: { items: items },
                            c: [template]
                        };
                    }
                },

                /**
                 * wolf:context
                 * set a context path for this object
                 */
                "context": {
                    bindable: false,
                    processor: function (element, value, template) {
                        element.setContext(value);
                    }
                }
            }
        })();

        /**
         * Process an instance element from template
         * @param {element} element Element being process
         * @param {*} template Template of the element
         * @param {*} ext Extended data
         */
        function processElement(element, template, ext) {
            var contextPath = ext.contextPath;
            delete ext.contextPath;

            /**
             * Return the associated template to this element
             */
            function getTemplate() {
                return template;
            }

            /**
             * Return the controller assigned for the element
             */
            function getController() {
                var supervisor = getControllerElement();
                if (supervisor) {
                    var template = supervisor.getTemplate();
                    if (typeof (template.controller) == "string") {
                        throw new Error("Intermediate controllers not supported right now");
                        // // NOTE: Not optimal, but intermediate controllers are not optimal too.
                        // return await Promise.resolve({
                        //     then: (ok, ko) => {
                        //         K.require(template.controller, ctrl => {
                        //             ok(template.controller = ctrl);
                        //         });
                        //     }
                        // });
                    }
                    return template.controller;
                }
            }

            /**
             * Return the element having a controller influencing this element
             */
            function getControllerElement() {
                var node = element;
                while (node && node != document.documentElement) {
                    var template = node.getTemplate();
                    if (template && template.controller)
                        return node;
                    node = node.getParent();
                }
            }

            /**
             * Return the application controller owner of this element
             */
            function getApplicationController() {
                var app = getApplication();
                if (app)
                    return app.getTemplate().controller;
            }

            /**
             * Return the application of this element tree
             */
            function getApplication() {
                var node = element;
                while (node && node != document.documentElement) {
                    var template = node.getTemplate();
                    if (template && template.type == "#app")
                        return node;
                    node = node.getParent();
                }
            }

            /**
             * Search all the element tree (from this element) for an element with an id
             * @param {string} id id of element to search
             */
            function byId(id) {
                if (element.id == id)
                    return element;
                for (var i = 0; i < element.children.length; i++) {
                    var ele = element.children[i];
                    if (ele.byId) {
                        ele = ele.byId(id);
                        if (ele)
                            return ele;
                    }
                }
            }

            /**
             * Return the parent of theis element or a parent with a specified id
             * @param {string} [id] id of element 
             */
            function getParent(id) {
                var dad = element.parentElement || ext.parent;
                if (id) {
                    while (dad && dad != document.documentElement) {
                        if (dad.getTemplate && dad.getTemplate().type == "#app")
                            break;
                        if (dad.id == id)
                            return dad;
                        dad = dad.getParent ? dad.getParent() : dad.parentElement;
                    }
                } else
                    return dad;
            }

            /**
             * Sets the binding context data, updates all child nodes with relative bindings
             * @param {*} data 
             */
            function setContextPath(path) {
                contextPath = path;
                D.getModel().refreshElement(element);
            }

            /**
             * Get the current binding context data
             * @param {string} path Path for composing
             */
            function getContextPath(path) {
                // Absolute path
                if (path && path[0] == '/')
                    return path;
                var base;
                if (template.type != "#app") {
                    base = element.getParent().getContextPath();
                    if (!base)
                        base = contextPath;
                    else {
                        if (base[base.length - 1] != '/')
                            base += '/';
                        if (contextPath)
                            base = base + contextPath;
                    }
                } else
                    base = contextPath;
                if (!base)
                    return path;
                if (path) {
                    if (base[base.length - 1] != '/')
                        base += '/';
                    base += path;
                }
                return base;
            }

            /**
             * Include a fragment into this element
             * @param {string} url 
             * @param {loadFragmentTo_callback} callback Called once fragment has been loaded and set on element
             */
            function include(url, callback) {
                loadFragmentTo(url, element, callback);
            }

            if (!template.type) {
                element.merge({
                    // Wolfed text node API
                    getParent: getParent,
                    getContextPath: getContextPath,
                });
                return;
            }

            element.merge({
                // Wolfed element API
                getTemplate: getTemplate,
                getController: getController,
                getControllerElement: getControllerElement,
                getApplication: getApplication,
                getApplicationController: getApplicationController,
                byId: byId,
                getParent: getParent,
                setContextPath: setContextPath,
                getContextPath: getContextPath,
                include: include,
            });

            // process standard attributes
            for (var k in template.a) {
                var value = template.a[k];
                if (value instanceof D.Binding)
                    value.bindElementAttribute(element, k);
                else
                    element.setAttribute(k, value);
            }
            // process wolf attributes
            for (var k in template.w) {
                var wattr = wolfAttributes[k];
                wattr.processor(element, template.w[k], template);
            }
            // process events
            function installEvent(event, method) {
                element.addEventListener(event, (evt) => {
                    var ctrl = element.getController();
                    var evtMethod = ctrl[method];
                    if (!evtMethod)
                        throw new Error(`event '${k}' method '${method}' not found.`);
                    evtMethod(element, evt);
                });
            }
            if (template.e)
                for (var k in template.e)
                    installEvent(k, template.e[k]);
        }

        /**
         * Instantiate element from template
         * @param {*} template Template to intantiate
         * @param {*} ext Extended info
         * @param {element} ext.parent Node parent
         * @param {string} [ext.contextPath] Initial context path
         * @returns {element[]} Array with nodes on template
         */
        function instanceTemplate(template, ext) {
            if (!template.type) {
                var tnode = document.createTextNode("");
                processElement(tnode, template, ext);
                if (template.value instanceof D.Binding)
                    template.value.bindTextNode(tnode);
                else
                    tnode.nodeValue = template.value;
                return [tnode];
            } else if (template.type.substr(0, 5) == "wolf:") {
                return wolfElements[template.type.substr(5)].ctor(template, ext);
            } else {
                var node = document.createElement(template.type);
                processElement(node, template, ext);
                for (var i in template.c) {
                    var nns = instanceTemplate(template.c[i], { parent: node });
                    for (var j in nns)
                        node.appendChild(nns[j]);
                }
                return [node];
            }
        }
        /**
         * Process an element template and it's childs, preparing the logics and binding maps
         * @param {element} element 
         */
        function readTemplate(node) {
            /**
             * @callback readTemplate_callback
             * @param {*} template template processed completely
             */

            var templ = {
                type: null,
                w: {},
                a: {},
                c: [],
            }, initiators = [];

            function valOrBinding(val) {
                if (typeof (val) === "string" && val.indexOf('{') >= 0)
                    return new D.Binding(val);
                return val;
            }

            if (node.nodeType == 8) {
                //Ignore element (commentary)
                return null;
            } else if (node.nodeType == 3) {
                var val = node.nodeValue;
                if (!val.trim())
                    return null;
                templ.value = valOrBinding(val);
            } else {
                templ.type = node.tagName.toLowerCase();
                if (templ.type.substr(0, 5) == "wolf:") {// Wolf element!
                    var wdef = wolfElements[templ.type.substr(5)];
                    if (!wdef)
                        throw new Error("Unknown element: " + templ.type);
                    node.getAttributeNames().forEach(attr => {
                        if (attr == "init")
                            throw new Error("init is a reserved attribute");
                        if (attr == "ctor")
                            throw new Error("ctor is a reserved attribute");
                        var attri = wdef[attr];
                        if (!attri)
                            throw new Error(templ.type + " does not allow " + attr + " attribute");
                        var aval = valOrBinding(node.getAttribute(attr));
                        if ((aval instanceof D.Binding) && !attri.bindable)
                            throw new Error(templ.type + " attribute " + attr + " can not be binded");
                        templ.w[attr] = aval;
                    });
                    wdef.init && wdef.init(templ);
                } else {
                    var attrs = node.getAttributeNames();
                    for (var i in attrs) {
                        var attr = attrs[i];
                        var aval = valOrBinding(node.getAttribute(attr));

                        if (attr && attr.substr(0, 6) == "event:") {
                            attr = attr.substr(6);
                            if (aval instanceof D.Binding)
                                throw new Error("Events can not be binded");
                            if (!templ.e)
                                templ.e = {};
                            templ.e[attr] = aval;
                        }
                        if (attr && attr.substr(0, 5) == "wolf:") {
                            attr = attr.substr(5);
                            var wattr = wolfAttributes[attr];
                            if (!wattr)
                                throw new Error("Unknown attribute wolf:" + attr);
                            if (aval instanceof D.Binding && !wattr.bindable)
                                throw new Error("wolf:" + attr + " does not allow binding");
                            templ.w[attr] = aval;
                            if (wattr.initTemplate)
                                initiators.push(wattr.initTemplate);
                        } else if (attr && attr.substr(0, 5) == "bind:") {
                            if (!(aval instanceof D.Binding))
                                throw new Error("Use bind:#### attributes only for binding");
                            templ.a[attr.substr(5)] = aval;
                        } else {
                            // if (aval instanceof D.Binding) //Force unbinded items?
                            //     throw new Error("Use bind: attributes for binding");
                            templ.a[attr] = aval;
                        }
                    }
                }

                // Process childs
                for (var ci = 0; ci < node.childNodes.length; ci++) {
                    var tn = readTemplate(node.childNodes[ci]);
                    if (tn)
                        templ.c.push(tn);
                }

                initiators.forEach(init => {
                    //TODO: do not like this solution, maily for wolf:repeat attribute because <wolf:repeat> element
                    //      get relocated then repeating tr or tds inside a table.
                    //      Better try to parse the HTML manually when reading templates to avoid node relocations
                    templ = init(templ);
                });
            }
            return templ;
        }

        /**
         * Process the fragment template and create the fragment object and template-ready methods
         * @param {*} fragmentElement template element to prepare
         * @param {processFragmentTemplate_callback} [callback] callback when template preparation has been done
         */
        function processFragmentTemplate(fragmentElement, callback) {
            // TODO Combie with Read Template and create an unified way to treat element templates
            //  --- Needed for template repetitions
            var fragment = readTemplate(fragmentElement);

            if (fragment.controller && typeof (fragment.controller) === "string") {
                K.require(fragment.controller, (ctrl) => {
                    fragment.controller = ctrl;
                    callback && callback(fragment);
                });
            } else callback && callback(fragment);
        }

        /**
         * Load a fragment from the url and creates the internal fragment template
         * @param {string} url url of the fragment to load
         * @param {loadFragment_callback} [callback] callback to execute when the fragment has been loaded
         */
        function loadFragment(url, callback) {
            /**
             * @callback loadFragment_callback
             * @param {*} fragment Loaded fragment template
             */
            var fragment = frgs[url];
            if (!fragment) {
                if (url.length > 0 && url[0] == '#')
                    throw new Error("named fragment '" + url + "' not loaded");
                var cbl = frgs[url] = new K.CallbackList(); //temporal CBL
                cbl.add(callback);
                TOOLS.wGet(url, html => {
                    var rootElement = document.createElement("wolf:fragment");
                    rootElement.innerHTML = html;
                    if (rootElement.children.length == 1 && rootElement.children[0].tagName == "WOLF:FRAGMENT")
                        rootElement = rootElement.children[0];
                    processFragmentTemplate(rootElement, (fragment) => {
                        cbl.fire([frgs[url] = fragment]);
                    });
                });
            } else {
                if (fragment instanceof K.CallbackList)
                    fragment.add(callback);
                else
                    callback(fragment);
            }
        }

        /**
         * Load a fragment from URL and inserts into element replacing it's content
         * @param {string} url URL of the fragment to load
         * @param {element} element Element where set the fragment
         * @param {loadFragmentTo_callback} callback Called once fragment has been loaded and set on element
         */
        function loadFragmentTo(url, element, callback) {
            /**
             * @callback loadFragment_callback
             * @param {*} fragment Loaded fragment template
             * @param {element} element Element to insert fragment
             */
            loadFragment(url, (fragment) => {
                fragment.insertTo(element);
                callback && callback(fragment, element);
            });
        }

        /**
         * Importa un recurso js o css a la página
         * @param {string} url Url of the resource to add
         * @param {string} [type] Type of resource, if none the type will be the url file extension
         */
        function importResource(url, type) {
            //Detect type
            if (!type) {
                var filePath = new URL(url, document.baseURI).pathname;
                var dp = filePath.lastIndexOf(".");
                if (dp < 0) {
                    console && console.error(`Can not detect resource type by url '${url}'. Aborting!`);
                    return;
                }
                type = filePath.substr(dp + 1);
                if (!type) {
                    console && console.error(`Can not detect resource type by url '${url}'. Aborting!`);
                    return;
                }
            }
            type = type.toLowerCase();
            switch (type) {
                case "css":
                    var elink = document.createElement("link");
                    elink.href = url;
                    elink.rel = "stylesheet";
                    document.head.appendChild(elink);
                    break;
                case "js":
                    var escript = document.createElement("script");
                    escript.src = url;
                    document.head.appendChild(escript);
                    break;
            }
        }

        /**
         * Links a navigation controller to the element
         * @param {element} element navigation controller root element
         * @param {string|object} navigationMap navigation map as JSON object or string with url of JSON
         * @param {function} callback callback when navigation is ready or when naivgation event occurs
         */
        function createNavigator(element, navigationMap, callback) {
            if (!navigatorController) {
                //Create navigation controller object
                navigatorController = (() => {
                    var navs = [];

                    function registerNavigator(element, navigator) {
                        navs.push({ element: element, navigator: navigator });
                    }

                    function processHash(hash) {
                        //TODO get all navigators and procedd to hash change
                        for (var i in navs) {
                            var nav = navs[i];
                            if (document.body.contains(nav.element)) //only for active document elements
                                nav.navigator.processHash(hash);
                        }
                    }

                    window.addEventListener("hashchange", () => {
                        processHash(document.location.hash);
                    }, false);

                    return {
                        registerNavigator: registerNavigator,
                    }
                })();
            }
            if (!element.getController)
                throw Error("Only valid for elements inside wolf context");

            /**
             * Executes the navigation with specified id, if the navigation terget is already done does not reload it.
             * @param {string} id id on the navigation map to execute 
             * @param {object} [data] data of the navigation if any
             */
            function doNav(id, data) {
                var navEntry = navigationMap[id];
                if (!navEntry)
                    return;

                document.location.hash = navEntry.pattern;

                var lh = new K.LoadHandler(() => {
                    if (navEntry.event) {
                        var ctrl = element.getController();
                        if (ctrl[navEntry.event])
                            ctrl[navEntry.event](id, data);
                    }
                });

                if (navEntry.set) {
                    for (var k in navEntry.set) {
                        var dest = navEntry.set[k];
                        var elem = document.getElementById(k);
                        if (elem) {
                            lh.enter();
                            loadFragmentTo(dest, elem, () => {
                                lh.leave();
                            });
                        }
                    }
                } else { lh.clear(); }
            }

            /**
             * Executes the navigation with specified id, if the navigation terget is already done does not reload it.
             * @param {string} id id on the navigation map to execute 
             * @param {object} [data] data of the navigation if any
             */
            function navTo(id, data) {
                var navEntry = navigationMap[id];
                if (!navEntry)
                    return;

                document.location.hash = navEntry.pattern; //TODO: Process data and complex patterns
            }

            /**
             * Process the hash string and executes the corresponding navigation
             * @param {string} hash 
             */
            function processHash(hash) {
                if (!hash)
                    hash = "";
                if (hash.length > 0 && hash[0] == '#')
                    hash = hash.substr(1);
                // hash = hash.split('/'); TODO: Process data and complex patterns
                for (var k in navigationMap) {
                    var navEntry = navigationMap[k];
                    if (navEntry.pattern == hash)
                        doNav(k);
                }
            }

            var nav = element.navigator = {
                navTo: navTo,
                processHash: processHash,
            }

            navigatorController.registerNavigator(element, nav);

            /**
             * navigation creation commiter
             * @param {function} cb 
             */
            function initNavigation(cb) {
                nav.processHash(document.location.hash);
                cb && cb(nav);
            }

            if (typeof (navigationMap) === 'string') {
                TOOLS.loadJSON(navigationMap, data => {
                    navigationMap = data;
                    initNavigation(callback);
                }, e => {
                    throw new Error("Can't load the navigation map at: " + navigationMap);
                });
            } else {
                initNavigation(callback);
            }
            return nav;
        }

        return {
            initApp: initApp,
            instanceTemplate: instanceTemplate,
            loadFragment: loadFragment,
            loadFragmentTo: loadFragmentTo,
            import: importResource,
            createNavigator: createNavigator,
        }
    })();

    // ==== TOOLS ==== collection of utility functions
    var TOOLS = (() => {

        /**
         * Process a fetch operation under the wolf standards
         * @param {string} url Url to fetch
         * @param {string} type Type of data to fetch ("text","json","blob","formData","arrayBuffer")
         * @param {fetcher_callback} callback Callback when data is OK
         * @param {fetcher_callfail} [callfail] Callback on fail
         */
        function fetcher(url, type, callback, callfail) {
            /**
             * @callback fetcher_callback
             * @param {*} data Loaded data 
             */
            /**
             * @callback fetcher_callfail
             * @param {error} error Error object
             * @param {string} stage Error stage
             */
            /**
             * Process the error of the fetch
             * @param {error} error 
             * @param {string} stage 
             */
            function fail(error, stage) {
                if (callfail)
                    callfail(error, stage);
                else
                    console.error(error, stage);
            }
            if (!url) {
                fail(new Error("Missing url"), "init");
                return;
            }
            if (!type) {
                fail(new Error("Missing data type"), "init");
                return;
            }
            fetch(url, {
                credentials: "same-origin"
            }).then(r => {
                if (r.ok) {
                    r[type]()
                        .then(data => callback(data))
                        .catch(e => fail(e, "process"));
                } else {
                    fail({ status: r.status, text: r.statusText }, "http")
                }
            }).catch(e => fail(e, "net"));
        }

        /**
         * Ajax call to fetch text resources
         * @param {string} url Url of the resource
         * @param {fetcher_callback} callback Callback when data is OK
         * @param {fetcher_callfail} callfail Callback on fail
         */
        function wGet(url, callback, callfail) {
            fetcher(url, "text", callback, callfail);
        }

        /**
         * Ajax call to fetch JSON resources
         * @param {string} url Url of the JSON file
         * @param {fetcher_callback} callback Callback when data is OK
         * @param {fetcher_callfail} callfail Callback on fail
         */
        function loadJSON(url, callback, callfail) {
            fetcher(url, "json", callback, callfail);
        }

        return {
            fetch: fetcher,
            wGet: wGet,
            loadJSON: loadJSON,
        }
    })()

    /**
     * Create an extension of wolf framework
     * @param {function} extender The function that installs the extension
     */
    function wolfExtension(extender) {
        extender(K, D, UI, TOOLS);
    }

    return {
        // Kernel
        require: K.require,
        wolfExtension: wolfExtension,
        CallbackList: K.CallbackList,
        LoadHandler: K.LoadHandler,
        // Data
        getProperty: D.getProperty,
        setProperty: D.setProperty,
        registerDataProcessor: D.registerDataProcessor,
        getModel: D.getModel,
        // UI
        initApp: UI.initApp,
        loadFragment: UI.loadFragment,
        loadFragmentTo: UI.loadFragmentTo,
        import: UI.import,
        createNavigator: UI.createNavigator,
        // Tools
        wGet: TOOLS.wget,
        loadJSON: TOOLS.loadJSON,
    };
})();