share_activity = $("#track-position-checkbox").is(":checked");
current_user_activities = {};
current_user_activities_decorations = {};
current_user_activities_cursors = {};
function track_position() {
    share_activity = $("#track-position-checkbox").is(":checked");
}
function update_user_activities(activities) {
    if (activities == undefined) return;
    let newhtml = "";
    current_user_activities = {};
    for (let i = 0; i<activities.length; i++) {
        a = activities[i];
        newhtml += '<div class="talkbubble" style="cursor:pointer;" onclick="user_activity_goto('+a.user_id+')"><span><b>'+a.user_alias+'</b></span>';
        newhtml += '<span class="type line-decoration-sharing-act"><small>sharing position</small></span>';
        newhtml += '<p>'+a.file+'</p><p>';
        newhtml += 'Line '+a.activity_position_line;
        newhtml += '</p></div>';
        current_user_activities[a.user_id] = {
            file: a.file,
            user_alias: a.user_alias,
            position: {lineNumber: a.activity_position_line, column: a.activity_position_col},
            range: {startLineNumber: a.activity_row_start, endLineNumber: a.activity_row_end, startColumn: a.activity_col_start, endColumn: a.activity_col_end}
        }
        if (a.file == current_file) {
            let write_comment_decoration = {
                range: current_user_activities[a.user_id].range,
                options: {
                    className: 'line-decoration-sharing'
                }
            };
            current_user_activities_decorations[a.user_id] = editor.deltaDecorations([current_user_activities_decorations[a.user_id]], [write_comment_decoration])[0];
            if (current_user_activities_cursors[a.user_id] == undefined) {
                let domNode = document.createElement('div');
                domNode.innerHTML = " "+a.user_alias;
                domNode.className = "cursor-tag";
                current_user_activities_cursors[a.user_id] = {
                    domNode: null,
                    getId: function () {
                        return 'dom_node'+a.user_id;
                    },
                    getDomNode: function () { return domNode; },
                    getPosition: function () {
                        return {
                            position: current_user_activities[a.user_id].position,
                            preference: [
                                monaco.editor.ContentWidgetPositionPreference.BELOW,
                                monaco.editor.ContentWidgetPositionPreference.ABOVE
                            ]
                        };
                    }
                };
                editor.addContentWidget(current_user_activities_cursors[a.user_id]);
            } else {
                editor.layoutContentWidget(current_user_activities_cursors[a.user_id])
            }
        } else {
            current_user_activities_decorations[a.user_id] = editor.deltaDecorations([current_user_activities_decorations[a.user_id]], [])[0];
            if (current_user_activities_cursors[a.user_id]!=undefined) {
                editor.removeContentWidget(current_user_activities_cursors[a.user_id]);
                delete current_user_activities_cursors[a.user_id];
            }
        } 
    }
    for (key in current_user_activities_cursors) {
        if (current_user_activities[key] == undefined) {
            current_user_activities_decorations[key] = editor.deltaDecorations([current_user_activities_decorations[key]], [])[0];
            editor.removeContentWidget(current_user_activities_cursors[key]);
            delete current_user_activities_cursors[key];
        }
    }
    $("#user-activity-feed").html(newhtml.replaceAll("\n", "<br>"));
    if (activities.length == 0) $("#number_active_users").html("");
    else $("#number_active_users").html(activities.length);
}

currently_probing = false;
function probe_for_changes() {
    if (currently_probing || synchronised_content == null || current_file == "") return;
    currently_probing = true
    let data = { 
        changes_since: sync_id, 
        file: current_file, 
        since_mark_id: last_mark_id,
    };
    if (share_activity) {
        let p = editor.getPosition();
        let s = editor.getSelection();
        data.activity_position_line = p.lineNumber;
        data.activity_position_col = p.column;
        data.activity_row_start = s.startLineNumber;
        data.activity_row_end = s.endLineNumber;
        data.activity_col_start = s.startColumn;
        data.activity_col_end = s.endColumn;
    }
    let m_sync_ids = [];
    for (key in current_file_marks) {
        let m = current_file_marks[key];
        m_sync_ids.push([m.id, m.sync_id]);
    }
    data.mark_sync_ids = JSON.stringify(m_sync_ids);
    $.post( server_interface_path, data, function( data ) {
        if (data.bad_sync_id && new_synchronised_content == null && data.bad_sync_id > sync_id) { // should be greater by now
            close_file(true);
            model = monaco.editor.createModel("sync_id is behind. Reopen the file.");
            editor.setModel(model);
            currently_probing = false;
        } else {
            apply_changes(data.changes);
            update_marks(data.marks); // can be undefined
            update_user_activities(data.activities);
            last_successful_probe = Date.now();
            currently_probing = false;
        }
    }).fail(function( e ) {
        //close_file(true);
        //model = monaco.editor.createModel(e.responseText);
        //editor.setModel(model);
        currently_probing = false;
    });
}

