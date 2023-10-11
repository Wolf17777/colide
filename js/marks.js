function cursor_position_changed(e) {
    // ignore this in suggestion_mode
    if (suggestion_mode) return;
    if (e==null) {
        position = editor.getPosition();
    } else {
        var position = e.position;
    }
    
    for (key in current_file_marks) {
        m = current_file_marks[key];
        if (!m.has_new_content && m.range.startLineNumber == m.range.endLineNumber && m.range.startColumn == m.range.endColumn && m.range.startLineNumber == position.lineNumber) {
            set_mark_active(m);
            return;
        }
        else if (m.range.containsPosition(position) ) {
            set_mark_active(m);
            return;
        }
    }
    set_mark_active(null);
}

function insert_change() {
    if (suggestion_mode) {
        // finish editing
        exit_suggestion_mode();
    }
    else {
        if (active_mark != null) {
            suggestion_active_mark_id = active_mark.id
        }
        enter_suggestion_mode();
    }
}

var mark_decorations = {};
function update_marks(marks) {
    if (marks == undefined || marks.length == 0) return;
    for (m of marks) {
        // ([m.id, m.row_start, m.row_end, m.col_start, m.col_end, m.type, m.sync_id, m.has_new_content, m.new_content, m.user_id==dev_user_id, m.user_alias, timezone.localtime(m.date).strftime(date_template)])
        if (m[0] > last_mark_id) last_mark_id = m[0];
        let mdict = {
            id: m[0],
            range: new monaco.Range(m[1]+1, m[3]+1, m[2]+1, m[4]+1), // r start, c start, r end, col end
            type: m[5],
            sync_id: m[6],
            has_new_content: m[7],
            new_content: m[8],
            is_author: m[9],
            user_alias: m[10],
            date: m[11]
        }
        if (mdict.type != "deleted") {
            current_file_marks[mdict.id] = mdict;
            if (suggestion_mode && suggestion_active_mark_id == mdict.id) {
                if (active_mark == null || active_mark.id != mdict.id) {
                    set_mark_active(mdict,true);
                } else {
                    // I decided not to force the update here.
                    // Think of what could change:
                    // range: yes but this is not visible in suggestion mode
                    // sync_id: this is significant, therefor make sure to only work with suggestion_active_mark_id in suggetion mode and not active_mark
                    // type: This should get updated:
                    $("#select-mark-type").val(mdict.type);
                }
                submit_changes_diff();
            } 
            if (!suggestion_mode && active_mark != null && active_mark.id == mdict.id) set_mark_active(mdict, true); // yes, this is needed, since active_mark is a copy not a ref
            
        } else {
            delete current_file_marks[mdict.id];
            if (suggestion_mode && suggestion_active_mark_id != undefined && suggestion_active_mark_id == mdict.id) {
                alert("The issue you are editing was resolved in the meantime.")
                exit_suggestion_mode(true);
            }
            mark_decorations[mdict.id] = editor.deltaDecorations([mark_decorations[mdict.id]],	[]);
            if (active_mark != null && active_mark.id == mdict.id) set_mark_active(null);
        }
        
    }
    cursor_position_changed();
    redraw_marks();
}

