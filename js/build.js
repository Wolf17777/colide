build_hooks = [];
build_hooks_modified = []; // 3 states: unchanged (0), modified (1), build (2)
build_hook_dependencies = {}; 

function init_dependencies() {
    build_hook_dependencies = {};
    build_hooks_modified = Array(build_hooks.length).fill(0);
    for (let i=0; i<build_hooks.length; i++) {
        for (let d of build_hooks[i].depends_on) {
            build_hook_dependencies[d] = i;
        }
    }
    modal_update();
}

function build_hooks_modified_changed() {
    let c = 0;
    for (let i = 0; i<build_hooks.length; i++) {
        if (build_hooks_modified[i]==1) {
            c+=1;
        } 
    }
    if (c>0) $('#build_modify_counter').html(c);
    else $('#build_modify_counter').html('');
}

function modal_update() {
    if (build_hooks.length == 0) {
        $('#buildModal-label').html('Build feature not active.');
        $('#buildModal-modified').hide();
        $('#buildModal-build').hide();
        $('#buildModal-unchanged').hide();
    }
    $('#buildModal-label').html('');
    let modified = [];
    let recently_build = [];
    let unchanged = [];
    $('#buildModal-modified-list').html('');
    $('#buildModal-build-list').html('');
    $('#buildModal-unchanged-list').html('');
    for (let i = 0; i<build_hooks.length; i++) {
        ihtml = '<div class="d-flex alert alert-secondary py-2"><p class="my-auto">'+build_hooks[i].path+'<b>'+build_hooks[i].name+'</b></p>'
        ihtml += '<button class="ms-auto btn btn-info" onclick="build_specific(['+i+'])">Build</button></div>';
        if (build_hooks_modified[i]==1) {
            ihtml=ihtml.replace('alert-secondary','alert-info');
            $('#buildModal-modified-list').append(ihtml);
            modified.push(i);
        } else if (build_hooks_modified[i]==2) {
            ihtml=ihtml.replace('alert-secondary','alert-success');
            $('#buildModal-build-list').append(ihtml);
            recently_build.push(i);
        } else {
            $('#buildModal-unchanged-list').append(ihtml);
            unchanged.push(i);
        }
    }

    if (modified.length == 0) {
        $('#buildModal-modified').hide();
    } else {
        $('#buildModal-modified').show();
    }
    if (recently_build.length == 0) {
        $('#buildModal-build').hide();
    } else {
        $('#buildModal-build').show();
    }
    if (unchanged.length == 0) {
        $('#buildModal-unchanged').hide();
    } else {
        $('#buildModal-unchanged').show();
    }

}

function build_open() {
    modal_update();
    $("#buildLogsModal").modal('hide');
    $("#buildModal").modal('show');
}

build_running_hook_ids = [];
function after_build() {
    for (let i of build_running_hook_ids) {
        build_hooks_modified[i] = 2;
    }
    build_running_hook_ids = [];
    modal_update();
    build_hooks_modified_changed();
}

build_running = false;
function build_all() {
    if ( build_running ) return;
    build_running = true;
    add_alert('Building...', 'warning', 'alert_build', false);
    build_running_hook_ids = [];
    for (let i=0; i<build_hooks.length; i++) {
        build_running_hook_ids.push(i);
    }

    $.post( server_interface_path, { "build_all": 1 }, function( data ) {
        if (data.answer != "success") {
            alert("Building failed: " + data.answer);
            build_running_hook_ids = [];
        }
        else add_alert('Build finished. Check logs for details.', 'success', '', true, "#alert_div",4000);
        $("#buildLogsModal-logs").val(data.log);
        $('#buildLogsModal-logs').scrollTop($('#buildLogsModal-logs')[0].scrollHeight);
        after_build();
        build_running = false;
        $("#alert_build").alert('close');
    }).fail(function( e ) {
        alert(e.responseText);
        build_running = false;
        $("#alert_build").alert('close');
    });
}

function build_specific(hook_ids) {
    if ( build_running ) return;
    build_running = true;
    add_alert('Building...', 'warning', 'alert_build', false);
    let hooks = [];
    build_running_hook_ids = [];
    for (let i of hook_ids) {
        hooks.push(build_hooks[i]);
        build_running_hook_ids.push(i);
    }
    
    $.post( server_interface_path, { "build": JSON.stringify(hooks) }, function( data ) {
        if (data.answer != "success") {
            alert("Building failed: " + data.answer);
            build_running_hook_ids = [];
        }
        else add_alert('Build finished. Check logs for details.', 'success', '', true, "#alert_div",4000);
        $("#buildLogsModal-logs").val(data.log);
        $('#buildLogsModal-logs').scrollTop($('#buildLogsModal-logs')[0].scrollHeight);
        after_build();
        build_running = false;
        $("#alert_build").alert('close');
    }).fail(function( e ) {
        alert(e.responseText);
        build_running = false;
        $("#alert_build").alert('close');
    });
}

function build_modified() {
    let mod=[];
    for (let i=0; i<build_hooks.length; i++) {
        if (build_hooks_modified[i]==1)
            mod.push(i);
    }
    build_specific(mod);
}

init_build_hooks_running = false;
function init_build_hooks() {
    if ( init_build_hooks_running ) return;
    init_build_hooks_running = true;
    add_alert('Loading build hooks...', 'warning', 'alert_init_build_hooks', false);
    $.post( server_interface_path, { "build_get_hooks": 1 }, function( data ) {
        build_hooks = data.hooks;
        
        init_dependencies();

        init_build_hooks_running = false;
        $("#alert_init_build_hooks").alert('close');
    }).fail(function( e ) {
        alert(e.responseText);
        init_build_hooks_running = false;
        $("#alert_init_build_hooks").alert('close');
    });
}


function reload_build_hooks() {
    init_build_hooks();
}


function show_build_logs() {
    $("#buildModal").modal('hide');
    $("#buildLogsModal").modal('show');
}