function apply_changes(changes) {
    if (synchronised_content == null || changes==null || changes == undefined) return;
    if ( changes.length == 0) {
        submit_changes();
        return;
    }
    client_changes = calculate_diff().lines;
    for (change of changes) {
        if (sync_id < change[0]) {
            // otherwise change was already applied
            let mrow = change[1];
            let mtype = change[2];
            if (mtype == "nothing") continue;
            let mtext = change[3];
            // let moldtext = change[4];
            // try to apply changes to the editor as if they were made before client_changes
            let conflict = 0; // 0: apply the change, 1: skip the change
            let increase_cc_by = 0;
            for (cc of client_changes) {
                if (cc.type == "nothing") continue;
                if (cc.row == mrow) {
                    // First case: change is an insert. Then there is no conflict; just insert and the cc will have happened one row later
                    if (mtype == "insert") increase_cc_by = 1;
                    // Second case: cc was an insert. The change must happen one row later than
                    else if (cc.type == "insert") mrow += 1;
                    // third case: change wants to delete the row, but cc already did
                    else if (cc.type == "delete" && mtype =="delete") {
                        conflict = 1;
                        cc.type = "nothing";
                        break;
                    }
                    // fourth case: change wants to delete, cc changed the row. In this case override cc and just delete the modified row (might not be optimal)
                    else if (cc.type == "change" && mtype =="delete") {
                        cc.type = "nothing";
                        increase_cc_by = -1;
                    }
                    // fifth case: change wants to change, cc deleted the row. In this case override cc and insert the row again with the change (might not be optimal)
                    else if (cc.type == "delete" && mtype =="change") {
                        cc.type = "nothing";
                        mtype = "insert";
                        increase_cc_by = 1;
                    }
                    // final case: change wants to change, cc did change. In this case override cc and apply the change (might not be optimal)
                    else if (cc.type == "change" && mtype =="change") {
                        cc.type = "nothing";
                        break;
                    }
                    // else break; // should not happen
                } else if (cc.row > mrow) {
                    // remaining client changes are made after change, so no conflict
                    cc.row += increase_cc_by;
                } else { // if (cc.row < mrow) {
                    if (cc.type == "insert") mrow += 1; // a row was inserted before the change, so it must happen one row later
                    else if (cc.type == "delete") mrow -= 1;
                    // otherwise no conflict so far, continue
                }
            }
            if (conflict == 0) {
                apply_change_to_model(model,mrow,mtype,mtext);
            }

            if (client_changes.length != 0) {
                // if client_changes happened, apply change to synchronised_content
                let row = change[1];
                let type = change[2];
                let text = change[3];
                // let old_text = change[4];
                apply_change_to_model(synchronised_content,row,type,text);
            } else {
                // otherwise update synchronised_content to the new state of the editor
                synchronised_content.setValue(model.getValue());
            }
            sync_id = change[0];
        }


    }
    submit_changes();
}

function apply_change_to_model(model, row, type, text) {
    if (type == "delete") {
        model.applyEdits([
            {
                text: '',
                range: new monaco.Range(row+1, 1, row+2, 1),
            },
        ]);
    } else if (type == "insert") {
        while (row+1 > model.getLineCount()) {
            model.applyEdits([
                {
                    text: "\n",
                    range: new monaco.Range(model.getLineCount()+1, 1, model.getLineCount()+1, 1),
                },
            ]);
        }
        model.applyEdits([
            {
                text: text+"\n",
                range: new monaco.Range(row+1, 1, row+1, 1),
            },
        ]);
    } else if (type == "change") {
        while (row+1 > model.getLineCount()) {
            model.applyEdits([
                {
                    text: "\n",
                    range: new monaco.Range(model.getLineCount()+1, 1, model.getLineCount()+1, 1),
                },
            ]);
        }
        model.applyEdits([
            {
                text: text+"\n",
                range: new monaco.Range(row+1, 1, row+2, 1),
            },
        ]);
    }
}


