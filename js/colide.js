function rgb2hex(rgbstring) {
    if (rgbstring == undefined) {
        return "#fff";
    }
    var a = rgbstring.split("(")[1].split(")")[0];
    a = a.split(",");
    var b = a.map(function(x){             //For each array element
        x = parseInt(x).toString(16);      //Convert to a base16 string
        return (x.length==1) ? "0"+x : x;  //Add zero if we get only one character
    });
    return "#"+b.join("");
}
function escapeHtml(txt) {
    return txt
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
function getCookie(cname) {
  let name = cname + "=";
  let ca = document.cookie.split(';');
  for(let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

function datestring_to_date(s) {
    // use Date(year, monthIndex, day, hours, minutes)
    // s is of the form "20.07.22 21:34"
    return new Date("20"+s.slice(6,8), s.slice(3,5)-1, s.slice(0,2), s.slice(9,11),s.slice(12,14));
}

title = document.title
server_interface_path = "server_interface.py{% if edit_webf %}?edit_webf=1{% endif %}"
template_folder_names = ['dev_sites','frontend/sites','frontend/templates']
file_tree = {};
current_file = "{{request.GET.file}}";
current_file_tree_selected_element = null;
last_files = [];
last_files_position = 0;
sync_id = -2;
synchronised_content = null;
read_only_access = true;
last_successful_probe = Date.now();
unsaved_content = false;

current_file_marks = {};
last_mark_id = 0;

cursor_positions = {};

editor = null;
diff_editor = null;
editor_ready = false;
suggestion_mode = false;
model = null;

sync_element_connected = $("#code-header-sync-connection");
sync_element_changes = $("#code-header-sync-changes");

editor_div = document.getElementById('code-editor-wrapper');
diff_editor_div = document.getElementById('code-diff-editor-wrapper');

init_file_tree_running = false;
init_file_running = false;

{% include './file_tree.js' %}
{% include './editor.js' %}
{% include './marks.js' %}
{% include './colide_sync.js' %}

init_editor();
init_file_tree();

window.onbeforeunload = function() {
    if(unsaved_content)
        return "Not all changes were saved yet.";
}

var intervalId = window.setInterval(function(){
  probe_for_changes();
  
  let last_probe_diff = Date.now() - last_successful_probe;
  if (last_probe_diff <= 5000) {
    sync_element_connected.removeClass("bad");
    sync_element_connected.html("Connected");
  } else {
    sync_element_connected.addClass("bad");
    sync_element_connected.html("Last connection was "+Math.round(last_probe_diff/1000)+" seconds ago");
  }
  if (unsaved_content) {
    sync_element_changes.addClass("bad");
    sync_element_changes.html("Unsaved changes");
  } else {
    sync_element_changes.removeClass("bad");
    sync_element_changes.html("All changes saved");
  }
  
}, 1000);

function click_close_file() {
    if ( (!unsaved_content && !suggestion_unsaved) || confirm("There are unsaved changes. Close anyway?") ) {
        close_file();
    }
}

function update_file_navigation() {
    if (last_files.length == 0) {
        $('#caret_open_last').addClass("disabled");
        $('#caret_open_next').addClass("disabled");
    } else {
        if (last_files_position == 0) $('#caret_open_last').addClass("disabled");
        else $('#caret_open_last').removeClass("disabled");
        if (last_files_position == last_files.length-1) $('#caret_open_next').addClass("disabled");
        else $('#caret_open_next').removeClass("disabled");
    }
    let sel = $("#select-lastfile");
    sel.empty(); // remove old options
    sel.append($("<option></option>").attr("value", -1).text("...").attr('hidden',1).attr('selected',1));
    for (let i = 0;i<last_files.length;i++) {
        if (i == last_files_position) 
            sel.append($("<option></option>").attr("value", i).text(last_files[i].getAttribute("full_path")).addClass('line-decoration-todo'));
        else
            sel.append($("<option></option>").attr("value", i).text(last_files[i].getAttribute("full_path")));
    }
}
function last_files_append(lf) {
    if (lf != null) {
        let lfi = last_files.findIndex(x => x === lf);
        if (lfi == -1) { 
            last_files = last_files.slice(-9)
        } else {
            last_files.splice(lfi, 1); 
        }
        last_files.push(lf);
        last_files_position = last_files.length-1;
        update_file_navigation();
    }
}

function open_selected_last_file() {
    if (current_file_tree_selected_element != null) {
        current_file_tree_selected_element.classList.remove("selected");
    }
    current_file_tree_selected_element = last_files[last_files_position];
    current_file_tree_selected_element.classList.add("selected");
    init_file(last_files[last_files_position].getAttribute("full_path"),false);
    update_file_navigation();
}
function open_last() {
    if (last_files_position > 0) {
        last_files_position -= 1;
        open_selected_last_file()
    }
}
function open_next() {
    if (last_files_position < last_files.length-1) {
        last_files_position += 1;
        open_selected_last_file()
    }
}
function open_nav_selected() {
    let i = parseInt($('#select-lastfile').val());
    if (i >= 0 && i < last_files.length) {
        last_files_position = i;
        open_selected_last_file()
    }
    $("#select-lastfile").val(-1) 
}

const BORDER_SIZE = 4;
let m_pos;
let m_pos_right;
function resize_left(e){
  const dx = -m_pos + e.x;
  m_pos = e.x;
  $("#sidebar").width((parseInt($("#sidebar").width()) + dx) + "px");
  $("#code-area").width("calc( 100% - "+$("#sidebar").outerWidth()+"px );");
  $("#code-area").width($("#top").width() - $("#sidebar").outerWidth());
  if ($("#sidebar-right").is(":visible"))
    $("#code-editor").width($("#code-area").width() - $("#sidebar-right").outerWidth());
  else
    $("#code-editor").width("100%");
}

$("#sidebar").mousedown(function (e) {
  if (e.offsetX >= $("#sidebar").width()) {
    m_pos = e.pageX;
    document.addEventListener("mousemove", resize_left, false);
  }
});
function resize_right(e){
  const dx = m_pos_right - e.x;
  m_pos_right = e.x;
  $("#sidebar-right").width((parseInt($("#sidebar-right").width()) + dx) + "px");
  $("#code-editor").width($("#code-area").width() - $("#sidebar-right").outerWidth());
}

$("#sidebar-right").mousedown(function (e) {
  if (e.clientX-$("#sidebar-right")[0].getBoundingClientRect().x <= BORDER_SIZE) {
    m_pos_right = e.pageX;
    document.addEventListener("mousemove", resize_right, false);
  }
});

$(document).mouseup(function(){
    document.removeEventListener("mousemove", resize_left, false);
    document.removeEventListener("mousemove", resize_right, false);
});

$( window ).resize(function() {
    $("#code-area").width("calc( 100% - "+$("#sidebar").outerWidth()+" );");
    if ($("#sidebar-right").is(":visible"))
        $("#code-editor").width($("#code-area").width() - $("#sidebar-right").outerWidth());
    else
        $("#code-editor").width("100%");
});


