function rec_retrieve_dir(open_file, dirname, dir_root, level = 0) {
    let ret = [];
    let ret_dir = [];
    let ret_file = [];
    let dir_opened = open_file.startsWith(dirname);
    for (let d in dir_root.dirs) {
        let sub_dir_opened = open_file.startsWith(dirname+d)
        let element = document.createElement("div");
        element.className = "filename";
        element.classList.add("folder");
        icon = "bootstrap-folder-close";
        let span = document.createElement("span");
        span.innerHTML = '<svg class="icon"><use xlink:href="#si-'+icon+'" /></svg> ' + d;
        span.style.display = "block";
        span.addEventListener("click", function(ev){
            let el = ev.target;
            while (! el.classList.contains("filename")) {
                el = el.parentElement;
            }
            if (el.classList.contains("open")) {
                el.classList.remove("open");
                for (c of el.children) {
                    if (c.classList.contains('filename')) c.style.display = "none";
                }
            } else {
                el.classList.add("open");
                for (c of el.children) {
                    if (c.classList.contains('filename')) c.style.display = "block";
                }
            }
        });
        element.appendChild(span)
        element.style.marginLeft = (level * 5) + "px";
        if (!dir_opened) element.style.display = "none";
        if (sub_dir_opened) element.classList.add("open");
        childs = rec_retrieve_dir(open_file, dirname+d+"/", dir_root.dirs[d], level+1);
        for (c of childs) {
            element.appendChild(c);
        }
        element.setAttribute("dirname", d);
        ret_dir.push(element);
    }
    ret_dir.sort(function(x, y) {
        return x.getAttribute("dirname").toLowerCase() > y.getAttribute("dirname").toLowerCase();
    });
    for (f of dir_root.files) {
        filename = f[0].split("/");
        filename = filename[filename.length-1];
        if (f[1] == "w") {
        } else if (f[1] == "r") {
            filename = filename+" (readonly)";
        } else {
            filename = filename+" (no access)";
        }
        let element = document.createElement("div");
        element.className = "filename";
        element.classList.add("file");
        element.setAttribute("filename", filename)
        element.setAttribute("full_path", f[0])
        let icon = "bootstrap-file";
        let span = document.createElement("span");
        span.innerHTML = '<svg class="icon"><use xlink:href="#si-'+icon+'" /></svg> ' + filename;
        span.style.display = "block";

        if (f[1] == "w" || f[1] == "r") {
            span.setAttribute("fullpath", f[0])
            if (f[0] == open_file) {
                current_file_tree_selected_element = element;
                current_file_tree_selected_element.classList.add("selected");
                last_files_append(current_file_tree_selected_element);
            }
            span.addEventListener("click", function(ev){
                if (!editor_ready) return;
                let e = ev.target
                let fp = e.getAttribute("fullpath");
                while (fp == null && e.parentElement != null) {
                    e = e.parentElement
                    fp = e.getAttribute("fullpath"); // ev.target is the svg
                }
                if (fp != null) {
                    if (current_file_tree_selected_element != null) {
                        current_file_tree_selected_element.classList.remove("selected");
                    }
                    current_file_tree_selected_element = e.parentElement;
                    current_file_tree_selected_element.classList.add("selected");
                    last_files_append(current_file_tree_selected_element);
                    init_file(fp);
                }
            });
            
            svg = document.createElement("span");
            svg.innerHTML = '<svg class="icon"><use xlink:href="#si-new-tab" /></svg>' //'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">  <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/></svg>'; //'<use xlink:href="#si-'+icon+'" />';
            svg.classList.add("right");
            svg.classList.add("rename");
            svg.title = "open in new tab";
            svg.setAttribute("fullpath", f[0]);
            svg.addEventListener("click", function(ev) {
                
                if (!editor_ready) return;
                let e = ev.target
                let fp = e.getAttribute("fullpath");
                //console.log(fp);
                while (fp == null && e.parentElement != null) {
                    e = e.parentElement
                    fp = e.getAttribute("fullpath"); // ev.target is the svg
                }
                if (fp != null) {
                    window.open(window.location.pathname+"?file="+fp, '_blank').focus();
                    ev.stopPropagation();
                }
                
            });
            span.appendChild(svg);
            /*
            svg = document.createElement("span");
            svg.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">  <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/></svg>'; //'<use xlink:href="#si-'+icon+'" />';
            svg.classList.add("right");
            svg.classList.add("rename");
            
            svg.setAttribute("fullpath", f[0]);
            svg.addEventListener("click", function(ev) {
                let e = ev.target
                let fp = e.getAttribute("fullpath");
                while (fp == null && e.parentElement != null) {
                    e = e.parentElement
                    fp = e.getAttribute("fullpath"); // ev.target is the svg
                }
                ev.stopPropagation();
            });
            span.appendChild(svg);
            svg = document.createElement("span");
            icon = "bootstrap-trash";
            svg.innerHTML = '<svg class="icon"><use xlink:href="#si-'+icon+'" /></svg>';
            svg.classList.add("right");
            svg.classList.add("trash");
            
            svg.setAttribute("fullpath", f[0]);
            svg.addEventListener("click", function(ev) {
                let e = ev.target
                let fp = e.getAttribute("fullpath");
                while (fp == null && e.parentElement != null) {
                    e = e.parentElement
                    fp = e.getAttribute("fullpath"); // ev.target is the svg
                }
                ev.stopPropagation();
            });
            span.appendChild(svg);
            */
        }
        element.appendChild(span);

        element.style.marginLeft = (level * 5) + "px";
        if (!dir_opened) element.style.display = "none";
        
        ret_file.push(element);
    }
    ret_file.sort(function(x, y) {
        return x.getAttribute("filename").toLowerCase() > y.getAttribute("filename").toLowerCase();
    });
    return ret_dir.concat(ret_file);
}


