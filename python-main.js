/*
A simple editor that targets MicroPython for the BBC micro:bit.

Feel free to have a look around! (We've commented the code so you can see what
everything does.)
*/

/*
Returns an object that defines the behaviour of the Python editor. The editor
is attached to the div with the referenced id.
*/
function pythonEditor(id) {
    'use strict';

    // An object that encapsulates the behaviour of the editor.
    var editor = {};
    editor.initialFontSize = 22;
    editor.fontSizeStep = 4;

    // Represents the ACE based editor.
    var ACE = ace.edit(id);  // The editor is in the tag with the referenced id.
    ACE.setOptions({
        enableSnippets: true  // Enable code snippets.
    });
    ACE.setTheme("ace/theme/kr_theme");  // Make it look nice.
    ACE.getSession().setMode("ace/mode/python");  // We're editing Python.
    ACE.getSession().setTabSize(4); // Tab=4 spaces.
    ACE.getSession().setUseSoftTabs(true); // Tabs are really spaces.
    ACE.setFontSize(editor.initialFontSize);
    editor.ACE = ACE;

    // Gets the textual content of the editor (i.e. what the user has written).
    editor.getCode = function() {
        return ACE.getValue();
    };

    // Sets the textual content of the editor (i.e. the Python script).
    editor.setCode = function(code) {
        ACE.setValue(code);
    };

    // Give the editor user input focus.
    editor.focus = function() {
        ACE.focus();
    };

    // Set a handler function to be run if code in the editor changes.
    editor.on_change = function(handler) {
        ACE.getSession().on('change', handler);
    };

    // Return details of all the snippets this editor knows about.
    editor.getSnippets = function() {
        var snippetManager = ace.require("ace/snippets").snippetManager;
        return snippetManager.snippetMap.python;
    };

    // Triggers a snippet by name in the editor.
    editor.triggerSnippet = function(snippet) {
        var snippetManager = ace.require("ace/snippets").snippetManager;
        snippet = snippetManager.snippetNameMap.python[snippet];
        if (snippet) {
            snippetManager.insertSnippet(ACE, snippet.content);
        }
    };

    // Given a password and some plaintext, will return an encrypted version.
    editor.encrypt = function(password, plaintext) {
        var key_size = 24;
        var iv_size = 8;
        var salt = forge.random.getBytesSync(8);
        var derived_bytes = forge.pbe.opensslDeriveBytes(password, salt, key_size + iv_size);
        var buffer = forge.util.createBuffer(derived_bytes);
        var key = buffer.getBytes(key_size);
        var iv = buffer.getBytes(iv_size);
        var cipher = forge.cipher.createCipher('AES-CBC', key);
        cipher.start({iv: iv});
        cipher.update(forge.util.createBuffer(plaintext, 'binary'));
        cipher.finish();
        var output = forge.util.createBuffer();
        output.putBytes('Salted__');
        output.putBytes(salt);
        output.putBuffer(cipher.output);
        return encodeURIComponent(btoa(output.getBytes()));
    };

    // Given a password and cyphertext will return the decrypted plaintext.
    editor.decrypt = function(password, cyphertext) {
        var input = atob(decodeURIComponent(cyphertext));
        input = forge.util.createBuffer(input, 'binary');
        input.getBytes('Salted__'.length);
        var salt = input.getBytes(8);
        var key_size = 24;
        var iv_size = 8;
        var derived_bytes = forge.pbe.opensslDeriveBytes(password, salt, key_size + iv_size);
        var buffer = forge.util.createBuffer(derived_bytes);
        var key = buffer.getBytes(key_size);
        var iv = buffer.getBytes(iv_size);
        var decipher = forge.cipher.createDecipher('AES-CBC', key);
        decipher.start({iv: iv});
        decipher.update(input);
        var result = decipher.finish();
        return decipher.output.getBytes();
    };

    return editor;
}

