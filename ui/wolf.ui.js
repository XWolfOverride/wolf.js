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
                UI.readTemplate(dom, (fragment) => {
                });
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
                    
                },
                ctor: (template, ext) => {
                },
                id: { bindable: false },
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