active_view_zone_id = null;
function redraw_marks(keys=Object.keys(current_file_marks)) {
    if (active_view_zone_id != null) {
        editor.changeViewZones(function (changeAccessor) {
            //var domNode = document.createElement('div');
            //domNode.style.background = 'lightgreen';
            changeAccessor.removeZone(active_view_zone_id);
            active_view_zone_id = null;
        });
    }
    for (key of keys) {
        let mdict = current_file_marks[key];
        if (mdict == undefined) continue;
        let decoration = [];
        if (mdict.type != "deleted") {
            
            let classname = 'line-decoration-'+mdict.type;
            let col = $('.'+classname).css( "backgroundColor" );
            if (col == undefined) {
                classname = "line-decoration-remark";
                col = $('.'+classname).css( "backgroundColor" );
            }
            if (active_mark != null && active_mark.id == mdict.id) classname += " active";
            let opt = {
                isWholeLine: mdict.range.startLineNumber == mdict.range.endLineNumber && mdict.range.startColumn == mdict.range.endColumn,
                className: classname,
                minimap: {color: rgb2hex(col), position: 2}
            };
            let rng = {...mdict.range};
            if (rng.startLineNumber != rng.endLineNumber) {
                // add space to empty rows
                for (let i=rng.startLineNumber; i<rng.endLineNumber; i++) {
                    let line_rng = new monaco.Range(i,1,i+1,1);
                    if (model.getValueInRange(line_rng) == "\n" && !editor.getOption(monaco.editor.EditorOption.readOnly)) {
                        model.applyEdits([{ text: " \n", range: line_rng }]);
                    }
                }
            }
            if (mdict.has_new_content) {
                let opt_after_key = "after";
                if (opt.isWholeLine) {
                    // suggestion is insert, i.e. range has length 0
                    opt.isWholeLine = false;
                    // expand range to length 1 (with no styling) by expanding to the left, otherwise opt.after will not be rendered
                    opt.className = "";
                    if (rng.startColumn != 1) rng.startColumn -= 1;
                    else if (rng.startLineNumber != 1) {
                        rng.startLineNumber -= 1;
                    } else {
                        // range is (1,1,1,1)
                        // make sure the first row has two columns
                        if (model.getValue() == "" || model.getValue()[0] == "\n" && !editor.getOption(monaco.editor.EditorOption.readOnly)) {
                            model.applyEdits([
                                {
                                    text: " ",
                                    range: new monaco.Range(1, 1, 1, 1),
                                },
                            ]);
                        }
                        rng.endColumn += 1; // must use before
                        opt_after_key = "before";
                    }
                    
                } else {
                    // suggestion is change or delete
                    opt.inlineClassName = "decoration-crossout";
                }
                if (mdict.new_content != "") {
                    // suggestion has new_content (i.e. is not a pure deletion)
                    let new_content_lines = mdict.new_content.split("\n");
                    if (new_content_lines.length == 1) {
                        // new content is one line. Just draw it as after
                        opt[opt_after_key] = {content: mdict.new_content, inlineClassName: "decoration-insert"}
                        if (active_mark != null && active_mark.id == mdict.id )
                            // suggestion is active
                            opt[opt_after_key].inlineClassName += " active";
                    } else {
                        // suggestion has multiple lines
                        opt[opt_after_key] = {content: "[...]", inlineClassName: "decoration-insert"}
                        if (active_mark != null && active_mark.id == mdict.id ) {
                            opt[opt_after_key].inlineClassName += " active";
                            editor.changeViewZones(function (changeAccessor) {
                                var domNode = document.createElement('div');
                                domNode.innerHTML = escapeHtml(mdict.new_content).replaceAll("\n","<br>").replace("\t","&nbsp;&nbsp;&nbsp;&nbsp;");
                                domNode.style.background = 'var(--color-insert)';
                                domNode.style.color = 'white';
                                editor.applyFontInfo(domNode);
                                //domNode.innerHTML(mdict.new_content);
                                active_view_zone_id = changeAccessor.addZone({
                                    afterLineNumber: rng.endLineNumber,
                                    heightInLines: new_content_lines.length,
                                    domNode: domNode
                                });
                            });
                        }
                        
                    }

                }
            }
            decoration = [{
                range: rng,
                options: opt
            }];
        }
        mark_decorations[mdict.id] = editor.deltaDecorations([mark_decorations[mdict.id]],decoration);
    }
}



$("#write-comment-buttons").hide();

$("#write-comment-textarea").focusin(function(e) {
    $("#write-comment-buttons").show();
});
$("#write-comment-textarea").focusout(function(e) {
    if ($("#write-comment-textarea").val() == "" && (suggestion_mode || write_comment_decoration_id == null) ) {
        $("#write-comment-buttons").hide();
    }
});

