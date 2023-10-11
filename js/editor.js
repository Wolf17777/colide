function init_editor() {
    require.config({ paths: { vs: 'monaco-editor/min/vs' } });
    require(['vs/editor/editor.main'], function () {
        // model.onDidChangeContent( content_change );
        let greeting = "Hi {{dev_user_info.first_name}}.";
        let hours = new Date().getHours();
        if (hours >= 22 || hours <= 6) greeting += "\nYou're up pretty late... zzz";
        model = monaco.editor.createModel(greeting);
        let fontSize = getCookie("dev-editor-fontSize");
        if (fontSize == "") fontSize = "16px";
        let theme = getCookie("dev-editor-theme");
        if (theme == "") {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) theme = "vs-dark";
            else theme='vs';
        }
        $("#fontSize-picker").val(parseInt(fontSize));
        editor_div.innerHTML = "";
        editor = monaco.editor.create(editor_div, {
            automaticLayout: true,
            readOnly: true,
            theme: theme,
            model: model,
            renderFinalNewline: false,
            fontSize: fontSize
        });
        editor.onDidChangeCursorPosition(cursor_position_changed);
        suggestion_mode = false;
        
        diff_editor = monaco.editor.createDiffEditor(diff_editor_div, {
            automaticLayout: true,
            renderSideBySide: true,
            //readOnly: true,
            theme: theme,
            renderFinalNewline: false,
            fontSize: fontSize
        });
        //diff_editor.getModifiedEditor().onDidChangeCursorPosition(cursor_position_changed);
        $('#loading_screen').hide();
        editor_ready = true;
        editor_div.style.zIndex = 1
        diff_editor_div.style.zIndex = 0
        if (current_file != "") init_file();
    });
}

function close_file(soft=false) {
    cursor_positions[current_file] = editor.saveViewState(); //editor.getPosition();
    if (synchronised_content != null) synchronised_content.dispose();
    synchronised_content = null;
    current_file_marks = {};
    last_mark_id = 0;
    unsaved_content = false
    exit_suggestion_mode(true);
    close_sidebar_right(true);
    model.dispose();
    if (!soft) {
        current_file = "";
        if (current_file_tree_selected_element != null) {
            current_file_tree_selected_element.classList.remove("selected");
            current_file_tree_selected_element = null
        }
        $("#code-header-filename").html("");
        $("#code-header-file-info").hide();
        document.title = title;
        history.replaceState(null, '', window.location.pathname);
        model = monaco.editor.createModel("I feel empty.");
        editor.setModel(model);
    }
    editor.updateOptions({ readOnly: true });
    //diff_editor.updateOptions({ readOnly: true });
}


function init_file(filepath=current_file) {
    if (!editor_ready || init_file_running) return;
    if ((unsaved_content || suggestion_unsaved) && !confirm("There are unsaved changes. Close anyway?") ) {
        return;
    }
    init_file_running = true;
    if (current_file != "")
        cursor_positions[current_file] = editor.saveViewState(); //editor.getPosition();
        //console.log(current_file);
    close_sidebar_right(true);
    current_file = filepath;
    let filepath_array = filepath.split("/");
    document.title = filepath_array[filepath_array.length-1];
    history.replaceState(null, '', window.location.pathname+'?file='+filepath);
    let filename_pretty = filepath_array.join("<span class='slash'>/</span>");
    if (filepath.endsWith("index.svelte")) {
        filename_pretty += ' <a title="build" class="slash" style="padding-right: 25px;" onclick="build_js()" href="#"><svg class="icon-visit-site"><use xlink:href="#wrench-circle"></use></svg></a>';
    }
    for (let template_folder_name of template_folder_names) {
        let tpath = filepath.split(template_folder_name)
        if (tpath.length > 1) {
            tpath = tpath[tpath.length-1];
            filename_pretty += ' <a title="visit this page" class="slash" style="padding-right: 25px;" href="'+tpath+'" target="_blank"><svg class="icon-visit-site"><use xlink:href="#si-bootstrap-globe"></use></svg></a>';
            break;
        }
    }
    
    $("#code-header-filename").html(filename_pretty);
    $("#code-header-file-info").show();
    add_alert('Reading file...', 'warning', 'alert_init_file', false);
    $.post( server_interface_path, { "get_file": current_file }, function( data ) {
        sync_id = data.latest_entry_id;
        synchronised_content = monaco.editor.createModel(data.content);
        current_file_marks = {};
        last_mark_id = 0;
        last_successful_probe = Date.now();
        read_only_access = data.access != "w";
        init_content();
        init_file_running = false;
        $("#alert_init_file").alert('close');
    }).fail(function( e ) {
        close_file(true);
        model = monaco.editor.createModel(e.responseText);
        editor.setModel(model);
        init_file_running = false;
        $("#alert_init_file").alert('close');
    });
}

function init_content() {
    exit_suggestion_mode(true);
    model.dispose();
    model = monaco.editor.createModel(synchronised_content.getValue(), undefined, monaco.Uri.file(current_file));
    model.onDidChangeContent( submit_changes );
    editor.setModel(model);
    editor.updateOptions({ readOnly: read_only_access });
    editor.focus();
    //diff_editor.updateOptions({ readOnly: read_only_access });
    if (cursor_positions[current_file] != undefined && cursor_positions[current_file] != null) {
        if (cursor_positions[current_file].viewState != undefined)
            editor.restoreViewState(cursor_positions[current_file]);
        else if (cursor_positions[current_file].lineNumber != undefined) {
            editor.setPosition(cursor_positions[current_file]);
            editor.revealLineInCenter(cursor_positions[current_file].lineNumber);
        }
    }
}