new_synchronised_content = null
function submit_changes() {
    if (new_synchronised_content != null || synchronised_content == null || current_file == "") return;
    let changes = calculate_diff();
    if (changes.lines.length == 0) {
        unsaved_content = false;
        return;
    }
    unsaved_content = true;
    new_synchronised_content = model.getValue();
    let data = {
        change: JSON.stringify(changes.lines), sync_id: sync_id, file: current_file
    };
    $.post( server_interface_path, data, function( data ) {
        if (data["answer"] == "wrong sync_id") {
            new_synchronised_content = null;
            probe_for_changes(); // will call submit_changes
        } else if (data["answer"] == "success") {
            sync_id = data["new_id"];
            synchronised_content.setValue(new_synchronised_content);
            unsaved_content = false;
            new_synchronised_content = null;
            submit_changes();
        }
    }).fail(function( e ) {
        new_synchronised_content = null;
        probe_for_changes(); // will call submit_changes
        if (e.responseText != undefined)
            alert(e.responseText);
        //close_file(true);
        //model = monaco.editor.createModel(e.responseText);
        //editor.setModel(model);

        //new_synchronised_content = null;
    });
}

suggestion_synced_model = null;
suggestion_new_value = null;
function submit_changes_diff() {
    if (!suggestion_mode || suggestion_synced_model == null || synchronised_content == null || suggestion_new_value != null || current_file == "") return;
    let modified_model = diff_editor.getModel().modified;

    let changes = calculate_diff_values(suggestion_synced_model.getValue(), modified_model.getValue());
    if (changes.lines.length == 0) {
        suggestion_unsaved = false;
        $("#insert-change-server-state").html("");
        return;
    }
    suggestion_unsaved = true;
    $("#insert-change-server-state").html('<div class="loader"></div>');
    if (suggestion_active_mark_id == undefined) {
        suggestion_new_value = modified_model.getValue();
        let data = {};
        data.new_content = suggestion_new_value;
        data.type = $("#select-mark-type").val();
        data.file = current_file;
        create_suggestion_active_mark(data);
        return;
    }
    let m = current_file_marks[suggestion_active_mark_id]
    if (m == undefined) return; // wait
    // update mark new_content
    suggestion_new_value = modified_model.getValue();
    let data = {
        change_mark_new_content: "true",
        mark_id: m.id,
        sync_id: m.sync_id,
        new_content: suggestion_new_value
    }
    let change_txt = '';
    if (calculate_diff_values(diff_editor.getModel().original.getValue(), suggestion_new_value, true).lines.length == 0) {
        data.change_mark_new_content = "false";
        data.new_content = "";
        change_txt += '<p>no changes</p>';
    } else {
        change_txt += '<span><p><b>'+active_mark.user_alias+'</b></p><p><small>'+active_mark.date+'</small></p><p style="line-height: 6px;"><br></p><p>';
        let max_len = 40
        let new_val = $.trim(suggestion_new_value.replace("\n", " "));
        if (new_val.length > max_len) {
            new_val = new_val.substr(0,max_len) + "[...]";
        }
        let old_val = $.trim(diff_editor.getModel().original.getValue().replace("\n", " "));
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
        change_txt += '</p>';
    }
    change_txt += '<p style="line-height: 6px;"><br></p>';
    $("#insert-change-div-text").html(change_txt);
    $.post( server_interface_path, data, function( data ) {
        if (data["answer"] == "wrong sync_id") {
            suggestion_new_value = null;
            submit_changes_diff();
        } else if (data["answer"] == "success") {
            suggestion_synced_model.setValue(suggestion_new_value);
            suggestion_unsaved = false;
            $("#insert-change-server-state").html("");
            suggestion_new_value = null;
            submit_changes_diff();
        }
    }).fail(function( e ) {
        suggestion_new_value = null;
        submit_changes_diff();
        if (e.responseText != undefined)
            alert(e.responseText);
    });
}
