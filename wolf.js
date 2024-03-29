/*  wolf 0.7, a lightweight framework for web page creation.
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

var wolf = (function () {
    'use strict';

    // ==== PolyFills (IE 11 support) ====
    function checkPolyFills() {
        if (typeof window["URL"] !== 'function')
            UI.import("https://cdn.polyfill.io/v2/polyfill.min.js", "js");

        if (typeof window["Promise"] !== 'function')
            UI.import("https://cdn.jsdelivr.net/npm/promise-polyfill@8.1.3/dist/polyfill.min.js", "js");

        if (typeof window["fetch"] !== 'function')
            UI.import("https://cdn.jsdelivr.net/npm/whatwg-fetch@3.4.0/dist/fetch.umd.min.js", "js");

        if (!Element.prototype.getAttributeNames) {
            Element.prototype.getAttributeNames = function () {
                var result = [];
                for (var i = 0; i < this.attributes.length; i++)
                    result.push(this.attributes[i].name);
                return result;
            }
        }
    }

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

    window.byId = function (id) { document.getElementById(id) };

    // ==== Kernel ==== resources loading, initializaiton and process handling
    var K = (function () {
        var objs = {}; //Map of objects by url
        var configuration = {
            trimTextNodes: true, //Trim emtpy text nodes between elements
            autoWriteBinding: false, //Install the write procedure on binded inputs
        };

        /**
         * Declare an xWeb object,
         * any string parameter will be treated as dependence and the object parameter will be loaded and
         * passed prior to the object initialization function.
         * @param {object} objd object definition
         * @param {function} [callback] callback to be called once the object has been loaded
         * @param {string} url url of instantiated code
         */
        function instantiate(objd, callback, url) {
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
                return function (obj) {
                    deps[name] = obj;
                    checkFinish();
                }
            }
            function loadDependency(name) {
                require(name, checkFactory(name), function (error) {
                    var err = error && error.stack ? error.stack : error;
                    console.error("Error loading module '" + url + "', can not load dependency '" + name + "': " + err);
                });
            }
            for (var i in deps)
                loadDependency(i);
            checkFinish();
        }

        /**
         * Fetch an object from url and instantiate
         * @param {string} url Url of object to fetch
         * @param {function} [callback] callback to be called once the object has been loaded
         * @param {fetcher_callfail} [callfail] callback to be called once the object has been loaded
         */
        function require(url, callback, callfail) {
            if (!url)
                return;
            url = new URL(url, document.baseURI).href;
            var obj = objs[url];
            if (!obj) {
                TOOLS.wGet(url, function (data) {
                    try {
                        var inc = Function("'use strict';return " + data + ";\n//# sourceURL=" + url);
                    } catch (e) {
                        console.error("Error in module '" + url + "' parsing file: " + e.message, e);
                        throw new Error("Error in module '" + url + "' parsing file: " + e.message);
                    }
                    instantiate(inc(), function (lobj) {
                        objs[url] = lobj;
                        callback && callback(lobj);
                    }, url);
                }, function (error, stage) {
                    if (error && error.status && error.status == 404)
                        console.error("Error loading module '" + url + "', not found on server.");
                    callfail && callfail(error, stage)
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

        /**
         * MultiPromise is a Promise with multiple lock ids, thenonly fired when all locks has been filled.
         * @param {*} [data] Object with additional information to pass to the then section.
         */
        function MultiPromise(data) {
            var locks = {};
            var cbDone;

            /**
             * Checks the locks and fires the then in case of resolution
             */
            function check() {
                if (!locks)
                    return; //already resolved (ok or rejected)
                for (var k in locks)
                    if (!locks[k])
                        return; //not finised
                var result = locks;
                locks = null; //mark as done
                cbDone(result);
            }

            /**
             * Merge data into the multipromise additional data
             * @param {*} obj object to merge with additional data
             */
            function merge(obj) {
                data = data || {};
                data.merge(obj);
                return this;
            };

            /**
             * Adds a new lock to the Multipromise and executes the resolver function
             * @param {string} id Id of lock
             * @param {function} resolver Resolver function
             */
            function lock(id, resolver) {
                locks[id] = null;
                function resolve(value) {
                    locks[id] = {
                        ok: true,
                        value: value
                    };
                    check();
                }
                function reject(reason) {
                    locks[id] = {
                        ok: false,
                        reason: reason,
                    }
                    check();
                }
                setTimeout(function () {
                    try {
                        resolver(resolve, reject);
                    } catch (err) {
                        reject(err);
                    }
                });
                return this;
            }

            /**
             * Installs the callbacks to execute on resolution.
             * @param {function} cbFinish Function to execute when all locks has been resolved.
             */
            function then(cbFinish) {
                cbDone = cbFinish;
                return this;
            }

            this.merge = merge;
            this.lock = lock;
            this.then = then;
        }

        return {
            configuration: configuration,
            require: require,
            CallbackList: CallbackList,
            LoadHandler: LoadHandler,
            MultiPromise: MultiPromise,
        }
    })();

    // ==== Data === data model and binding
    var D = (function () {
        var processors = {};
        var model = { "": new Model() };

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
                    var procPars = null;
                    if (procName.indexOf('(') >= 0) {
                        if (procName[procName.length - 1] != ')')
                            throw new Error("Malformed processor call \"" + procName + "\"");
                        var pstart = procName.indexOf('(');
                        procPars = procName.substring(pstart + 1, procName.length - 1);
                        procName = procName.substring(0, pstart);
                    }
                    var fmt = processors[procName];
                    if (fmt)
                        pdata = fmt(pdata, { pars: procPars }.merge(context));
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
                    fmt(pdata, context, value);
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
         * 
         * @param {sring} [id] id of model to get, if null or "" the default model will be fetched
         */
        function getModel(id) {
            if (!id)
                id = "";
            return model[id];
        }

        function setModel(id, model) {
            return model[id] = model;
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
                    bindings[p].forEach(function (bindEx) {
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
            this.getBindings = function () { return bindings; };
        }

        /**
         * Creates a data binding, a binding contains multiple binding blocks starting with '{' and ending with '}'
         * @param {string} path path of binding
         */
        function Binding(path) {
            function parseBinding(path) {
                var bindingParts = [];
                var value = "";
                var insideBind = false;
                Array.prototype.forEach.call(
                    path,
                    function (ch) {
                        if (insideBind) {
                            if (ch == '}') {
                                insideBind = false;
                                //if (value) //binding with {} means "this"
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
                );
                if (insideBind)
                    throw new Error("Not closed binding.");
                if (value)
                    bindingParts.push({ bind: false, value: value });
                return bindingParts;
            }
            var parts = parseBinding(path);
            var mdl = model[""];

            /**
             * Executes the binding and return the value 
             * @param {*} [context] additional data
             * @param {element} [context.element] DOM element of data processed when calling from binding
             */
            function read(context) {
                var value;
                var contextPath = context.element.getContextPath;
                for (var i in parts) {
                    var part = parts[i];
                    var v;
                    if (part.bind) {
                        v = mdl.getProperty(contextPath(part.path), context);
                    } else
                        v = part.value;
                    if (value === undefined)
                        value = v;
                    else if (v !== undefined)// If v is undefined no concatenation is done at all
                        value = String(value) + v;
                }
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
                            mdl.registerBindingExecutor(path, bexec);
                        } else
                            mdl.registerBindingExecutor(part.path, bexec);
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
                        var value = read({ element: textNode });
                        if (value === undefined || value === null)
                            value = "";
                        textNode.nodeValue = value;
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
                            var value = read({ element: element });
                            if (value === undefined || value === null || value === false)
                                element.removeAttribute(attribute);
                            else
                                element.setAttribute(attribute, value);
                        }
                    }
                }
                switch (element.tagName) {//TODO implement special read for inputs select and more
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
                    throw new Error("wolf:repeat does not allow composed bindings, use single one");
                var pathbar = parts[0].path;
                if (pathbar && pathbar[pathbar.length - 1] != '/')
                    pathbar += '/';
                //v0.1 delete all and refill
                function populate(data) {
                    repeatItems.forEach(function (item) { try { parent.removeChild(item); } catch (e) { } });
                    repeatItems = []
                    if (!data)
                        return;
                    for (var k in data) {
                        templates.forEach(function (templ) {
                            var elements = UI.instanceTemplate(templ, { parent: parent, contextPath: pathbar + k });
                            elements.forEach(function (element) {
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

            /**
             * Bind an external API
             * @param {*} node DOM node
             * @param {*} fninit Function to execute at binding init
             * @param {*} fnread Function to execute at binding element read (write to model)
             * @param {*} fnwrite Function to execute at binding element wrtie (read from model)
             */
            function bindExecutor(node, fninit, fnread, fnwrite) {
                var fread;
                var fwrite = fnwrite ? function () {
                    fnwrite(read);
                } : null;
                if (fninit)
                    init(fninit);
                registerBindingExecutor({
                    node: node,
                    read: fread,
                    write: fwrite
                });
            }

            /**
             * Return the actual value reflected by the binding for the specified element
             * @param {*} element DOM element
             */
            function getValue(element) {
                return read({ element: element })
            }

            /**
             * Return the actual value reflected by the binding for the specified element
             * @param {*} element DOM element
             */
            function getParts() {
                return parts;
            }

            this.bindTextNode = bindTextNode;
            this.bindElementAttribute = bindElementAttribute;
            this.bindRepeater = bindRepeater;
            this.bindExecutor = bindExecutor;
            this.getValue = getValue;
            this.getParts = getParts;
        }

        return {
            getProperty: getProperty,
            setProperty: setProperty,
            registerDataProcessor: registerDataProcessor,
            getModel: getModel,
            setModel: setModel,
            Binding: Binding,
        };
    })()

    // ==== UI ==== screen elements and applications handling
    var UI = (function () {
        var frgs = {}, navigatorController;

        /**
         * Template class
         */
        function Template(type, attributes, childs) {
            if (type)
                this.$t = type;
            if (attributes)
                this.merge(attributes);
            if (childs)
                if (type) {
                    if (childs.push)
                        this.$ = childs;
                    else
                        this.$ = [childs];
                } else
                    this.$ = childs;
        }

        Object.defineProperty(Template.prototype, "$set", {
            value: function (attributeName, attributeValue) {
                this[attributeName] = attributeValue;
                return this;
            }
        });

        Object.defineProperty(Template.prototype, "$add", {
            value: function (child) {
                if (this.$t) {
                    if (!this.$)
                        this.$ = [];
                    this.$.push(child);
                } else
                    this.$ = child;
                return this;
            }
        });

        /** Initializes an application, an application is only a definition of the container element in the document
         * and the url of the application controller, a single web page can contains several applications
         * @param {string} ctrlUrl url for the application controller
         * @param {element} element the parent document element
         */
        function initApp(ctrlUrl, element) {
            K.require(ctrlUrl, function (ctrl) {
                processElement(element, {
                    $t: "#app",
                    $controller: ctrl
                }, element.parentElement);
                ctrl.init && ctrl.init(element);
            });
            // NOTE: data-stack es la pila de contextos de dato que se usa en la aplicación y en los bindings
        }

        var wolfElements = {
            /**
             * <wolf:fragment>
             * fragment definition, fragment can be loaded from urls and can have a cotnroller that is propagated on all childs
             */
            "fragment": {
                $init: function (template) {
                    if (template.id) {
                        frgs["#" + template.id] = template;
                        delete template.id;
                    }
                    if (template.controller) {
                        template.$controller = template.controller;
                        delete template.controller;
                    }
                    if (template.forcecontroller) {
                        template.$forcecontroller = template.forcecontroller == "true";
                        delete template.forcecontroller;
                    }
                    /**
                     * Inserts the element into a parent element (replacing any content)
                     * @param {element} parentElement 
                     */
                    template.$insertTo = function (parentElement) {
                        var nodes = instanceTemplate(template, { parent: parentElement });
                        while (parentElement.childNodes.length > 0)
                            parentElement.removeChild(parentElement.childNodes[0]);
                        for (var i in nodes)
                            parentElement.appendChild(nodes[i]);
                        var ptmpl = parentElement.getTemplate();
                        if (template.$controller)
                            if (!ptmpl.$controller || ptmpl.$fragmentedController || template.$forcecontroller) {
                                ptmpl.$controller = template.$controller;
                                ptmpl.$fragmentedController = true;
                            } else {
                                console.warn("wolf: Can't install fragment controller on parent element because already have one");
                            }
                        template.$controller && template.$controller.init && template.$controller.init(parentElement);
                    }
                },
                $ctor: function (template, ext) {
                    var nodes = [];
                    template.$ && template.$.forEach(function (son) { instanceTemplate(son, ext).forEach(function (sonDOM) { nodes.push(sonDOM) }) });
                    return nodes;
                },
                id: {
                    bindable: false
                },
                controller: {
                    bindable: false
                },
                forcecontroller: {
                    bindable: false
                }
            },

            /**
             * <wolf:repeat>
             * repeat all child elements, also adgust the context data for each repetition
             */
            "repeat": {
                $init: function (template) {
                    if (!template.items)
                        throw new Error("item attribute is mandatory on wolf:repeat");
                    if (!(template.items instanceof D.Binding))
                        throw new Error("item attribute must be a binding wolf:repeat");
                    if (!template.$ || template.$.length == 0)
                        throw new Error("wolf:repeat requires a child");
                },
                $ctor: function (template) {
                    var hook = document.createElement(template.$[0].$t);
                    setTimeout(function () {
                        template.items.bindRepeater(hook.parentElement, hook.nextSibling, template.$);
                        hook.parentElement.removeChild(hook);//Clear hook
                    });
                    return [hook];
                },
                items: {
                    bindable: true,
                    mandatory: true
                }
            }
        }

        /**
         *  Definitions for wolf tag attibutes when processing the elements.
         *  for extended processors with multiple options (for example events) use a # before the
         *  processor name (see event processor)
         */
        var wolfAttributes = (function () {
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
                    initTemplate: function (template, items) {
                        if (!(items instanceof D.Binding))
                            throw new Error("Only bindings can be used on xwolf:repeat");
                        return new Template("wolf:repeat", { $w: wolfElements.repeat, items: items }, template);
                    }
                },

                /**
                 * wolf:context
                 * set a context path for this object
                 */
                "context": {
                    bindable: false,
                    processor: function (element, value, template) {
                        element.setContextPath(value);
                    }
                },

                /**
                 * wolf:id
                 * for tagging templates
                 */
                "id": {
                    bindable: false,
                    initTemplate: function (template, value) {
                        template.$id = value;
                    }
                },

                /**
                 * wolf:write
                 * for data write logic definition
                 */

                "write": {
                    bindable: false,
                    processor: function (element, value, template, auto) {
                        if (value == "none")
                            return;
                        if (!value) {
                            if (template.$t == "input") {
                                var type = template.type;
                                if (type instanceof D.Binding)
                                    type = type.getValue(element);
                                var path = template.value;
                                if (!(path instanceof D.Binding)) {
                                    if (!auto)
                                        console.warn("A binding is needed to autodetect write path");
                                    return;
                                }
                                path = path.getParts();
                                if (path.length != 1 || !path[0].bind) {
                                    console.warn("A complex binding can not be used to autodetect write path");
                                    return;
                                }
                                path = path[0].path;
                                switch (type) {
                                    case "checkbox":
                                    case "radio":
                                        value = ["click", path, "checked"]
                                        break;
                                    default:
                                        value = ["change", path, "value"]
                                }
                            } else {
                                if (!auto)
                                    console.warn("Can not autodetect write method for element ", element);
                                return;
                            }
                        } else
                            value = value.split(':');
                        if (value.length <= 2)
                            value = ["change", value[0], value[1] || "value"];
                        element.addEventListener(value[0], function (evt) {
                            var ctx = { event: evt };
                            var obj;
                            if (value[1] && value[1][0] == '/')
                                obj = D.getModel().getProperty();
                            else
                                obj = element.getContextData();
                            D.setProperty(obj, value[1], D.getProperty(element, value[2], ctx), ctx);
                        });
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
            var contextPath = ext ? ext.contextPath : undefined;
            var defaultParent = ext ? ext.parent : undefined;
            var customController = ext ? ext.customController : undefined;

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
                    if (typeof (template.$controller) == "string") {
                        throw new Error("Intermediate controllers not supported right now");
                        // // NOTE: Not optimal, but intermediate controllers are not optimal too.
                        // return await Promise.resolve({
                        //     then: function(ok, ko)  {
                        //         K.require(template.$controller, function(ctrl) {
                        //             ok(template.$controller = ctrl);
                        //         });
                        //     }
                        // });
                    }
                    return template.$controller;
                }
            }

            /**
             * Return the element having a controller influencing this element
             */
            function getControllerElement() {
                var node = element;
                while (node && node != document.documentElement) {
                    var template = node.getTemplate();
                    if (template && template.$controller)
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
                    return app.getTemplate().$controller;
            }

            /**
             * Return the application of this element tree
             */
            function getApplication() { //TODO: use context, not current DOM path
                var node = element;
                while (node && node != document.documentElement) {
                    var template = node.getTemplate();
                    if (template && template.$t == "#app")
                        return node;
                    node = node.getParent();
                }
            }

            /**
             * Search all the element tree (from this element) for an element with an id
             * @param {string} id id of element to search
             */
            function byId(id) { //TODO: use querySelector
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
             * Return the parent of theis element or a parent with a specified id or class
             * @param {string} [idorclass] id of element or class if idorclass start with '.'
             */
            function getParent(idorclass) { // TODO: Use context not DOM path
                var dad = element.parentElement || defaultParent;
                if (idorclass) {
                    while (dad && dad != document.documentElement) {
                        if (dad.getTemplate && dad.getTemplate().type == "#app")
                            break;
                        switch (idorclass[0]) {
                            case '#':
                                if ('#' + dad.id == idorclass)
                                    return dad;
                                break;
                            case '.':
                                if (dad.classList.contains(idorclass.substr(1)))
                                    return dad;
                                break;
                            default:
                                if (dad.id == idorclass)
                                    return dad;
                        }

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
             * Get the current binding context path
             * @param {string} path Path for composing
             */
            function getContextPath(path) {
                // Absolute path
                if (path && path[0] == '/')
                    return path;
                var base;
                if (template.$t == "#app" || (contextPath && contextPath[0] == "/"))
                    base = contextPath;
                else {
                    base = element.getParent().getContextPath();
                    if (!base)
                        base = contextPath;
                    else {
                        if (base[base.length - 1] != '/')
                            base += '/';
                        if (contextPath)
                            base = base + contextPath;
                    }
                }
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
             * Get the context object based on contextpath
             * @param {string} path Relative Path (optional)
             */
            function getContextData(path) {
                return wolf.getModel().getProperty(getContextPath(path));
            }

            /**
             * Include a fragment into this element
             * @param {string} url 
             * @param {loadFragmentTo_callback} callback Called once fragment has been loaded and set on element
             */
            function include(url, callback) {
                loadFragmentTo(url, element, callback);
            }

            /**
             * Refresh element depending on model data
             */
            function refresh() {
                D.getModel().refreshElement(element);
            }

            if (!template.$t) {
                element.merge({
                    // Wolfed text node API
                    getTemplate: getTemplate,
                    getController: getController,
                    getControllerElement: getControllerElement,
                    getApplication: getApplication,
                    getApplicationController: getApplicationController,
                    getParent: getParent,
                    setContextPath: setContextPath,
                    getContextPath: getContextPath,
                    getContextData: getContextData,
                    refresh: refresh,
                });
                // process text
                if (template.$ instanceof D.Binding)
                    template.$.bindTextNode(element);
                else
                    element.nodeValue = template.$;
            } else {
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
                    getContextData: getContextData,
                    include: include,
                    refresh: refresh,
                });

                // process attributes
                for (var k in template) {
                    if (k[0] == "$")
                        continue;
                    var value = template[k];
                    if (typeof value === "function")
                        value(element);
                    else if (value instanceof D.Binding)
                        value.bindElementAttribute(element, k);
                    else
                        element.setAttribute(k, value);
                }
                // install write events prior to install events
                if (K.configuration.autoWriteBinding)
                    if (!template["wolf:write"]) //TODO: adjust wolf attributes on framework
                        wolfAttributes.write.processor(element, null, template, true);
                // process events
                function installEvent(event, method) {
                    if (customController)
                        element.addEventListener(event, function (evt) {
                            var evtMethod = customController[method];
                            if (!evtMethod)
                                throw new Error("Method '" + method + "' not found for event '" + k + "' in custom controller.");
                            evtMethod(element, evt);
                        });
                    else
                        element.addEventListener(event, function (evt) {
                            var ctrl = element.getController();
                            var evtMethod = ctrl[method];
                            if (!evtMethod)
                                throw new Error("Method '" + method + "' not found for event '" + k + "'.");
                            evtMethod(element, evt);
                        });
                }
                if (template.$e)
                    for (var k in template.$e)
                        installEvent(k, template.$e[k]);
            }
            template.ctor && template.ctor(element, template, ext);
            ext.onRender && ext.onRender(element, template, ext);
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
            if (Array.isArray(template)) {
                var result = [];
                template.forEach(function (templ) {
                    result = result.concat(instanceTemplate(templ, ext));
                });
                return result;
            }
            if (!template.$t) {
                var node = document.createTextNode("");
                processElement(node, template, ext);
                return [node];
            } else if (template.$w) {
                return template.$w.$ctor(template, ext);
            } else if (template.$t.substr(0, 5) == "wolf:") {
                throw new Error("TEST! Template without precache");
                template.$w = wolfElements[template.$T.substr(5)];
                return template.$w.$ctor(template, ext);
            } else {
                var node = document.createElement(template.$t);
                processElement(node, template, ext);
                if (template.$ && template.$.length) {
                    var childExt = {}.merge(ext).merge({ parent: node });
                    delete childExt.contextPath; //TODO: erase the usage of contextPath in ext, or do not cache contextpath when initTemplate is done
                    template.$.forEach(function (son) { instanceTemplate(son, childExt).forEach(function (sonDOM) { node.appendChild(sonDOM) }) });
                }
                template.$onRender && template.$onRender(node, template, ext); //TODO: refactor postInit to $onRender
                return [node];
            }
        }
        /**
         * Process an element template and it's childs, preparing the logics and binding maps
         * @param {*} node DOM node to read as template
         * @param {*} parent parent template
         * @param {*} tcontext template processing context (extended api for reading)
         * @param {funciton} tcontext.readValue function for checking the value for templates
         */
        function readTemplate(node, parent, tcontext) {
            /**
             * @callback readTemplate_callback
             * @param {*} template template processed completely
             */

            var templ = new Template(), initiators = [];
            tcontext = tcontext || {};;

            function valOrBinding(val) {
                if (tcontext.readValue) {
                    var v = tcontext.readValue(val);
                    if (v)
                        return v;
                }
                if (typeof val === "string" && val.indexOf('{') >= 0)
                    return new D.Binding(val);
                return val;
            }

            if (node.nodeType == 8) {
                //Ignore element (commentary)
                return null;
            } else if (node.nodeType == 3) {
                var val = node.nodeValue;
                if (K.configuration.trimTextNodes)
                    val = TOOLS.smartTrim(val);
                else if (!val.trim())
                    val = " ";
                if (!val)
                    return null;
                if (parent && parent.$t == "script")
                    templ.$ = val;
                else
                    templ.$ = valOrBinding(val);
            } else {
                var tagname = templ.$t = node.tagName.toLowerCase();
                if (tagname.substr(0, 5) == "wolf:") {// Wolf element!
                    var wdef = templ.$w = wolfElements[tagname.substr(5)];
                    if (!wdef)
                        throw new Error("Unknown element: " + tagname);
                    node.getAttributeNames().forEach(function (attr) {
                        if (attr[0] == "$")
                            throw new Error(attr + " attribute name is not valid");
                        attr = attr.toLowerCase();
                        var attri = wdef[attr];
                        if (!attri)
                            throw new Error(tagname + " does not allow " + attr + " attribute");
                        var aval = valOrBinding(node.getAttribute(attr));
                        if ((aval instanceof D.Binding) && !attri.bindable)
                            throw new Error(tagname + " attribute " + attr + " can not be binded");
                        if (!(aval instanceof D.Binding) && attri.bindable == "mandatory")
                            throw new Error(tagname + " attribute " + attr + " should be binded");
                        templ[attr] = aval;
                    });
                    for (var k in wdef) {
                        if (k[0] == "$")
                            continue;
                        if (wdef[k].mandatory && !templ[k])
                            throw new Error(tagname + " attribute " + k + " is mandatory");
                    }
                    wdef.$init && initiators.push(wdef.$init);
                } else { // Normal element
                    node.getAttributeNames().forEach(function (attr) {
                        if (attr[0] == "$")
                            throw new Error(attr + " attribute name is not valid");
                        attr = attr.toLowerCase();
                        var aval = valOrBinding(node.getAttribute(attr));
                        if (attr && attr.substr(0, 6) == "event:") {
                            attr = attr.substr(6);
                            if (attr[0] == "$")
                                throw new Error("event:" + attr + " attribute name is not valid");
                            if (aval instanceof D.Binding)
                                throw new Error("Events can not be binded");
                            if (!templ.$e)
                                templ.$e = {};
                            templ.$e[attr] = aval;
                        } else if (attr && attr.substr(0, 5) == "wolf:") {
                            var attrName = attr.substr(5);
                            if (attrName[0] == "$")
                                throw new Error(attr + " attribute name is not valid");
                            var wattr = wolfAttributes[attrName];
                            if (!wattr)
                                throw new Error("Unknown global attribute wolf:" + attr);
                            if (aval instanceof D.Binding && !wattr.bindable)
                                throw new Error(attr + " does not allow binding");
                            if (wattr.processor)
                                templ[attrName] = function (element) { wattr.processor(element, aval, templ); };
                            //TODO: do not like this solution, maily for wolf:repeat attribute because <wolf:repeat> element
                            //      get relocated then repeating tr or tds inside a table.
                            //      Better try to parse the HTML manually when reading templates to avoid node relocations
                            if (wattr.initTemplate)
                                initiators.push(function (ttempl) { return wattr.initTemplate(ttempl, aval); });
                        } else if (attr && attr.substr(0, 5) == "bind:") {
                            attr = attr.substr(5);
                            if (attr[0] == "$")
                                throw new Error("bind:" + attr + " attribute name is not valid");
                            if (!(aval instanceof D.Binding))
                                throw new Error("Use bind:#### attributes only for binding");
                            templ[attr] = aval;
                        } else {
                            templ[attr] = aval;
                        }
                    });
                }

                // Process childs
                if (templ.$t)
                    for (var ci = 0; ci < node.childNodes.length; ci++) {
                        var tn = readTemplate(node.childNodes[ci], templ);
                        if (tn) {
                            if (!templ.$)
                                templ.$ = [];
                            templ.$.push(tn);
                        }
                    }

                initiators.forEach(function (init) {
                    var ttempl = init(templ);
                    if (ttempl !== undefined)
                        templ = ttempl;
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

            if (fragment.$controller && typeof (fragment.$controller) === "string") {
                K.require(fragment.$controller, function (ctrl) {
                    fragment.$controller = ctrl;
                    callback && callback(fragment);
                });
            } else callback && callback(fragment);
        }

        /**
         * Fetch the fragment form a url and uses the browser parser to return DOM as wolf:fragment
         * @param {string} url url of the fragment to load
         * @param {fetchFragment_callback} [callback] callback to execute when the fragment has been fetched
         */
        function fetchFragment(url, callback) {
            /**
             * @callback fetchFragment_callback
             * @param {*} rootElement Loaded fragment DOM
             */
            TOOLS.wGet(url, function (html) {
                var rootElement = document.createElement("wolf:fragment");
                rootElement.innerHTML = html;
                if (rootElement.children.length == 1 && rootElement.children[0].tagName == "WOLF:FRAGMENT")
                    rootElement = rootElement.children[0];
                callback(rootElement);
            });
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
                fetchFragment(url, function (rootElement) {
                    processFragmentTemplate(rootElement, function (fragment) {
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
            loadFragment(url, function (fragment) {
                fragment.$insertTo(element);
                callback && callback(fragment, element);
            });
        }

        /**
         * Executes an event when a desired fragment has been loaded if the fragment is already loaded executes the callback
         */
        function onFragmentReady(url, callback) {
            var fragment = frgs[url];
            if (!fragment) {
                console.error("Only allowed on loaded or loading fragments, if fragment is not references a wait is not possible");
            } else {
                if (fragment instanceof K.CallbackList)
                    fragment.add(callback);
                else
                    callback(fragment);
            }
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
                    console && console.error("Can not detect resource type by url '" + url + "'. Aborting!");
                    return;
                }
                type = filePath.substr(dp + 1);
                if (!type) {
                    console && console.error("Can not detect resource type by url '" + url + "'. Aborting!");
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
                    escript.type = "text/javascript";
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
            var current;

            if (!navigatorController) {
                //Create navigation controller object
                navigatorController = (function () {
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

                    window.addEventListener("hashchange", function () {
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
                    throw new Error("Navigation '" + id + "' not defined.");
                current = { id: id, data: data };
                var lh = new K.LoadHandler(function () {
                    if (navEntry.event)
                        callEvent(lh.__elem, navEntry.event);
                    for (var i in nav.onChange) try {
                        nav.onChange[i](id, data);
                    } catch (e) { };
                });

                function callEvent(element, eventName) {
                    var ctrl;
                    if (eventName[0] == '/') {
                        eventName = eventName.substr(1);
                        ctrl = element.getApplicationController();
                    } else
                        ctrl = element.getController();
                    if (ctrl[eventName])
                        ctrl[eventName](lh.__elem, id, data);
                    else
                        console.error("Navigation event '" + eventName + "' doest not exists");
                }

                function navFragment(dest, elem) {
                    lh.enter();
                    loadFragmentTo(dest.to, elem, function (templ, setElem) {
                        lh.__elem = lh.__elem || setElem;
                        if (dest.then)
                            processSet(dest.then);
                        if (dest.event)
                            callEvent(setElem, dest.event);
                        lh.leave();
                    });
                }

                function processSet(navset) {
                    for (var k in navset) {
                        var dest = navset[k];
                        var elem = element.byId(k);
                        if (typeof dest === "string")
                            dest = { to: dest };
                        if (elem)
                            navFragment(dest, elem);
                        else
                            console.error("Navigation '" + id + "' not completed, element with id '" + k + "' not found")
                    }
                }

                if (navEntry.set)
                    processSet(navEntry.set)
                else
                    lh.clear();
            }

            /**
             * Executes the navigation with specified id, if the navigation terget is already done does not reload it.
             * @param {string} id id on the navigation map to execute 
             * @param {object} [data] data of the navigation if any
             */
            function navTo(id, data) {
                var navEntry = navigationMap[id];
                if (!navEntry)
                    throw new Error("Navigation '" + id + "' not defined.");

                var pattern = "";
                data = data || {};
                if (navEntry.pattern)
                    navEntry.pattern.forEach(function (part) {
                        var patternPart = part.isData ? data[part.name] : part.name;
                        pattern += "/" + (patternPart || "");
                    });
                if (pattern)
                    pattern = pattern.substr(1);
                document.location.hash = pattern;
            }

            /**
             * Process the hash string and executes the corresponding navigation
             * @param {string} hash 
             */
            function processHash(hash) {
                if (hash && hash[0] == '#')
                    hash = hash.substr(1);
                if (hash) {
                    hash = hash.split('/');
                    var candidates = []; //Navigation ids
                    var navId;
                    //First step get all candidates
                    for (var k in navigationMap)
                        candidates.push(k);
                    // Filter candidates
                    for (var i in hash) {
                        var hpart = hash[i];
                        var newCa = [];
                        var newCaVar = [];
                        var exact = false;
                        candidates.forEach(function (k) {
                            if (!k)
                                return; //Kill nulls
                            var nav = navigationMap[k];
                            if (!nav.pattern || nav.pattern.length <= i)
                                return;
                            if (nav.pattern[i].name == hpart && !nav.pattern[i].isData) {
                                //A exact match (no varialbe) has been found and have preference. 
                                exact = true;
                                newCa.push(k);
                            } else
                                if (!exact && nav.pattern[i].isData)
                                    newCaVar.push(k);
                        });
                        if (!exact) //No exact match, allow variable ones
                            newCa = newCa.concat(newCaVar)
                        if (newCa.length == 1) {
                            navId = newCa[0];
                            break;
                        } else if (newCa.length == 0) {
                            navId = candidates[0];
                            break;
                        } else
                            candidates = newCa;
                    }
                    if (!navId)
                        navId = candidates[0];
                    // Candidate already defined, process it
                    if (navId) {
                        var data = {};
                        var nav = navigationMap[navId];
                        if (nav.pattern)
                            for (var i in hash)
                                if (i < nav.pattern.length && nav.pattern[i].isData)
                                    data[nav.pattern[i].name] = hash[i];
                        doNav(navId, data);
                        return;
                    }
                } else
                    for (var k in navigationMap) {
                        var navEntry = navigationMap[k];
                        if (navEntry.pattern == null) {
                            doNav(k);
                            return;
                        }
                    }
                for (var k in navigationMap) {
                    console.warn("No matching navigation found, navigating to first");
                    doNav(k);
                    return;
                }
                throw new Error("Hash does not have any matching navigation");
            }

            /**
             * Return information about the actually navigation stage
             */
            function getCurrentNavigation() {
                if (!current)
                    current = {};
                return { id: current.id, data: current.data }
            }

            var nav = element.navigator = {
                navTo: navTo,
                processHash: processHash,
                getCurrentNavigation: getCurrentNavigation,
                onChange: []
            }

            navigatorController.registerNavigator(element, nav);

            /**
             * Navigation initialization and data processing
             */
            function initNavigation() {
                for (var k in navigationMap) {
                    var navi = navigationMap[k];
                    if (navi.pattern) {
                        var path = navi.pattern.split('/');
                        for (var i in path) {
                            var ref = path[i];
                            if (!ref)
                                continue;
                            path[i] = ref = {
                                name: ref
                            }
                            if (ref.name[0] == '{') {
                                ref.name = ref.name.substr(1, ref.name.length - 2);
                                ref.isData = true;
                            }
                        }
                        navi.pattern = path;
                    } else
                        navi.pattern = null;
                }

                nav.processHash(document.location.hash);
                callback && callback(nav);
            }

            if (typeof navigationMap === 'string') {
                TOOLS.loadJSON(navigationMap, function (data) {
                    navigationMap = data;
                    initNavigation();
                }, function (e) {
                    if (typeof navigationMap === 'string')
                        throw new Error("Can't load the navigation map at: " + navigationMap + "\n(" + e + ")");
                    else
                        throw e;
                });
            } else {
                initNavigation();
            }
            return nav;
        }

        /**
         * Creates a wolf:xxxx element, use with caution
         * @param {string} id Id of the element to register
         * @param {*} element Object controller of the element
         */
        function registerElement(id, element) {
            wolfElements[id] = element;
        }

        /**
         * Clones a templte in deep
         * @param {*} templ Template object or array
         */
        function cloneTemplate(templ) {
            if (!templ)
                return;
            if (Array.isArray(templ)) {
                var result = [];
                for (var i = 0; i < templ.length; i++)
                    result[i] = cloneTemplate(templ[i]);
                return result;
            }
            var clone = new Template().merge(templ);

            // Does not clone events??
            delete clone.$e;
            if (templ.$ && Array.isArray(templ.$))
                clone.$ = cloneTemplate(templ.$);
            return clone;
        }

        // DRAFT
        // /**
        //  * Fetch an element or multiple by a selector string
        //  * @param {*} templ Template object
        //  * @param {string} selector Selector query 
        //  * @param {boolean} multiple Return an array of matches instead of single element
        //  */
        // function queryTemplate(templ, selector, multiple) {
        // }

        // DRAFT
        // /**
        //  * Easy way to change templates structure
        //  * @param {*} templ Template object
        //  * @param {*} data Data structure of template changes
        //  */
        // function hackTemplate(templ, data) {
        // }

        //Template.prototype

        return {
            initApp: initApp,
            instanceTemplate: instanceTemplate,
            readTemplate: readTemplate,
            fetchFragment: fetchFragment,
            loadFragment: loadFragment,
            loadFragmentTo: loadFragmentTo,
            onFragmentReady: onFragmentReady,
            import: importResource,
            createNavigator: createNavigator,
            registerElement: registerElement,
            cloneTemplate: cloneTemplate,
            // queryTemplate: queryTemplate, DRAFT
            // hackTemplate: hackTemplate, DRAFT
            Template: Template,
        }
    })();

    // ==== TOOLS ==== collection of utility functions
    var TOOLS = (function () {

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
                else {
                    if (error && error.status && error.status == 404)
                        console.error("Error loading '" + url + "', not found");
                    else
                        console.error(error, stage);
                }
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
            }).then(function (r) {
                if (r.ok) {
                    r[type]()
                        .then(function (data) { callback(data); })
                        .catch(function (e) { fail(e, "process") });
                } else {
                    fail({ status: r.status, text: r.statusText }, "http")
                }
            }).catch(function (e) { fail(e, "net") });
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

        /**
         * Special trimming close to browser behaviour trimming inside contents too.
         * @param {*} s 
         */
        function innerTrim(s) {
            var o = "";
            var space = false;
            var spaces = " \t\r\n";
            for (var i in s) {
                var issp = spaces.includes(s[i]);
                if (issp && !space) {
                    space = true;
                    o += " ";
                } else if (!issp) {
                    space = false;
                    o += s[i];
                }
            }
            return o;
        }

        /**
         * Special trimming close to browser behaviour.
         * @param {*} s 
         */
        function smartTrim(s) {
            var t = s.trim();
            if (!t)
                return "";
            var spaces = " \t\r\n";
            var sts = spaces.includes(s[0]);
            var ens = spaces.includes(s[s.length - 1]);
            return (sts ? " " : "") + t + (ens ? " " : "");
        }

        /**
         * i18n handling class
         * @param {string} path Base file path of i18n property files, this sould point to the name of the root file without the .json
         * @param {string} [lang] Language code of i18n (optional, by default navigator language)
         * @param {function} gcb Callback to execute when lang tree has been chagned and loaded
         */
        function I18N(path, lang, gcb) {
            const empty = {};
            var langTree = [empty, empty, empty];

            /**
             * Sets the current language code and fetch the language data
             * @param {string} code Language code in format xx-XX
             * @param {function} cb Callback to execute when lang tree has been loaded
             */
            function setLang(code, cb) {
                var langsteps = code.split("-");
                var langdone = [, ,];
                lang = {
                    lang: langsteps.length > 0 ? langsteps[0].toLowerCase() : "",
                    country: langsteps.length > 1 ? langsteps[1].toUpperCase() : "",
                    code: code,
                }
                function set(i, l) {
                    langTree[i] = l || empty;
                    langdone[i] = true;
                    cb = cb;
                    if (langdone[0] && langdone[1] && langdone[2])
                        cb && cb(code);
                }
                if (langTree[0] == empty)
                    loadJSON(path + ".json", function (l) { set(0, l) }, function () { set(0) });
                if (lang.lang)
                    loadJSON(path + "-" + lang.lang + ".json", function (l) { set(1, l) }, function () { set(1) });
                else
                    langTree[1] = langdone[1] = {};
                if (lang.country)
                    loadJSON(path + "-" + lang.lang + "-" + lang.country + ".json", function (l) { set(2, l) }, function () { set(2) });
                else
                    langTree[2] = langdone[2] = {};
            }

            /**
             * Return the lenguage information
             */
            function getLanguage() {
                return lang;
            }

            /**
             * Simple string-value formatter 
             * @param {string} expression string with the expression
             * @param {*} valueObj object with all the values to be expressed
             */
            function stringTemplateParser(expression, valueObj) {
                const templateMatcher = /{\s?([^{}\s]*)\s?}/g;
                let text = expression.replace(templateMatcher, function (substring, value, index) {
                    value = valueObj[value];
                    if (!value)
                        value = "";
                    return value;
                });
                return text
            }

            /**
             * Return the text of the language file tree
             * @param {string} key 
             * @param {*} data 
             */
            function getText(key, data) {
                var l = 2;
                var txt;
                while (l >= 0 && !txt)
                    txt = langTree[l--][key];
                if (!txt)
                    return "";
                return stringTemplateParser(txt, data || {});
            }

            this.setLang = setLang;
            this.getLanguage = getLanguage; //Different name due to the behaviour is a slight different too
            this.getText = getText;

            if (!lang)
                lang = navigator.language || navigator.userLanguage;
            setLang(lang, gcb);
        }

        return {
            fetch: fetcher,
            wGet: wGet,
            loadJSON: loadJSON,
            innerTrim: innerTrim,
            smartTrim: smartTrim,
            I18N: I18N,
        }
    })()

    /**
     * Create an extension of wolf framework
     * @param {function} extender The function that installs the extension
     */
    function wolfExtension(extender) {
        extender(K, D, UI, TOOLS);
    }

    /**
     * Init framework
     */
    (function () {
        checkPolyFills();
    })();

    return {
        // Kernel
        configuration: K.configuration,
        require: K.require,
        wolfExtension: wolfExtension,
        CallbackList: K.CallbackList,
        LoadHandler: K.LoadHandler,
        MultiPromise: K.MultiPromise,
        // Data
        getProperty: D.getProperty,
        setProperty: D.setProperty,
        registerDataProcessor: D.registerDataProcessor,
        getModel: D.getModel,
        // UI
        initApp: UI.initApp,
        loadFragment: UI.loadFragment,
        loadFragmentTo: UI.loadFragmentTo,
        onFragmentReady: UI.onFragmentReady,
        import: UI.import,
        createNavigator: UI.createNavigator,
        // Tools
        wGet: TOOLS.wGet,
        loadJSON: TOOLS.loadJSON,
        smartTrim: TOOLS.smartTrim,
        innerTrim: TOOLS.innerTrim,
        I18N: TOOLS.I18N,
    };
})();