function calculate_diff_values(value1,value2,only_one_diff=false) {
    lines1 = value1.split("\n");
    lines2 = value2.split("\n");
    return patienceDiff(lines1, lines2, only_one_diff);
}

function calculate_diff(only_one_diff=false) {
    if (synchronised_content == null) return;
    return calculate_diff_values(synchronised_content.getValue(),model.getValue(),only_one_diff);
    //sync_lines = synchronised_content.getValue().split("\n");
    //check_lines = model.getValue().split("\n");
    //return patienceDiff(sync_lines, check_lines, only_one_diff);
}


function get_range_of_decoration(decoration_id) {
    if (decoration_id == null) return null;
    for (let i=1; i<= model.getValue().split("\n").length; i++) {
        for (d of editor.getLineDecorations(i)) {
            if (d.id == decoration_id) return d.range;
        }
    }
    return null;
}

suggestion_active_mark_id = undefined;
suggestion_unsaved = false;
function enter_suggestion_mode() {
    if (suggestion_mode == true || synchronised_content == null || current_file == "") return;
    if (suggestion_active_mark_id != undefined && current_file_marks[suggestion_active_mark_id] == undefined)
        suggestion_active_mark_id = undefined;
    if (suggestion_active_mark_id != undefined) {
        let m = current_file_marks[suggestion_active_mark_id];
        if (m.has_new_content) {
            diff_editor.setModel({
                original: monaco.editor.createModel(model.getValueInRange(m.range)),
                modified: monaco.editor.createModel(m.new_content, language=model.getLanguageId())
            });
        } else {
            let txt = model.getValueInRange(m.range);
            diff_editor.setModel({
                original: monaco.editor.createModel(txt),
                modified: monaco.editor.createModel(txt, language=model.getLanguageId())
            });
            $("#insert-change-div-text").html('<p>no changes<p><p style="line-height: 6px;"><br></p>');
        }
    } else {
        let txt = get_range_of_decoration(write_comment_decoration_id);
        if (txt == null) txt = editor.getSelection();
        txt = model.getValueInRange(get_range_of_decoration(write_comment_decoration_id));
        diff_editor.setModel({
            original: monaco.editor.createModel(txt),
            modified: monaco.editor.createModel(txt, language=model.getLanguageId())
        });
        $("#insert-change-div-text").html('<p>no changes<p><p style="line-height: 6px;"><br></p>');
    }
    suggestion_synced_model = monaco.editor.createModel(diff_editor.getModel().modified.getValue());
    diff_editor.getModel().modified.onDidChangeContent( submit_changes_diff );
    editor_div.style.zIndex = 0;
    diff_editor_div.style.zIndex = 1;
    $("#resolve_deny_button").hide();
    $("#resolve_button").hide();
    $("#insert-change-button").html("return");
    //$("#suggest_mode_button").html('<svg class="icon" style="fill: greenyellow;"><use xlink:href="#si-bootstrap-exit-suggest"></use></svg>');
    //$("#suggest_mode_button").prop('title', 'exit suggestion mode');
    suggestion_mode = true;
    $("#write-comment-textarea").focusout();
    diff_editor.focus();
}

function exit_suggestion_mode(force=false) {
    if (suggestion_mode == false || (!force && suggestion_unsaved && !confirm("There are unsaved suggestions. These will be lost. Exit anyway?") )  ) return;
    suggestion_synced_model = null;
    diff_editor.setModel(null);
    editor_div.style.zIndex = 1
    diff_editor_div.style.zIndex = 0
    suggestion_mode = false;
    suggestion_active_mark_id = undefined;
    suggestion_unsaved = false;
    $("#insert-change-server-state").html("");
    close_sidebar_right();
    editor.focus();
    redraw_marks();
    cursor_position_changed();
    //$("#suggest_mode_button").html('<svg class="icon"><use xlink:href="#si-bootstrap-suggest"></use></svg>');
    //$("#suggest_mode_button").prop('title', 'enter suggestion mode');
}

$("#theme_button").click(function(event) {
    //console.log(editor._themeService.getColorTheme().themeName)
    if (editor._themeService.getColorTheme().themeName == 'vs') {
        change_theme('vs-dark');
    } else {
        change_theme('vs');
    }
});

function change_theme(new_theme) {
    if (editor != null) 
        editor.updateOptions({ theme: new_theme });
    if (diff_editor != null) 
        diff_editor.updateOptions({ theme: new_theme });
    if (active_mark != null) redraw_marks([active_mark.id]);
    document.cookie = "dev-editor-theme="+new_theme+";SameSite=Strict;";
}

function font_size_picker_change(event) {
    let s = parseInt(event.target.value);
    if (isNaN(s)) change_font_size("16px");
    else if (s < 8) change_font_size("8px");
    else if (s > 32) change_font_size("32px");
    else change_font_size(s+"px");
}

function change_font_size(new_size) {
    if (editor != null) 
        editor.updateOptions({ fontSize: new_size });
    if (diff_editor != null) 
        diff_editor.updateOptions({ fontSize: new_size });
    if (active_mark != null) redraw_marks([active_mark.id]);
    document.cookie = "dev-editor-fontSize="+new_size+";SameSite=Strict;";
    $("#fontSize-picker").val(parseInt(new_size));
}