write_comment_decoration_id = null;
$("#new_mark_button").click(function(event) {
    if (synchronised_content == null || current_file == "") return;
    if (active_mark != null) {
        $("#write-comment-textarea").focus();
        return;
    }
    $("#select-mark-type").val("remark");
    $("#resolve_deny_button").hide();
    $("#resolve_button").hide();
    $("#mark_reload_button").hide();
    $("#insert-change-button").html("suggest changes");
    $("#insert-change-button").show();
    $("#insert-change-div").show();
    $("#insert-change-div-text").html('');
    
    //$("#select-mark-type").prop('disabled', false);
    let write_comment_range = editor.getSelection();
    let write_comment_decoration = {
        range: write_comment_range,
        options: {
            isWholeLine: write_comment_range.startLineNumber == write_comment_range.endLineNumber && write_comment_range.startColumn == write_comment_range.endColumn,
            className: 'line-decoration-'+$("#select-mark-type").val() +' active'
        }
    };
    write_comment_decoration_id = editor.deltaDecorations([write_comment_decoration_id], [write_comment_decoration])[0];
    $("#mark-div").show();
    close_activity_div();
    open_sidebar_right();
    $("#write-comment-textarea").focus();
    event.preventDefault();
}); 

$(document).on('mousedown', function (e) {
    if ($(e.target).closest("#sidebar-right").length === 0 && $(e.target).closest("#new_mark_button").length === 0 && $(e.target).closest("#activity_button").length === 0) {
        close_sidebar_right(false);
    }
});

autosize($("#write-comment-textarea"));

function comment_cancel() {
    if (active_mark != null || suggestion_mode) {
        $("#write-comment-textarea").val("");
        $("#write-comment-textarea").focusout();
    }
    else close_sidebar_right();
}

comments_to_submit = [];
function comment_submit() {
    let c = $("#write-comment-textarea").val();
    if (c == "" || current_file == "") return;
    if (active_mark != null) {
        data = {
            "add_comment": c,
            "mark_id": active_mark.id
        };
        $("#write-comment-textarea").val("");
        $.post( server_interface_path, data, function( data ) {
            if (data.answer != "success") alert("Posting comment failed: " + data.answer);
            reload_comments();
        }).fail(function( e ) {
            alert("Posting comment failed: " + e.responseText);
        });
    } else {
        data = {};
        data.initial_comment = c;
        data.type = $("#select-mark-type").val();
        data.file = current_file;
        $("#write-comment-textarea").val("");
        if (suggestion_mode && suggestion_active_mark_id == undefined) {
            create_suggestion_active_mark(data);
        } else {
            // create an invisible decoration for the range
            let rng = get_range_of_decoration(write_comment_decoration_id);
            if (rng == null) rng = editor.getSelection();
            data.invis_decoration_id = editor.deltaDecorations([], [{
                range: rng,
                options: {}
            }])[0];
            clear_write_comment_decoration();
            close_sidebar_right();
            if (comments_to_submit.length != 0) data.id_on_return = comments_to_submit[comments_to_submit.length-1].id_on_return+1;
            else data.id_on_return = 1;
            comments_to_submit.push(data);
            retry_submitting_comments(data.id_on_return);
        }
    }
}

function retry_submitting_comments(id_on_return) {
    data = null
    for (let i = 0; i < comments_to_submit.length; i++) {
        if (comments_to_submit[i].id_on_return == id_on_return) {
            data = comments_to_submit[i]
            break;
        }
    }
    if (data == null) return;
    let write_comment_range = get_range_of_decoration(data.invis_decoration_id);
    if (write_comment_range == null) write_comment_range = editor.getSelection();
    data.add_mark = 1;
    data.row_start = write_comment_range.startLineNumber-1;
    data.row_end = write_comment_range.endLineNumber-1;
    data.col_start = write_comment_range.startColumn-1;
    data.col_end = write_comment_range.endColumn-1;
    data.sync_id = sync_id;
    $.post( server_interface_path, data, function( data ) {
        if (data.answer == "wrong sync_id") {
            retry_submitting_comment(data.id_on_return);
            return;
        }
        for (let i = 0; i < comments_to_submit.length; i++) {
            if (comments_to_submit[i].id_on_return == data.id_on_return) {
                editor.deltaDecorations([comments_to_submit[i].invis_decoration_id],[]);
                comments_to_submit.splice(i,1);
                break;
            }
        }
        if (data.answer != "success") alert("Posting comment failed: " + data.answer);
        probe_for_changes();
    }).fail(function( e ) {
        alert("Posting comment failed: " + e.responseText);
    });
}