function init_file_tree(open_file=current_file) {
    if ( init_file_tree_running ) return;
    init_file_tree_running = true;
    add_alert('Fetching file tree...', 'warning', 'alert_init_file_tree', false);
    $.post( server_interface_path, { "get_file_tree": 1 }, function( data ) {
        file_tree = data.tree;
        let container = $("#folder-files");
        container.html("");
        for (c of rec_retrieve_dir(open_file, "",file_tree)) {
            //c.style.display = "block";
            container.append(c);
        }
        init_file_tree_running = false;
        $("#alert_init_file_tree").alert('close');
    }).fail(function( e ) {
        alert(e.responseText);
        init_file_tree_running = false;
        $("#alert_init_file_tree").alert('close');
    });
}


file_execute_action = 'none'

function file_execute() {
    $("#fileModal").modal('hide');
    if (file_execute_action=='new') {
        f = $('#input_file1').val();
        if (f == null) return false;
        while (f.length != 0 && f[0] == "/") f = f.substring(1);
        if (f == null || f == "") return false;
        $.post( server_interface_path, { file_create: f }, function( data ) {
            init_file(f);
            init_file_tree();
        }).fail(function( e ) {
            alert(e.responseText);
        });
    } else if (file_execute_action=='move') {
        let f = $('#input_file1').val();
        if (f == null) return false;
        while (f.length != 0 && f[0] == "/") f = f.substring(1);
        if (f == null || f == "") return false;
        let f2 = $('#input_file2').val();
        if (f2 == null) return false;
        while (f2.length != 0 && f2[0] == "/") f2 = f2.substring(1);
        if (f2 == null || f2 == "") return false;
        $.post( server_interface_path, { file_move: f, file_target: f2 }, function( data ) {
            init_file(f2);
            init_file_tree();
        }).fail(function( e ) {
            alert(e.responseText);
        });
    } else if (file_execute_action=='copy') {
        let f = $('#input_file1').val();
        if (f == null) return false;
        while (f.length != 0 && f[0] == "/") f = f.substring(1);
        if (f == null || f == "") return false;
        let f2 = $('#input_file2').val();
        if (f2 == null) return false;
        while (f2.length != 0 && f2[0] == "/") f2 = f2.substring(1);
        if (f2 == null || f2 == "") return false;
        $.post( server_interface_path, { file_copy: f, file_target: f2 }, function( data ) {
            init_file(f2);
            init_file_tree();
        }).fail(function( e ) {
            alert(e.responseText);
        });
    } else if (file_execute_action=='delete') {
        let f = $('#input_file1').val();
        if (f == null) return false;
        while (f.length != 0 && f[0] == "/") f = f.substring(1);
        if (f == null || f == "") return false;
        if (!confirm("Are you sure you want to delete "+f+"?")) return false;
        if (f == current_file) close_file();
        $.post( server_interface_path, { file_delete: f }, function( data ) {
            init_file_tree();
        }).fail(function( e ) {
            alert(e.responseText);
        });
    }
    return false;
}

