/*  wolf.ui 0.6, UI components for wolf, a lightweight framework for web page creation.
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
        function InitExtensibleUI() {
            UI.registerElement("control", {
                init: template => {
                },
                postInit: template => {
                    var id = template.w.id;
                    var controller = {};
                    var ui = {};
                    var ev = {};
                    var script;
                    template.c.forEach(c => {
                        switch (c.type) {
                            case "attr": {
                                if (c.c.length != 1 || c.c[0].type)
                                    throw new Error("Control definition wolf:" + id + " attribute name missing or type error");
                                var name = c.c[0].value;
                                if (name == "init" || name == "postInit" || name == "ctor" || name == "ui")
                                    throw new Error("Control definition wolf:" + id + " attribute '" + name + "' reserved.");
                                if (controller[name])
                                    throw new Error("Control definition wolf:" + id + " attribute '" + name + "' already defined.");
                                var attr = controller[name] = {};
                                if (c.a.bindable)
                                    attr.bindable = c.a.bindable == "true";
                                if (c.a.mandatory)
                                    attr.mandatory = c.a.mandatory == "true";
                                break;
                            }
                            case "event": {
                                if (c.c.length != 1 || c.c[0].type)
                                    throw new Error("Control definition wolf:" + id + " event name missing or type error");
                                var name = c.c[0].value;
                                if (ev[name])
                                    throw new Error("Control definition wolf:" + id + " event '" + name + "' already defined.");
                                ev[name] = true;
                                break;
                            }
                            case "ui": {
                                var id = c.a.id || "·";
                                if (ui[id])
                                    throw new Error("Control definition wolf:" + id + " ui " + (id == "·" ? "" : "'" + id + "'") + " already defined.");
                                ui[id] = c.c;
                                break;
                            }
                            case "script": {
                                script = c.c[0].value;// TODO As script uses { character is processed as binding but it is not a binding, define a way to avoid bindings on scripts (detenct " character too??)
                                break;
                            }
                            default:
                                throw new Error("Control definition wolf:" + id + " " + c.type + " not allowed here.");
                        }
                    });
                    if (script && (typeof script != "string" || script.indexOf("use strict") < 1))
                        throw new Error("Control definition wolf:" + id + " script 'use strict'; mandatory");
                    var loader = new Function();
                },
                ctor: (template, ext) => {
                },
                id: { bindable: false, mandatory: true },
                childs: { bindable: false }
            });
        }

        // ====================
        // ====================
        // ==         Injection
        // ====================
        InitExtensibleUI();
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