suggestion_active_mark_to_be_created = null;
function create_suggestion_active_mark(data, force=false) {
    if ((!force && suggestion_active_mark_to_be_created != null) || suggestion_active_mark_id != undefined) return;
    suggestion_active_mark_to_be_created = data;
    let write_comment_range = get_range_of_decoration(write_comment_decoration_id);
    if (write_comment_range == null) write_comment_range = editor.getSelection(); // backup, should not happen
    data.row_start = write_comment_range.startLineNumber-1;
    data.row_end = write_comment_range.endLineNumber-1;
    data.col_start = write_comment_range.startColumn-1;
    data.col_end = write_comment_range.endColumn-1;
    data.add_mark = 1;
    data.sync_id = sync_id;
    $.post( server_interface_path, data, function( data ) {
        if (data.answer == "wrong sync_id") {
            // retry
            create_suggestion_active_mark(suggestion_active_mark_to_be_created,true);
            return
        }
        if (data.answer != "success") alert("Posting comment failed: " + data.answer);
        clear_write_comment_decoration();
        suggestion_active_mark_id = data.mark_id;
        suggestion_unsaved = false;
        $("#insert-change-server-state").html("");
        if (suggestion_new_value != null) 
            suggestion_synced_model.setValue(suggestion_new_value);
            suggestion_new_value = null;
        probe_for_changes();
        submit_changes_diff();
        suggestion_active_mark_to_be_created = null;
    }).fail(function( e ) {
        alert("Posting comment failed: " + e.responseText);
        suggestion_active_mark_to_be_created = null;
        suggestion_new_value = null;
    });
}

function reload_right_sidebar() {
    reload_comments();
    reload_activity();
}

function reload_comments() {
    if (active_mark == null) return;
    set_mark_active(active_mark, true);
}

function reload_activity() {
    if (!$("#activity-div").is(":visible")) {
        return;
    }
    view_activity_feed(false);
}

active_mark = null
function set_mark_active(mark, reload=false) {
    if ((!reload && mark == active_mark) || suggestion_mode && (mark==null || mark.id != suggestion_active_mark_id)) return;
    let old_active_mark = active_mark;
    active_mark = mark;
    if (old_active_mark != null && (active_mark == null || active_mark.id != old_active_mark.id) ) 
        redraw_marks([old_active_mark.id]); // redrawn since it is no longer active
    if (mark == null) {
        // unset
        close_sidebar_right();
    } else {
        
        close_mark_div(true);
        close_activity_div();
        redraw_marks([active_mark.id]);
        active_mark = mark;
        $("#select-mark-type").val(active_mark.type);
        
        if (suggestion_mode || active_mark.has_new_content) {
            let change_txt = '<span><p><b>'+active_mark.user_alias+'</b></p><p><small>'+active_mark.date+'</small></p><p style="line-height: 6px;"><br></p><p>';
            let max_len = 40
            let new_val = $.trim(active_mark.new_content.replace("\n", " "));
            if (new_val.length > max_len) {
                new_val = new_val.substr(0,max_len) + "[...]";
            }
            let old_val = $.trim(model.getValueInRange(active_mark.range).replace("\n", " "));
            if (old_val.length > max_len) {
                old_val = old_val.substr(0,max_len) + "[...]";
            }
            if (new_val.length == 0) {
                change_txt += "delete '<i>"+old_val+"</i>'";
            } else if (old_val.length == 0) {
                change_txt += "insert '<i>"+new_val+"</i>'";
            } else {
                change_txt += "change '<i>"+old_val+"</i>' to '<i>"+new_val+"</i>'";
            }
            if (suggestion_mode) {
                $("#resolve_deny_button").hide();
                $("#resolve_button").hide();
                change_txt += '</p><p style="line-height: 6px;"><br></p>';
                $("#insert-change-button").show();
                $("#insert-change-button").html("return");
            } else {
                $("#resolve_deny_button").show();
                $("#resolve_button").prop('title', 'accept suggested changes');
                $("#resolve_button").show();
                if (active_mark.is_author) {
                    change_txt += '</p><p style="line-height: 6px;"><br></p>';
                    $("#insert-change-button").show();
                    $("#insert-change-button").html("edit");
                } else {
                    change_txt += "</p>";
                    $("#insert-change-button").hide();
                }
            }
            $("#insert-change-div").show();
            $("#insert-change-div-text").html(change_txt);  
        } else {
            $("#resolve_deny_button").hide();
            $("#resolve_button").prop('title', 'resolve');
            $("#resolve_button").show();
            $("#insert-change-div-text").html("");
            if (active_mark.is_author) {
                $("#insert-change-div").show();
                $("#insert-change-button").show();
                $("#insert-change-button").html("insert change");
            } else {
                $("#insert-change-div").hide();
            }
            //$("#select-mark-type").prop('disabled', false);
        }
        
        $("#mark_reload_button").show();
        $("#mark-div").show();
        $("#written-comments").html('<div class="talkbubble"><span><p>fetching comments... <div class="loader"></div></p></span></div>');
        open_sidebar_right();
        $.post( server_interface_path, {"get_comments": mark.id}, function( data ) {
            update_comments(data.comments);
        }).fail(function( e ) {
            alert("Error loading comments: " + e.responseText);
            active_mark = null;
            close_sidebar_right();
        });
    }
}