function new_file() {
    $('fileModalLabel').val('New file');
    $('#input_file1_label').html("Enter the full path of the new file (non-existing folders will be created)");
    $('#input_file1').val(current_file);
    $('#input_file_button').html('Create');
    file_execute_action = 'new';
    $('#input_file2_label').hide();
    $('#input_file2').hide();
    $("#fileModal").modal('show');
    $('#input_file1').focus();
}

function move_file() {
    $('fileModalLabel').val('Move file');
    $('#input_file1_label').html("Enter the full path of the file you want to move");
    $('#input_file1').val(current_file);
    $('#input_file2_label').html("Enter the full path of where you want to move the file (non-existing folders will be created)");
    $('#input_file2').val(current_file);
    $('#input_file_button').html('Move');
    file_execute_action = 'move';
    $('#input_file2_label').show();
    $('#input_file2').show();
    $("#fileModal").modal('show');
    $('#input_file1').focus();
}
function copy_file() {
    $('fileModalLabel').val('Copy file');
    $('#input_file1_label').html("Enter the full path of the file you want to copy");
    $('#input_file1').val(current_file);
    $('#input_file2_label').html("Enter the full path of the file that will be a copy of the selected file (non-existing folders will be created)");
    $('#input_file2').val(current_file);
    $('#input_file_button').html('Copy');
    file_execute_action = 'copy';
    $('#input_file2_label').show();
    $('#input_file2').show();
    $("#fileModal").modal('show');
    $('#input_file1').focus();
}
function delete_file() {
    $('fileModalLabel').val('Delete file');
    $('#input_file1_label').html("Enter the full path of the file or folder you want to delete.");
    $('#input_file1').val(current_file);
    $('#input_file_button').html('Delete');
    file_execute_action = 'delete';
    $('#input_file2_label').hide();
    $('#input_file2').hide();
    $("#fileModal").modal('show');
    $('#input_file1').focus();
}
function refresh_files() {
    init_file_tree();
    init_file();
}


refresh_gunicorn_running = false;
function refresh_gunicorn() {
    if (refresh_gunicorn_running) return;
    refresh_gunicorn_running = true;
    add_alert('Refreshing...', 'warning', 'alert_refresh_gunicorn', false);
    $.post( server_interface_path, { reload_gunicorn: 1 }, function( data ) {
        if (data.answer != "success") alert("Reloading gunicorn failed: " + data.answer);
        else add_alert('Successfully refreshed gunicorn.', 'success', '', true, "#alert_div",4000);
        refresh_gunicorn_running = false;
        $("#alert_refresh_gunicorn").alert('close');
    }).fail(function( e ) {
        alert(e.responseText);
        refresh_gunicorn_running = false;
        $("#alert_refresh_gunicorn").alert('close');
    });
}

function build_js() {
    $.post( server_interface_path, { build_js: current_file }, function( data ) {
        if (data.answer != "success") alert("Building failed: " + data.answer);
        else alert("Successfully build index.js.");
    }).fail(function( e ) {
        alert(e.responseText);
    });
}

