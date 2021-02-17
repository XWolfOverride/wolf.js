/*  wolf.ui 0.7, UI components for wolf, a lightweight framework for web page creation.
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

(() => {
    'use strict';
    wolf.wolfExtension((K, D, UI, TOOLS) => {

        /**
         * Common dialog controller
         */

        function dialogControl(modal, element, controller) {
            var modalWall; //Modal wall DOM instance
            var base; //Base dialog DOM
            var dialog; //Dialog DOM element
            var body; //Dialog body DOM element
            var buttons;// Dialog buttons footer DOM element
            var onClose; //Callback for on close
            // Process modaling
            if (modal) {
                modalWall = UI.instanceTemplate({ type: "div", a: { "class": "wolf-dialog-modal-wall" }, w: {} }, { parent: element })[0];
                element.appendChild(modalWall);
                base = modalWall;
            } else
                base = element;

            // Create dialog frame
            var dialog = UI.instanceTemplate({ type: "div", a: { "class": "wolf-dialog" }, w: {}, controller: controller }, { parent: base })[0];
            base.appendChild(dialog);

            dialog.close = function () {
                element.removeChild((modal ? modalWall : dialog));
                controller && controller.close && controller.close();
                onClose && onClose(dialog.dialogController.result);
            };

            // Controller logic
            /**
             * Adds a UI template to the dialog and instences it
             * @param {*} ui UI template object or array
             */
            function append(ui) {
                if (!body) {
                    body = UI.instanceTemplate({ type: "div", a: { "class": "wolf-dialog-body" }, w: {} }, { parent: dialog })[0];
                    if (buttons)
                        body.classList.add("with-footer");
                    dialog.appendChild(body);
                }
                if (ui.insertTo) //Assuming fragment
                    ui.insertTo(body);
                else {
                    if (!Array.isArray(ui))
                        ui = [ui];
                    ui.forEach(uielem => {
                        var uiDOM = UI.instanceTemplate(uielem, { parent: body });
                        uiDOM.forEach(dom => body.appendChild(dom));
                    })
                }
            }

            /**
             * Adds buttons definitions or UI template to the dialog foooter
             * @param {*} buttonsDef Button definition or UI template object or array
             */
            function appendButtons(buttonsDef) {
                if (body)
                    body.classList.add("with-footer");
                if (!buttons) {
                    buttons = UI.instanceTemplate({ type: "div", a: { "class": "wolf-dialog-buttons" }, w: {} }, { parent: dialog })[0];
                    dialog.appendChild(buttons);
                }
                if (!Array.isArray(buttonsDef))
                    buttonsDef = [buttonsDef];
                buttonsDef.forEach(uidef => {
                    if (uidef.type || uidef.value) {
                        var uiDOM = UI.instanceTemplate(uidef);
                        uiDOM.forEach(dom => buttons.appendChild(dom));
                    } else
                        for (var k in uidef) {
                            var def = uidef[k];
                            if (!def)
                                continue; //def can be null in order to cancel a button in json strucutres
                            var btcontent = [];
                            if (def.icon)
                                btcontent.push({ type: "i", a: { class: "icon" + (def.text ? " with-text" : "") }, w: {}, c: [{ value: def.icon }] });
                            if (def.text)
                                btcontent.push({ value: def.text });
                            var button = UI.instanceTemplate({ type: "button", a: {}, w: {}, c: btcontent }, { parent: dialog })[0];
                            if (def.default)
                                button.classList.add("default");
                            if (def.cancel)
                                button.classList.add("cancel");
                            installEvent(button, k, def);
                            buttons.appendChild(button);
                        }
                    function installEvent(button, id, def) {
                        button.addEventListener("click", (evt) => {
                            var evtMethod;
                            if (controller)
                                evtMethod = controller[id];
                            if (!evtMethod)
                                evtMethod = def.click;
                            if (!evtMethod)
                                evtMethod = () => {
                                    dialog.dialogController.result = id;
                                    dialog.close();
                                }
                            evtMethod(element, evt, dialog);
                        });
                    }
                });
            }

            /**
             * Raises the callback of the dialog
             * @param {*} cb callback
             * @param {*} close callback for on close
             */
            function callback(cb, close) {
                cb && cb(dialog, element, controller);
                onClose = close;
            }

            // Return controller
            return dialog.dialogController = {
                append: append,
                appendButtons: appendButtons,
                callback: callback,
            }
        }

        // ====================
        // ====================
        // ==            Public
        // ====================

        /**
         * Shows a non blocking message to the user
         * @param {string} text Text to show
         * @param {string} type (error|warning|default)
         */
        function toast(text, type) {
            var div = document.createElement("div");
            div.className = "wolf-toast wolf-toast-" + type;
            div.innerText = text;
            document.body.appendChild(div);
            setTimeout(() => {
                div.style.opacity = 0;
                setTimeout(() => {
                    document.body.removeChild(div);
                }, 1000);
            }, 1500);
        }

        /**
         * Show a dialog embedding a fragment.
         * @param {element} element Destination element, application element recommended
         * @param {boolean} modal True to show the dialog in modal way
         * @param {string} url Url of the fragment
         * @param {*} [buttons] Button definition
         * @param {*} [controller] Controller for the dialogs events, if none the parent element one will be used
         * @param {function} [callback] Callback when the dialog is shown
         * @param {function} [onclose] Callback when dialog close, passing the dialog result
         */
        function dialog(element, modal, url, buttons, controller, callback, onclose) {
            var dc = dialogControl(modal, element, controller);

            UI.loadFragment(url, (fragment) => {
                dc.append(fragment);
                if (buttons)
                    dc.appendButtons(buttons);
                dc.callback(callback, onclose);
            });
        }

        /**
         * Show a dialog asking or showing information.
         * @param {element} element Destination element, application element recommended
         * @param {boolean} modal True to show the dialog in modal way
         * @param {string} text Text to show
         * @param {*} [buttons] Button definition
         * @param {*} [controller] Controller for the dialogs events, if none the parent element one will be used
         * @param {function} [callback] Callback when the dialog is shown
         * @param {function} [onclose] Callback when dialog close, passing the dialog result
         */
        function messageDialog(element, modal, text, buttons, controller, callback, onclose) {
            if (!buttons)
                buttons = { close: { icon: "close", cancel: true } };
            uiDialog({ value: text }, buttons, element, modal, controller, callback, onclose)
        }

        /**
         * Show a dialog asking or showing information.
         * @param {element} element Destination element, application element recommended
         * @param {boolean} modal True to show the dialog in modal way
         * @param {*} ui UI body definition
         * @param {*} [buttons] Button definition
         * @param {*} [controller] Controller for the dialogs events, if none the parent element one will be used
         * @param {function} [callback] Callback when the dialog is shown
         * @param {function} [onclose] Callback when dialog close, passing the dialog result
         */
        function uiDialog(ui, buttons, element, modal, controller, callback, onclose) {
            var dc = dialogControl(modal, element, controller);
            dc.append(ui);
            if (buttons)
                dc.appendButtons(buttons);
            dc.callback(callback, onclose);
        }

        /**
         * Loads and initializes a UI library
         * @param {string} path Path of the UI library to load
         */
        function loadLibrary(path) {
            UI.fetchFragment(path, dom => {
                UI.readTemplate(dom);
            });
        }

        // ====================
        // ====================
        // ==           Private
        // ====================

        /**
         * Create the base element needed for the extensible UI and control building system
         */
        function InitControlDefinitions() {
            var controlGlobal = {}; //Global control space

            /**
             * Return the control instance attribute values
             * @param {*} controller controller object of control definition
             * @param {*} template template of control usage
             */
            function getControlAttributesTable(controller, template) {
                var values = {};
                // Control definition defaults
                for (var k in controller) {
                    var attr = controller[k];
                    if (attr && attr.default)
                        values[k] = attr.default;
                }
                // UI usage values
                for (var k in template) {
                    if (k[0] == "$")
                        continue;
                    values[k] = template[k];
                }
                return values;
            }

            /**
             * Generates the DOM of the control based on the script render method
             * @param {*} ext ctor extended info
             */
            function renderControlDOM(ext) {
                var tux = ext.customController.render();
                if (!tux)
                    return [];
                if (!Array.isArray(tux))
                    tux = [tux];
                var ux = [];
                for (var i in tux)
                    ux = ux.concat(UI.instanceTemplate(tux[i], ext));
                ext.customController.processDOM && ext.customController.processDOM(ux);
                return ux;
            }

            /**
             * Create event proxy for linked event call
             * @param {string} method Controller method name
             * @param {string} ename Event name
             */
            function eventProxy(method, ename, ext) {
                return function (element, event) {
                    var ctrl = ext.parentCustom || element.getController();
                    var evtMethod = ctrl[method];
                    if (!evtMethod)
                        throw new Error(`Method '${method}' not found for event '${ename}'.`);
                    evtMethod(element, event);
                }
            }

            /**
             * Register wolf:control as control definition structure
             */
            UI.registerElement("control", {
                $init: function (template) {
                    var id = template.id;
                    var allowChildren = template.allowchildren == "true";
                    var controller = {};
                    var ui = {};
                    var scriptFactory;

                    if (!id)
                        throw new Error("Can't define a control without id");
                    if (!template.$) {
                        console.warn("wolf:" + id + " empty definition");
                        return null;
                    }
                    // Read definition
                    template.$.forEach(c => {
                        switch (c.$t) {
                            case null:
                                break;
                            case "attr": {
                                if (!c.$ || c.$.length != 1 || c.$[0].$t)
                                    throw new Error("Control definition wolf:" + id + " attribute name missing or type error");
                                var name = c.$[0].$;
                                if (name[0] == "$" || name == "ui")
                                    throw new Error("Control definition wolf:" + id + " attribute '" + name + "' not valid or reserved.");
                                if (name.indexOf(":") >= 0)
                                    throw new Error("Control definition wolf:" + id + " attribute '" + name + "' can not have namespaces.");
                                if (controller[name])
                                    throw new Error("Control definition wolf:" + id + " attribute '" + name + "' already defined.");
                                var attr = controller[name] = {};
                                attr.bindable = c.bindable !== "false";
                                attr.mandatory = c.mandatory == "true";
                                attr.default = c.default;
                                break;
                            }
                            case "event": {
                                if (!c.$ || c.$.length != 1 || c.$[0].$t)
                                    throw new Error("Control definition wolf:" + id + " event name missing or type error");
                                var name = c.$[0].$;
                                if (controller[name])
                                    throw new Error("Control definition wolf:" + id + " events and values can not share the same name  (" + name + ").");
                                if (controller["event:" + name])
                                    throw new Error("Control definition wolf:" + id + " event '" + name + "' already defined.");
                                controller["event:" + name] = { bindable: false, mandatory: false };
                                break;
                            }
                            case "ui": {
                                var uid = c.id || "";
                                if (ui[uid])
                                    throw new Error("Control definition wolf:" + id + " ui " + (uid == "" ? "[default]" : "'" + uid + "'") + " already defined.");
                                ui[uid] = c.$;
                                break;
                            }
                            case "script": {
                                if (scriptFactory)
                                    throw new Error("Control definition wolf:" + id + " script already defined.");
                                var script = c.$[0].$;
                                if (script && (typeof script != "string" || script.indexOf("use strict") < 1))
                                    throw new Error("Control definition wolf:" + id + " script 'use strict'; mandatory");
                                scriptFactory = new Function('control', 'K', 'D', 'UI', 'TOOLS', `${script};\n//# sourceURL=wolf:${id}`);
                                break;
                            }
                            default:
                                throw new Error("Control definition wolf:" + id + " " + c.type + " not allowed here.");
                        }
                    });

                    if (scriptFactory) {//TODO: use this single instance of script
                        var script = new scriptFactory(null, K, D, UI, TOOLS);
                        if (script.define)
                            controller = script.define(controller);
                    }

                    // Controller logics (new definition rendering) =============
                    controller.$init = function (template) {
                        if (template.$ && template.$.length && !allowChildren)
                            throw new Error("wolf:" + id + " does not allow child nodes");
                    };

                    controller.$ctor = function (template, ext) {
                        var parentCustom = ext.customController;
                        ext = {}.merge(ext); //Copy of ext instance
                        // Initialize attributes and script
                        var values = getControlAttributesTable(controller, template);
                        var API = {
                            ui: (name, clone) => {
                                var result = name ? ui[name] : ui[""];
                                return clone !== false ? UI.cloneTemplate(result) : result;
                            },
                            value: name => {
                                var data = values[name];
                                if (data instanceof D.Binding)
                                    data = data.getValue(ext.parent);
                                return data;
                            },
                            binding: name => {
                                var data = values[name];
                                if (data instanceof D.Binding)
                                    return data;
                                return null;
                            },
                            childs: name => ext.getChildNodes(name),
                            global: controlGlobal,
                            parent: ext.parent,
                            values: values,
                        }
                        var script = scriptFactory ? new scriptFactory(API, K, D, UI, TOOLS) : {};
                        API.controller = script;
                        API.instanceTemplate = (templ, ext2) => UI.instanceTemplate(templ, ext2 ? ext2 : { parent: ext.parent, customController: script })
                        if (!script.render)
                            script.render = () => {
                                for (var k in ui)//return first if any
                                    return ui[k];
                                throw new Error("wolf:" + id + " does not have ui defined");
                            }

                        // Event mirror and attribute hook
                        for (var k in values)
                            if (k.startsWith("event:")) {
                                var name = k.substring(6);
                                script["$" + name] = eventProxy(values["event:" + name], name, ext);
                            }
                        for (var k in controller)
                            if (k.startsWith("event:") && !script["$" + k.substring(6)]) {
                                script["$" + k.substring(6)] = function () { }; //Empty event
                            }

                        ext.getChildNodes = function (id) {
                            //ID for usage on future with multiple chilnodes block definitions
                            return template.$;
                        }
                        ext.customController = script;
                        ext.parentCustom = parentCustom;
                        //TODO: Replace with a local binding (bindings to values object only, creating a local model only for this control)
                        //      - access this local binding with {$name}
                        ext.onRender = function (element, template) {
                            if (!template.$t && template.$ && template.$[0] == "$") {
                                var data = values[template.$.substr(1)];
                                if (data instanceof D.Binding)
                                    data.bindExecutor(element,
                                        null,
                                        null,
                                        read => element.nodeValue = read({ element: element }, "string")
                                    );
                                else
                                    element.nodeValue = data;
                            }
                            for (var k in template) {
                                if (k[0] == "$")
                                    continue;
                                var attr = template[k];
                                if (attr && attr[0] == "$") {
                                    var data = values[attr.substr(1)];
                                    if (data instanceof D.Binding)
                                        data.bindExecutor(element,
                                            null,
                                            null,
                                            read => element.setAttribute(k, read({ element: element }, "string"))
                                        );
                                    else
                                        element.setAttribute(k, data);
                                }
                            }
                        }
                        //TODO: Create control defined custom properties for attributes that change the attribute values
                        script.init && script.init();

                        // Generate DOM
                        return renderControlDOM(ext);
                    };
                    UI.registerElement(id, controller);
                },
                id: { bindable: false, mandatory: true },
                allowchildren: { bindable: false },
                childs: { bindable: false }
            });

            UI.registerElement("children", {
                $ctor: function (template, ext) {
                    if (!ext.getChildNodes)
                        throw new Error("wolf:children can only be used inside a wolf:control UI definition");
                    var childTemplate = ext.getChildNodes(template.id);
                    var dom = [];
                    // Clear custom control private controller and API
                    ext = { parent: ext.parent }
                    for (var i in childTemplate)
                        dom = dom.concat(UI.instanceTemplate(childTemplate[i], ext));
                    return dom;
                },
                id: { bindable: false }
            })
        }

        // ====================
        // ====================
        // ==         Injection
        // ====================
        InitControlDefinitions();

        wolf.merge({
            // UI
            toast: toast,
            dialog: dialog,
            messageDialog: messageDialog,
            uiDialog: uiDialog,
            loadLibrary: loadLibrary,
        });
    });
})();