/*
The following code contains the various functions that connect the behaviour of
the editor to the DOM (web-page).

See the comments in-line for more information.
*/
function web_editor(config) {
    'use strict';

    // Instance of the pythonEditor object (the ACE text editor wrapper)
    var EDITOR = pythonEditor('editor');

    // Indicates if there are unsaved changes to the content of the editor.
    var dirty = false;

    // MicroPython filesystem to be initialised on page load.
    var micropythonFs;

    // Sets the description associated with the code displayed in the UI.
    function setDescription(x) {
        $("#script-description").text(x);
    }

    // Sets the name associated with the code displayed in the UI.
    function setName(x) {
        $("#script-name").text(x);
    }

    // Gets the description associated with the code displayed in the UI.
    function getDescription() {
        return $("#script-description").text();
    }

    // Gets the name associated with the code displayed in the UI.
    function getName() {
        return $("#script-name").text();
    }

    // Get the font size of the text currently displayed in the editor.
    function getFontSize() {
        return EDITOR.ACE.getFontSize();
    }

    // Set the font size of the text currently displayed in the editor.
    function setFontSize(size) {
        EDITOR.ACE.setFontSize(size);
    }

    // Sets up the zoom-in functionality.
    function zoomIn() {
        var continueZooming = true;
        // Change editor zoom
        var fontSize = getFontSize();
        fontSize += EDITOR.fontSizeStep;
        var fontSizeLimit = EDITOR.initialFontSize + (EDITOR.fontSizeStep * 6);
        if (fontSize > fontSizeLimit) {
            fontSize = fontSizeLimit;
            continueZooming = false;
        }
        setFontSize(fontSize);
        // Change Blockly zoom
        var workspace = Blockly.getMainWorkspace();
        if (workspace && continueZooming) {
            Blockly.getMainWorkspace().zoomCenter(1);
        }
    }

    // Sets up the zoom-out functionality.
    function zoomOut() {
        var continueZooming = true;
        // Change editor zoom
        var fontSize = getFontSize();
        fontSize -= EDITOR.fontSizeStep;
        var fontSizeLimit = EDITOR.initialFontSize - (EDITOR.fontSizeStep * 3);
        if(fontSize < fontSizeLimit) {
            fontSize = fontSizeLimit;
            continueZooming = false;
        }
        setFontSize(fontSize);
        // Change Blockly zoom
        var workspace = Blockly.getMainWorkspace();
        if (workspace && continueZooming) {
            Blockly.getMainWorkspace().zoomCenter(-1);
        }
    }

    // Checks for feature flags in the config object and shows/hides UI
    // elements as required.
    function setupFeatureFlags() {
        if(config.flags.blocks) {
            $("#command-blockly").removeClass('hidden');
        }
        if(config.flags.snippets) {
            $("#command-snippet").removeClass('hidden');
        }
        if(config.flags.share) {
            $("#command-share").removeClass('hidden');
        }
        // Update the help link to pass feature flag information.
        var helpAnchor = $("#help-link");
        var featureQueryString = Object.keys(config.flags).filter(function(f) {
            return config.flags[f];
        }).map(function(f) {
            return encodeURIComponent(f) + "=true";
        }).join("&");
        helpAnchor.attr("href", helpAnchor.attr("href") + "?" + featureQueryString); 
    }

    // Update the docs link to append MicroPython version
    var docsAnchor = $("#docs-link"); 
    docsAnchor.attr("href", docsAnchor.attr("href") + "en/" + "v" + UPY_VERSION);

    // This function is called to initialise the editor. It sets things up so
    // the user sees their code or, in the case of a new program, uses some
    // sane defaults.
    function setupEditor(message, migration) {
        // Set version in document title
        document.title = document.title + ' ' + EDITOR_VERSION;
        // Setup the Ace editor.
        if(message.n && message.c && message.s) {
            var template = $('#decrypt-template').html();
            Mustache.parse(template);
            var context = config.translate.decrypt;
            if (message.h) {
                context.hint = '(Hint: ' + decodeURIComponent(message.h) + ')';
            }
            vex.open({
                content: Mustache.render(template, context)
            });
            $('#button-decrypt-link').click(function() {
                var password = $('#passphrase').val();
                setName(EDITOR.decrypt(password, message.n));
                setDescription(EDITOR.decrypt(password, message.c));
                EDITOR.setCode(EDITOR.decrypt(password, message.s));
                vex.close();
                EDITOR.focus();
            });
        } else if(migration != null){
            setName(migration.meta.name);
            setDescription(migration.meta.comment);
            EDITOR.setCode(migration.source);
            EDITOR.focus();
        } else {
            // If there's no name, default to something sensible.
            setName("microbit");
            // If there's no description, default to something sensible.
            setDescription("A MicroPython script");
            // A sane default starting point for a new script.
            EDITOR.setCode(config.translate.code.start);
        }
        EDITOR.ACE.gotoLine(EDITOR.ACE.session.getLength());
        // If configured as experimental update editor background to indicate it
        if(config.flags.experimental) {
            EDITOR.ACE.renderer.scroller.style.backgroundImage = "url('static/img/experimental.png')";
        }
        // Configure the zoom related buttons.
        $("#zoom-in").click(function (e) {
            e.stopPropagation();
            zoomIn();
        });
        $("#zoom-out").click(function (e) {
            e.stopPropagation();
            zoomOut();
        });
        window.setTimeout(function () {
            // What to do if the user changes the content of the editor.
            EDITOR.on_change(function () {
                dirty = true;
            });
        }, 1);
        // Handles what to do if the name is changed.
        $("#script-name").on("input keyup blur", function () {
            dirty = true;
        });
        // Handles what to do if the description is changed.
        $("#script-description").on("input keyup blur", function () {
            dirty = true;
        });
        // Describes what to do if the user attempts to close the editor without first saving their work.
        window.addEventListener("beforeunload", function (e) {
            if (dirty) {
                var confirmationMessage = config.translate.confirms.quit;
                (e || window.event).returnValue = confirmationMessage;
                return confirmationMessage;
            }
        });
        // Bind the ESCAPE key.
        $(document).keyup(function(e) {
            if (e.keyCode == 27) { // ESCAPE
                $('#link-log').focus();
            }
        });
        // Bind drag and drop into editor.
        $('#editor').on('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
        });
        $('#editor').on('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
        });
        $('#editor').on('drop', doDrop);
        // Focus on the element with TAB-STATE=1
        $("#command-download").focus();
    }

    // Sets up the file system and adds the initial main.py
    function setupFilesystem() {
        micropythonFs = new microbitFs.MicropythonFsHex($('#firmware').text());
        // Get initial main.py
        micropythonFs.write('main.py', EDITOR.getCode()); // Add main.py
    }

    // Based on the Python code magic comment it detects a module
    function isPyModule(codeStr) {
        var isModule = false;
        if (codeStr.length) {
            var codeLines = codeStr.split(/\r?\n/);
            // Only look at the first three lines
            for (var i = 0; i < 3; i++) {
                if (codeLines[i].indexOf('# microbit-module:') == 0) {
                    isModule = true;
                }
            }
        }
        return isModule;
    }

    // Loads Python code into the editor and/or filesystem
    function loadPy(filename, codeStr) {
        var isModule = isPyModule(codeStr);
        var moduleName = filename.replace('.py', '');
        filename = isModule ? filename : 'main.py';
        var showModuleLoadedAlert = true;
        if (isModule && micropythonFs.exists(filename)) {
            if (!confirm(config.translate.confirms.replace_module.replace('{{module_name}}', moduleName))) {
                return;
            }
            // A confirmation box to replace the module has already been accepted
            showModuleLoadedAlert = false;
        }
        if (codeStr) {
            try {
                micropythonFs.write(filename, codeStr);
            } catch(e) {
                alert(config.translate.alerts.load_code + '\n' + e.message);
            }
        } else {
            return alert(config.translate.alerts.empty);
        }
        if (isModule) {
            if (micropythonFs.getStorageRemaining() < 0){
                micropythonFs.remove(filename);
                return alert(config.translate.alerts.module_out_of_space);
            }
            if (showModuleLoadedAlert) {
                alert(config.translate.alerts.module_added.replace('{{module_name}}', moduleName));
            }
        } else {
            setName(moduleName);
            setDescription(config.translate.drop.python);
            EDITOR.setCode(codeStr);
            EDITOR.ACE.gotoLine(EDITOR.ACE.session.getLength());
        }
    }

    // Reset the filesystem and load the files from this hex file to the fs and editor
    function loadHex(filename, hexStr) {
        var errorMsg = '';
        var code = '';
        var importedFiles = [];
        var tryOldMethod = false;
        try {
            // If hexStr is parsed correctly it formats the file system before adding the new files
            importedFiles = micropythonFs.importFilesFromIntelHex(hexStr, {
                overwrite: true,
                formatFirst:true
            });
            // Check if imported files includes a main.py file
            if (importedFiles.indexOf('main.py') > -1) {
                code = micropythonFs.read('main.py');
            } else {
                // There is no main.py file, but there could be appended code
                tryOldMethod = true;
                errorMsg += config.translate.alerts.no_main + '\n';
            }
        } catch(e) {
           tryOldMethod = true;
           errorMsg += e.message + '\n';
        }
        if (tryOldMethod) {
            try {
                code = microbitFs.getIntelHexAppendedScript(hexStr);
                micropythonFs.write('main.py', code);
            } catch(e) {
                // Only display an error if there were no files added to the filesystem
                if (!importedFiles.length) {
                    errorMsg += config.translate.alerts.no_script + '\n';
                    errorMsg += e.message;
                    return alert(config.translate.alerts.no_python + '\n\n' +
                            config.translate.alerts.error + errorMsg);
                }
            }
        }
        setName(filename.replace('.hex', ''));
        setDescription(config.translate.drop.hex);
        EDITOR.setCode(code);
        EDITOR.ACE.gotoLine(EDITOR.ACE.session.getLength());
    }

    // Function for adding file to filesystem
    function loadFileToFilesystem(filename, fileBytes) {
        // Check if file already exists and confirm overwrite
        if (filename !== 'main.py' && micropythonFs.exists(filename)) {
            if (!confirm(config.translate.confirms.replace_file.replace('{{file_name}}', filename))) {
                return;
            }
        }
        // For main.py confirm if the user wants to replace the editor content
        if (filename === 'main.py' && !confirm(config.translate.confirms.replace_main)) {
            return;
        }
        try {
            micropythonFs.write(filename, fileBytes);
            // Check if the filesystem has run out of space
            var _ = micropythonFs.getIntelHex();
        } catch(e) {
            if (micropythonFs.exists(filename)) {
                micropythonFs.remove(filename);
            }
            return alert(config.translate.alerts.cant_add_file + filename + '\n' + e.message);
        }
        if (filename == 'main.py') {
            // TODO: This will probably break in IE10
            var utf8 = new TextDecoder('utf-8').decode(fileBytes);
            EDITOR.setCode(utf8);
        }
    }

    // Update the widget that shows how much space is used in the filesystem
    function updateStorageBar() {
        var modulesSize = 0;
        var otherSize = 0;
        var mainSize = 0;
        var totalSpace = micropythonFs.getStorageSize();
        try {
            micropythonFs.write('main.py', EDITOR.getCode());
            mainSize = micropythonFs.size('main.py');
        } catch(e) {
            // No need to do any action with an error, just keep the size 0
        }
        micropythonFs.ls().forEach(function(filename) {
            var extension = filename.split('.').pop();
            if (extension === 'py') {
                if (filename !== 'main.py') {
                    modulesSize += micropythonFs.size(filename);
                }
            } else {
                otherSize += micropythonFs.size(filename);
            }
        });
        var firstTrFound = false;
        var setTrEl = function(trEl, sizePercentage) {
            if (sizePercentage > 0) {
                trEl.css('display','');
                trEl.css('width', Math.ceil(sizePercentage) + '%');
                if (!firstTrFound) {
                    trEl.attr('class', 'fs-space-table-first');
                    firstTrFound = true;
                } else {
                    trEl.attr('class', '');
                }
            } else {
                trEl.css('display', 'none');
            }
        };
        setTrEl($('#fs-space-modules'), modulesSize * 100 / totalSpace);
        setTrEl($('#fs-space-main'), mainSize * 100 / totalSpace);
        setTrEl($('#fs-space-other'), otherSize * 100 / totalSpace);
        // If we are out of free space hide the "free" box
        if ((modulesSize  + mainSize + otherSize) > (totalSpace * 0.98)) {
            $('#fs-space-free').css('display', 'none');
        } else {
            $('#fs-space-free').css('display', '');
        }
    }

    // Regenerate the table showing the file list and call for the storage bar to be updated
    var updateFileTables = function() {
        // Delete the current table body content and add rows file by file
        $('.fs-file-list table tbody').empty();
        micropythonFs.ls().forEach(function(filename) {
            var pseudoUniqueId = Math.random().toString(36).substr(2, 9);
            // Check for main.py to exclude it from the table list
            if (filename === 'main.py') return;
            var fileType = (/[.]/.exec(filename)) ? /[^.]+$/.exec(filename) : "";
            $('.fs-file-list table tbody').append(
                '<tr><td>' + filename + '</td>' +
                '<td>' + fileType + '</td>' +
                '<td>' + (micropythonFs.size(filename)/1024).toFixed(2) + ' Kb</td>' +
                '<td><button id="' + pseudoUniqueId + '" class="fs-remove-button">Remove</button></td></tr>'
            );
            $('#' + pseudoUniqueId).click(function(e) {
                micropythonFs.remove(filename);
                updateFileTables();
            });
        });
        // Hide the table if it is empty
        var fileRowsInTable = $('#fs-file-list>table>tbody').has('tr').length;
        if (!fileRowsInTable) {
            $('#fs-file-list>table').css('display', 'none');
        } else {
            $('#fs-file-list>table').css('display', '');
        }
        updateStorageBar();
    };

    // Generates the text for a hex file with MicroPython and the user code
    function generateFullHexStr() {
        var fullHexStr = '';
        try {
            // Remove main.py if editor content is empty to download a hex file
            // that includes the filesystem but doesn't try to run any code
            if (!EDITOR.getCode()) {
                if (micropythonFs.exists('main.py')) {
                    micropythonFs.remove('main.py');
                }
            } else {
                micropythonFs.write('main.py', EDITOR.getCode());
            }
            // Generate hex file
            fullHexStr = micropythonFs.getIntelHex();
        } catch(e) {
            // We generate a user readable error here to be caught and displayed
            throw new Error(config.translate.alerts.load_code + '\n' + e.message);
        }
        return fullHexStr;
    }

    // This function describes what to do when the download button is clicked.
    function doDownload() {
        try {
            var output = generateFullHexStr();
        } catch(e) {
            alert(config.translate.alerts.error + e.message);
            return;
        }
        var ua = navigator.userAgent.toLowerCase();
        if((ua.indexOf('safari/') > -1) && (ua.indexOf('chrome') == -1)) {
            alert(config.translate.alerts.download);
            window.open('data:application/octet;charset=utf-8,' + encodeURIComponent(output), '_newtab');
        } else {
            var filename = getName().replace(" ", "_");
            var blob = new Blob([output], {type: "application/octet-stream"});
            saveAs(blob, filename + ".hex");
        }
    }

    // This function describes what to do when the save button is clicked.
    function doSave() {
        var output = EDITOR.getCode();
        var ua = navigator.userAgent.toLowerCase();
        if((ua.indexOf('safari/') > -1) && (ua.indexOf('chrome') == -1)) {
            alert(config.translate.alerts.save);
            window.open('data:application/octet;charset=utf-8,' + encodeURIComponent(output), '_newtab');
        } else {
            var filename = getName().replace(" ", "_");
            var blob = new Blob([output], {type: "text/plain"});
            saveAs(blob, filename + ".py");
        }
        dirty = false;
    }

    // Describes what to do when the load button is clicked.
    function doLoad() {
        var template = $('#load-template').html();
        Mustache.parse(template);
        vex.open({
            content: Mustache.render(template, config.translate.load),
            afterOpen: function(vexContent) {
                $(vexContent).find('#load-drag-target').on('drag dragstart dragend dragover dragenter dragleave drop', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                })
                .on('dragover dragenter', function() {
                    $('#load-drag-target').addClass('is-dragover');
                })
                .on('dragleave dragend drop', function() {
                    $('#load-drag-target').removeClass('is-dragover');
                })
                .on('drop', function(e) {
                    doDrop(e);
                    vex.close();
                    EDITOR.focus();
                });
                $(vexContent).find('#load-form-form').on('submit', function(e){
                    e.preventDefault();
                    e.stopPropagation();
                    if(e.target[0].files.length === 1) {
                        var f = e.target[0].files[0];
                        var ext = (/[.]/.exec(f.name)) ? /[^.]+$/.exec(f.name) : null;
                        var reader = new FileReader();
                        if (ext == 'py') {
                            reader.onload = function(e) {
                                loadPy(f.name, e.target.result);
                            };
                            reader.readAsText(f);
                        } else if (ext == 'hex') {
                            reader.onload = function(e) {
                                loadHex(f.name, e.target.result);
                            };
                            reader.readAsText(f);
                        }
                    }
                    vex.close();
                    EDITOR.focus();
                    return false;
                });
                $('#fs-file-upload-button').click(function() {
                    $('#fs-file-upload-input').trigger('click');
                });
                $('#fs-file-upload-input').on('change', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    var inputFile = this;
                    Array.from(inputFile.files).forEach(function(file) {
                        var fileReader = new FileReader();
                        fileReader.onload = function(e) {
                            loadFileToFilesystem(file.name, new Uint8Array(e.target.result));
                            updateFileTables();
                        };
                        fileReader.readAsArrayBuffer(file);
                    });
                    inputFile.value = '';
                });
            }
        });
        $('.load-toggle').on('click', function(e) {
            $('.load-drag-target').toggle();
            $('.load-form').toggle();
        });
        updateFileTables();
    }

    // Triggered when a user clicks the blockly button. Toggles blocks on/off.
    function doBlockly() {
        var blockly = $('#blockly');
        if(blockly.is(':visible')) {
            dirty = false;
            blockly.hide();
            $('#editor').attr('title', '');
            editor.ACE.setReadOnly(false);
            $("#command-snippet").removeClass('disabled');
            $("#command-snippet").off('click');
            $("#command-snippet").click(function () {
              doSnippets();
            });
        } else {
            if(dirty) {
                if(!confirm(config.translate.confirms.blocks)) {
                    return;
                }
            }
            editor.ACE.setReadOnly(true);
            $('#editor').attr('title', 'The code editor is read-only when blocks are active.');
            $("#command-snippet").off('click');
            $("#command-snippet").click(function () {
              alert(config.translate.alerts.snippets);
            });
            $("#command-snippet").addClass('disabled');
            blockly.show();
            blockly.css('width', '33%');
            blockly.css('height', '100%');
            if(blockly.find('div.injectionDiv').length === 0) {
                // Calculate initial zoom level
                var zoomScaleSteps = 0.2;
                var fontSteps = (getFontSize() - EDITOR.initialFontSize) / EDITOR.fontSizeStep;
                var zoomLevel = (fontSteps * zoomScaleSteps) + 1.0;
                var workspace = Blockly.inject('blockly', {
                    toolbox: document.getElementById('blockly-toolbox'),
                    zoom: {
                        controls: false,
                        wheel: false,
                        startScale: zoomLevel,
                        scaleSpeed: zoomScaleSteps + 1.0
                    }
                });
                function myUpdateFunction(event) {
                    var code = Blockly.Python.workspaceToCode(workspace);
                    EDITOR.setCode(code);
                }
                // Resize blockly
                var element = document.getElementById('blockly');
                new ResizeSensor(element, function() {
                    Blockly.svgResize(workspace);
                });
                workspace.addChangeListener(myUpdateFunction);
            }
            // Set editor to current state of blocks.
            EDITOR.setCode(Blockly.Python.workspaceToCode(workspace));
        }
    }

    // This function describes what to do when the snippets button is clicked.
    function doSnippets() {
        // Snippets are triggered by typing a keyword followed by pressing TAB.
        // For example, type "wh" followed by TAB.
        var snippetManager = ace.require("ace/snippets").snippetManager;
        var template = $('#snippet-template').html();
        Mustache.parse(template);
        var context = {
            'title': config.translate.code_snippets.title,
            'description': config.translate.code_snippets.description,
            'instructions': config.translate.code_snippets.instructions,
            'trigger_heading': config.translate.code_snippets.trigger_heading,
            'description_heading': config.translate.code_snippets.description_heading,
            'snippets': snippetManager.snippetMap.python,
            'describe': function() {
                return function(text, render) {
                    var name = render(text);
                    var trigger = name.split(' - ')[0];
                    return config.translate.code_snippets[trigger];
                };
            }
        };
        vex.open({
            content: Mustache.render(template, context),
            afterOpen: function(vexContent) {
                $(vexContent).find('.snippet-selection').click(function(e){
                    var snippet_name = $(this).find('.snippet-name').text();
                    EDITOR.triggerSnippet(snippet_name);
                    vex.close();
                    EDITOR.focus();
                });
            }
        });
    }

    function doShare() {
        // Triggered when the user wants to generate a link to share their code.
        var template = $('#share-template').html();
        Mustache.parse(template);
        vex.open({
            content: Mustache.render(template, config.translate.share)
        });
        $('#passphrase').focus();
        $('#button-create-link').click(function() {
            var password = $('#passphrase').val();
            var hint = $('#hint').val();
            var qs_array = [];
            // Name
            qs_array.push('n=' + EDITOR.encrypt(password, getName()));
            // Comment
            qs_array.push('c=' + EDITOR.encrypt(password, getDescription()));
            // Source
            qs_array.push('s=' + EDITOR.encrypt(password, EDITOR.getCode()));
            // Hint
            qs_array.push('h=' + encodeURIComponent(hint));
            var old_url = window.location.href.split('?');
            var new_url = old_url[0].replace('#', '') + '?' + qs_array.join('&');
            $('#make-link').hide();
            $('#direct-link').val(new_url);
            $('#share-link').show();
            // shortener API
            var url = "https://www.googleapis.com/urlshortener/v1/url?key=AIzaSyB2_Cwh5lKUX4a681ZERd3FAt8ijdwbukk";
            $.ajax(url, {
                type: "POST",
                contentType: 'application/json',
                data: JSON.stringify({
                    longUrl: new_url
                })
            }).done(function( data ) {
                console.log(data);
                $('#short-link').attr('href', data.id);
                $('#short-link').text(data.id);
                $('#shortener').show();
            });
        });
    }

    function doDrop(e) {
        // Triggered when a user drops a file onto the editor.
        e.stopPropagation();
        e.preventDefault();
        var file = e.originalEvent.dataTransfer.files[0];
        var ext = (/[.]/.exec(file.name)) ? /[^.]+$/.exec(file.name) : null;
        var reader = new FileReader();
        if (ext == 'py') {
            setDescription(config.translate.drop.python);
            reader.onload = function(e) {
                loadPy(file.name, e.target.result);
            };
            reader.readAsText(file);
        } else if (ext == 'hex') {
            reader.onload = function(e) {
                loadHex(file.name, e.target.result);
            };
            reader.readAsText(file);
        }
        $('#editor').focus();
    }

    // Join up the buttons in the user interface with some functions for
    // handling what to do when they're clicked.
    function setupButtons() {
        $("#command-download").click(function () {
            doDownload();
        });
        $("#command-save").click(function () {
            doSave();
        });
        $("#command-load").click(function () {
            doLoad();
        });
        $("#command-blockly").click(function () {
            doBlockly();
        });
        $("#command-snippet").click(function () {
            doSnippets();
        });
        $("#command-share").click(function () {
            doShare();
        });
        $("#command-help").click(function () {
            if($(".helpsupport_container").css("display") == "none"){
                $(".helpsupport_container").css("display", "flex");
            } else {
                $(".helpsupport_container").css("display", "none");
            }
        });
        $(".helpsupport_container").hide();
    }

    // Extracts the query string and turns it into an object of key/value
    // pairs.
    function get_qs_context() {
        var query_string = window.location.search.substring(1);
        if(window.location.href.indexOf("file://") == 0 ) {
            // Running from the local file system so switch off network share.
            $('#command-share').hide();
            return {};
        }
        var kv_pairs = query_string.split('&');
        var result = {};
        for (var i = 0; i < kv_pairs.length; i++) {
            var kv_pair = kv_pairs[i].split('=');
            result[kv_pair[0]] = decodeURIComponent(kv_pair[1]);
        }
        return result;
    }

    function get_migration() {
        var compressed_project = window.location.toString().split("#project:")[1];
        if(typeof compressed_project === "undefined") return null;
        var bytes = base64js.toByteArray(compressed_project);
        var project = JSON.parse(LZMA.decompress(bytes));
        return project;
    }

    // Checks if this is the latest version of the editor. If not display an
    // appropriate message.
    function checkVersion(qs) {
        $.getJSON('../manifest.json').done(function(data) {
            if(data.latest === VERSION) {
                // Already at the latest version, so ignore.
                return;
            } else {
                // This isn't the latest version. Display the message bar with
                // helpful information.
                if(qs.force) {
                    // The inbound link tells us to force use of this editor.
                    // DO SOMETHING APPROPRIATE HERE? IF ANYTHING?
                }
                var template = $('#messagebar-template').html();
                Mustache.parse(template);
                var context = config.translate.messagebar;
                var messagebar = $('#messagebar');
                messagebar.html(Mustache.render(template, context));
                messagebar.show();
                $('#messagebar-link').attr('href',
                                           window.location.href.replace(VERSION, data.latest));
                $('#messagebar-close').on('click', function(e) {
                    $('#messagebar').hide();
                });
            }
        });
    }

    var qs = get_qs_context();
    var migration = get_migration();
    setupFeatureFlags();
    setupEditor(qs, migration);
    checkVersion(qs);
    setupButtons();
    window.onload = function() {
        // Firmware at the end of the HTML file has to be loaded first
        setupFilesystem();
    };
}