function resolve_active_mark(accept) {
    if (active_mark == null || suggestion_mode || !confirm("Are you sure?") ) return;
    let data = {"remove_mark": active_mark.id};
    if (accept && active_mark.has_new_content) {
        
        if (!editor.getOption(monaco.editor.EditorOption.readOnly)) {
            // apply changes
            model.applyEdits([
                {
                    text: active_mark.new_content,
                    range: active_mark.range,
                },
            ]);
            submit_changes();
        } else {
            alert("File is read only.");
            return;
        }
    }
    // delete mark
    set_mark_active(null); 
    editor.deltaDecorations([mark_decorations[data.remove_mark]],[]); // This is good if the post below doesn't return an error. If it returns an error, the file must probably be reloaded to see the mark again
    $.post( server_interface_path, data, function( data ) {
        probe_for_changes();
    }).fail(function( e ) {
        alert("Error while resolving: " + e.responseText);
        close_sidebar_right();
    });
}

function update_comments(comments) {
    let newhtml = "";
    for (c of comments) {
        newhtml += '<div class="talkbubble';
        if (c[5]) newhtml += ' right';
        else newhtml += ' left';
        newhtml += '"><span><p><b>'+c[3]+'</b></p><p><small>'+c[4]+'</small></p><p style="line-height: 6px;"><br></p><p>'+c[1]+'</p></span></div>';
    }
    $("#written-comments").html(newhtml.replaceAll("\n", "<br>"));
}

current_activities = [];
function view_activity_feed(close_if_visible=true) {
    if (!editor_ready || suggestion_mode) return;
    if (close_if_visible && $("#activity-div").is(":visible")) {
        close_sidebar_right();
        return;
    }
    set_mark_active(null);
    close_mark_div(true);
    $("#activity-feed").html('<div class="talkbubble"><span><p>loading feed... <div class="loader"></div></p></span></div>');
    $("#activity-div").show();
    if (current_file == "") {
        $("#activity-filter-file").val("all");
        $("#activity-filter-file").attr("disabled", true);
    } else {
        $("#activity-filter-file").attr("disabled", false);
    }
    open_sidebar_right();
    $.post( server_interface_path, {get_marks: 1}, function( data ) {
        set_current_activity(data.marks);
    }).fail(function( e ) {
        
    });
}


