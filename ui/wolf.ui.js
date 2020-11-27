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
        var dlgctrl = {
            cnt: 0,
            modaling: false
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
         * @param {string} url Url of the fragment
         * @param {element} element Destination element, application element recommended
         * @param {boolean} modal True to show the dialog in modal way
         * @param {*} [controller] Controller for the dialogs events, if none the parent element one will be used
         * @param {function} [callback] Callback when the dialog is shown
         */
        function dialog(url, element, modal, controller, callback) {
            var modalWall, dialogFrame, modaling;
            if (modal) {
                if (!dlgctrl.modaling)
                    dlgctrl.modaling = modaling = true;
                modalWall = UI.instanceTemplate({ type: "div", a: { "class": "wolf-dialog-modal-wall" }, w: {} }, { parent: element })[0];
                element.appendChild(modalWall);
            }
            UI.loadFragment(url, (fragment) => {
                dialogFrame = UI.instanceTemplate({ type: "div", a: { "class": "wolf-dialog" }, w: {}, controller: controller }, { parent: modal ? modalWall : element })[0];
                dialogFrame.close = function () {
                    element.removeChild((modal ? modalWall : dialogFrame))
                    if (modaling)
                        dlgctrl.modaling = false;
                };
                (modal ? modalWall : element).appendChild(dialogFrame);
                fragment.insertTo(dialogFrame);
                callback && callback(dialogFrame, element);
            });
        }

        /**
         * Show a dialog asking or showing information.
         * @param {string} text Text to show
         * @param {*} buttons Button definition
         * @param {element} element Destination element, application element recommended
         * @param {boolean} modal True to show the dialog in modal way
         * @param {*} [controller] Controller for the dialogs events, if none the parent element one will be used
         * @param {function} [callback] Callback when the dialog is shown
         */
        function messageDialog(text, buttons, element, modal, controller, callback) {
            var modalWall, dialogFrame, modaling;
            if (modal) {
                modalWall = UI.instanceTemplate({ type: "div", a: { "class": "wolf-dialog-modal-wall" }, w: {} }, { parent: element })[0];
                if (!dlgctrl.modaling) {
                    dlgctrl.modaling = modaling = true;
                    modalWall.style.background = "transparent";
                }
                element.appendChild(modalWall);
            }
            dialogFrame = UI.instanceTemplate({ type: "div", a: { "class": "wolf-dialog wolf-dialog-message" }, w: {}, controller: controller }, { parent: modal ? modalWall : element })[0];
            dialogFrame.close = function () {
                element.removeChild((modal ? modalWall : dialogFrame))
                if (modaling)
                    dlgctrl.modaling = false;
            };
            (modal ? modalWall : element).appendChild(dialogFrame);

            controller = controller || {};
            var bts = [];
            buttons = buttons || { doOk: "Ok" };// Default ok button

            for (bt in buttons) {
                var btext = buttons[bt];
                var cancel = btext && btext[0] == '!';
                var deflt = btext && btext[0] == '*';
                if (cancel || deflt)
                    btext = btext.substr(1);
                bts.push({
                    type: "button", a: { class: deflt ? "default" : cancel ? "cancel" : "" }, w: {}, e: { click: bt }, c: [
                        { type: "", value: btext }
                    ]
                });
                controller[bt] = controller[bt] || dialogFrame.close;
            }

            var dlg = UI.instanceTemplate({
                type: "div", controller: controller, a: { "class": "wolf-dialog-message-body" }, w: {}, c: [
                    { type: "div", a: { "class": "wolf-dialog-message-text" }, w: {}, c: [{ type: "", value: text }] },
                    { type: "div", a: { "class": "wolf-dialog-message-buttons" }, w: {}, c: bts }
                ]
            }, { parent: element })[0];
            dialogFrame.appendChild(dlg);

            callback && callback(dialogFrame, element);
        }

        /**
         * Show a dialog asking or showing information.
         * @param {*} ui UI definition
         * @param {*} buttons Button definition
         * @param {element} element Destination element, application element recommended
         * @param {boolean} modal True to show the dialog in modal way
         * @param {*} [controller] Controller for the dialogs events, if none the parent element one will be used
         * @param {function} [callback] Callback when the dialog is shown
         */
        function uiDialog(ui, buttons, element, modal, controller, callback) {

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
                for (var k in template.w) {
                    var attr = template.w[k];
                    values[k] = attr;
                }
                return values;
            }

            /**
             * Generates the DOM of the control based on the script render method
             * @param {*} ext ctor extended info
             */
            function renderControlDOM(ext) {
                var tux = ext.customController.render();
                var ux = [];
                if (!tux)
                    return [];
                if (!Array.isArray(tux))
                    tux = [tux];
                for (var i in tux)
                    ux = ux.concat(UI.instanceTemplate(tux[i], ext));
                return ux;
            }

            /**
             * Create event proxy for linked event call
             * @param {string} method Controller method name
             * @param {string} ename Event name
             */
            function eventProxy(method, ename) {
                return function (element, event) {
                    var ctrl = element.getController();
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
                postInit: function (template) {
                    var id = template.w.id;
                    var allowChildren = template.w.allowchildren == "true";
                    var controller = {};
                    var ui = {};
                    var scriptFactory;

                    // Read definition
                    for (var i = 0; i < template.c.length; i++) {
                        var c = template.c[i];
                        switch (c.type) {
                            case "attr": {
                                if (c.c.length != 1 || c.c[0].type)
                                    throw new Error("Control definition wolf:" + id + " attribute name missing or type error");
                                var name = c.c[0].value;
                                if (name == "init" || name == "postInit" || name == "ctor" || name == "ui")
                                    throw new Error("Control definition wolf:" + id + " attribute '" + name + "' reserved.");
                                if (name.indexOf(":") >= 0)
                                    throw new Error("Control definition wolf:" + id + " attribute '" + name + "' can not have namespaces.");
                                if (controller[name])
                                    throw new Error("Control definition wolf:" + id + " attribute '" + name + "' already defined.");
                                var attr = controller[name] = {};
                                attr.bindable = c.a.bindable !== "false";
                                if (c.a.mandatory)
                                    attr.mandatory = c.a.mandatory == "true";
                                if (c.a.default)
                                    attr.default = c.a.default;
                                break;
                            }
                            case "event": {
                                if (c.c.length != 1 || c.c[0].type)
                                    throw new Error("Control definition wolf:" + id + " event name missing or type error");
                                var name = c.c[0].value;
                                if (controller[name])
                                    throw new Error("Control definition wolf:" + id + " events and values can not share the same name  (" + name + ").");
                                if (controller["event:" + name])
                                    throw new Error("Control definition wolf:" + id + " event '" + name + "' already defined.");
                                controller["event:" + name] = { bindable: false, mandatory: false };
                                break;
                            }
                            case "ui": {
                                var uid = c.a.id || "";
                                if (ui[uid])
                                    throw new Error("Control definition wolf:" + id + " ui " + (uid == "·" ? "" : "'" + uid + "'") + " already defined.");
                                ui[uid] = c.c;
                                break;
                            }
                            case "script": {
                                if (scriptFactory)
                                    throw new Error("Control definition wolf:" + id + " script already defined.");
                                var script = c.c[0].value;
                                if (script && (typeof script != "string" || script.indexOf("use strict") < 1))
                                    throw new Error("Control definition wolf:" + id + " script 'use strict'; mandatory");
                                scriptFactory = new Function('control', `${script};\n//# sourceURL=wolf:${id}`);
                                break;
                            }
                            default:
                                throw new Error("Control definition wolf:" + id + " " + c.type + " not allowed here.");
                        }
                    }

                    // Children tempaltes

                    // Controller logics (new definition rendering) =============
                    controller.postInit = function (template) {
                        if (template.c && template.c.length && !allowChildren)
                            throw new Error("wolf:" + id + " does not allow child nodes");
                    };
                    controller.ctor = function (template, ext) {
                        ext = {}.merge(ext); //Copy of ext instance
                        // Initialize attributes and script
                        var values = getControlAttributesTable(controller, template);
                        var API = {
                            ui: name => name ? ui[name] : ui[""],
                            value: name => {
                                var data = values[name];
                                if (data instanceof D.Binding)
                                    data.getValue(ext.parent);
                                return data;
                            }
                        }
                        var script = scriptFactory ? scriptFactory(API) : {};
                        API.controller = script;

                        if (!script.render)
                            script.render = () => {
                                var u = ui[""];
                                if (u)
                                    return u;
                                for (var k in ui)//return first if any
                                    return ui[k];
                                return [];
                            }

                        // Event mirror and attribute hook
                        for (var k in values)
                            if (k.startsWith("event:")) {
                                var name = k.substring(6);
                                script["$" + name] = eventProxy(values["event:" + name], name);
                            }
                        for (var k in controller)
                            if (k.startsWith("event:") && !script["$" + k.substring(6)]) {
                                script["$" + k.substring(6)] = function () { }; //Empty event
                            }

                        ext.getChildNodes = function (id) {
                            //ID for usage on future with multiple chilnodes block definitions
                            return template.c;
                        }
                        ext.customController = script;
                        ext.onInit = function (element, template) {
                            if (template.value && template.value[0] == "$") {
                                var data = values[template.value.substr(1)];
                                if (data instanceof D.Binding)
                                    data.bindExecutor(element,
                                        null,
                                        null,
                                        read => element.nodeValue = read({ element: element }, "string")
                                    );
                                else
                                    element.nodeValue = data;
                            }
                            for (var k in template.a) {
                                var attr = template.a[k];
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
                ctor: function (template, ext) {
                    if (!ext.getChildNodes)
                        throw new Error("wolf:children can only be used inside a wolf:control UI definition");
                    var childTemplate = ext.getChildNodes(template.w.id);
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