function set_current_activity(new_marks) {
    current_activities = [];
    for (m of new_marks) {
        // [mark.id, mark.filepath, mark.row_start, mark.row_end, mark.col_start, mark.col_end, mark.type, mark.sync_id, user_alias, len(comments), latest_date, mark.new_content, is_author]
        current_activities.push({
            id: m[0],
            file: m[1],
            range: new monaco.Range(m[2]+1, m[4]+1, m[3]+1, m[5]+1), // r start, c start, r end, col end
            type: m[6],
            //sync_id: m[7],
            number_of_comments: m[8],
            latest_date: m[9],
            //has_new_content: m[10],
            //new_content: m[11],
            //is_author: m[12],
            user_alias: m[13]
            //date: m[14]
        });
    }
    // sort current_acitvities by latest_date
    current_activities.sort(function(a,b){
        return datestring_to_date(a.latest_date) - datestring_to_date(b.latest_date);
    });
    
    update_activity();
}
function update_activity() {
    let newhtml = "";
    let filter_opt = {
        current_file_only: $("#activity-filter-file").val() != "all",
        type: $("#activity-filter-type").val()
    };
    for (let i = 0; i<current_activities.length; i++) {
        a = current_activities[i];
        if (filter_opt.current_file_only && current_file != "" && a.file != current_file) continue;
        if (filter_opt.type != "all" && a.type != filter_opt.type) continue;
        newhtml += '<div class="talkbubble" style="cursor:pointer;" onclick="activity_goto('+i+')"><span><b>'+a.user_alias+'</b></span>';
        newhtml += '<span class="type line-decoration-'+a.type+'"><small>'+a.type+'</small></span>';
        newhtml += '<span class="comment-number"><small>&#128488;'+a.number_of_comments+'</small></span>';
        newhtml += '<p><small>'+a.latest_date+'</small></p><p style="line-height: 6px;"><br></p>';
        newhtml += '<p>'+a.file+'</p><p>';
        if (a.range.startLineNumber != a.range.endLineNumber) {
            newhtml += 'Lines '+a.range.startLineNumber+'-'+a.range.endLineNumber;
        } else {
            newhtml += 'Line '+a.range.startLineNumber;
        }
        newhtml += '</p></div>';
    }
    $("#activity-feed").html(newhtml.replaceAll("\n", "<br>"));
    $("#activity-inner-content").animate({ scrollTop: $('#activity-inner-content').prop("scrollHeight")}, 1000);
}

function user_activity_goto(user_id) {
    if (suggestion_mode) return;
    let goto_a = current_user_activities[user_id];
    if (goto_a == undefined || goto_a.file == "") return;
    let pos = goto_a.position;
    if (current_file == goto_a.file) {
        editor.setPosition(pos);
        editor.revealLineInCenter(pos.lineNumber);
    } else {
        cursor_positions[goto_a.file] = pos;
        init_file(goto_a.file);
        init_file_tree();
    }
}

function activity_goto(i) {
    if (suggestion_mode) return;
    let goto_a = current_activities[i];
    if (goto_a == undefined || goto_a.file == "") return;
    let pos = { lineNumber: goto_a.range.startLineNumber, column: goto_a.range.startColumn };
    if (current_file == goto_a.file) {
        editor.setPosition(pos);
        editor.revealLineInCenter(pos.lineNumber);
        
    } else {
        cursor_positions[goto_a.file] = pos;
        init_file(goto_a.file);
        init_file_tree();
    }
}

function open_sidebar_right() {
    $("#sidebar-right").show();
    $("#code-editor").width($("#code-area").width() - $("#sidebar-right").outerWidth());
}

function close_sidebar_right(force=true) {
    if (!force && (active_mark != null || suggestion_mode)) return; 
    $("#sidebar-right").hide();
    $("#code-editor").width("100%");
    if (active_mark != null) {
        set_mark_active(null); // calls close_sidebar_right again
        return;
    }
    close_mark_div(force);
    close_activity_div();
}

// Remark: This function does not set active_mark to null. This is intended. Manually set it to null if needed.
function close_mark_div(force=true) {
    if (!force && (active_mark != null || suggestion_mode)) return;
    $("#written-comments").html("");
    clear_write_comment_decoration();
    $("#mark-div").hide();
}

function clear_write_comment_decoration() {
    if (write_comment_decoration_id != null) {
        editor.deltaDecorations([write_comment_decoration_id],[]);
        write_comment_decoration_id = null
    }
}

function close_activity_div() {
    current_activities = [];
    $("#activity-feed").html("");
    $("#activity-div").hide();
}

function mark_type_selected() {
    if (write_comment_decoration_id != null) {
        let write_comment_range = get_range_of_decoration(write_comment_decoration_id);
        if (write_comment_range == null) write_comment_range = editor.getSelection();
        let write_comment_decoration = {
            range: write_comment_range,
            options: {
                isWholeLine: write_comment_range.startLineNumber == write_comment_range.endLineNumber && write_comment_range.startColumn == write_comment_range.endColumn,
                className: 'line-decoration-'+$("#select-mark-type").val() +' active'
            }
        };
        write_comment_decoration_id = editor.deltaDecorations([write_comment_decoration_id], [write_comment_decoration])[0];
    } else if (active_mark != null) {
        $.post( server_interface_path, {change_mark_type: active_mark.id, type: $("#select-mark-type").val()}, function( data ) {
            probe_for_changes();
        }).fail(function( e ) {
            
        });
    }
}
