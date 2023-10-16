import json,subprocess,os

from django.http import JsonResponse,HttpResponseBadRequest

from .py import file_manager, file_sync, marks, time

# This function is called by our backend upon requesting /server_interface.py. If you have a different backend, let it call handle_request(), specifying the parameters to your needs.
def index(request, response_dict, server_interface):
    if 'edit_webf' in request.GET:
        root_folder = os.getcwd()+"/"
    else:
        root_folder = server_interface.conf()['root']
    
    try:
        dev_user_id = int(request.COOKIES["dev_user_id"][1:])
        dev_user_session_id = str(dev_user_id) + request.COOKIES["sessionid"]
        dev_user_alias = response_dict["dev_user_info"]["first_name"]
    except:
        return HttpResponseBadRequest("Invalid dev user")
    
    return handle_request(request, root_folder, dev_user_id, dev_user_session_id, dev_user_alias)

# The function handling server_interface.py post requests
# returns an http object
# Parameters:
#   root_folder: The folder the editor should open
#   dev_user_id: The uid of the user using the editor. In the linux filesystem it is checked whether this uid has read or write access to the files.
#   dev_user_session_id: A unique session ID for the user, usually stored as a cookie in the browser.
#   dev_user_alias: The alias under which the user will be displayed to other users, for example in comments.
def handle_request(request, root_folder, dev_user_id, dev_user_session_id, dev_user_alias):
    request_data = request.POST
    if "get_file" in request_data:
        success,result = file_sync.get_file(root_folder,request_data["get_file"],dev_user_id, dev_user_session_id)
    elif "change" in request_data and "file" in request_data and "sync_id" in request_data:
        success,result = file_sync.change(root_folder,request_data["file"],dev_user_id, dev_user_session_id, dev_user_alias, request_data["sync_id"], json.loads(request_data["change"]))
    elif "changes_since" in request_data and "file" in request_data:
        success,result = file_sync.changes_since(root_folder,request_data,dev_user_id, dev_user_session_id)
    elif "get_file_tree" in request_data:
        success = True
        result = {"tree":file_manager.get_file_tree(root_folder, dev_user_id)}
    elif "get_user_stats" in request_data:
        success = True
        result = file_sync.get_user_stats(dev_user_id)
    elif "get_all_user_stats" in request_data:
        success = True
        result = file_sync.get_all_user_stats()
        
    elif "file_create" in request_data:
        success,result = file_manager.file_create(root_folder, request_data["file_create"])
    elif "file_move" in request_data and "file_target" in request_data:
        success,result = file_manager.file_move(root_folder, request_data["file_move"],request_data["file_target"], dev_user_id)
    elif "file_copy" in request_data and "file_target" in request_data:
        success,result = file_manager.file_copy(root_folder, request_data["file_copy"],request_data["file_target"], dev_user_id)
    elif "file_delete" in request_data:
        success,result = file_manager.file_delete(root_folder, request_data["file_delete"], dev_user_id)
    
    elif "get_marks" in request_data:
        success,result = marks.get_marks(root_folder, request_data, dev_user_id)
    elif "add_mark" in request_data and "row_start" in request_data and "type" in request_data and "file" in request_data and "sync_id" in request_data:
        success,result = marks.add_mark(root_folder,request_data,dev_user_id,dev_user_alias)
    elif "remove_mark" in request_data:
        success,result = marks.remove_mark(request_data["remove_mark"])
    elif "change_mark_type" in request_data and "type" in request_data:
        success,result = marks.change_mark_type(request_data["change_mark_type"],request_data["type"])
    elif "change_mark_new_content" in request_data and "new_content" in request_data and "mark_id" in request_data and "sync_id" in request_data:
        success,result = marks.change_mark_new_content(request_data["mark_id"],request_data["sync_id"],request_data["change_mark_new_content"],request_data["new_content"])
    elif "get_comments" in request_data:
        success,result = marks.get_comments(request_data["get_comments"],dev_user_id)
    elif "add_comment" in request_data and "mark_id" in request_data:
        success,result = marks.add_comment(request_data["mark_id"],request_data["add_comment"],dev_user_id,dev_user_alias)
    elif "edit_comment" in request_data and "text" in request_data:
        success,result = marks.edit_comment(request_data["edit_comment"],request_data["text"])
    elif "remove_comment" in request_data:
        success,result = marks.remove_comment(request_data["remove_comment"])
    
    elif "reload_gunicorn" in request_data:
        try:
            subprocess.run(['kill', '-HUP', open("gunicorn.pid").read().strip() ], check=True)
            success = True
            result = {"answer":"success"}
        except:
            success = False
            result = "Internal error."
    elif "build_js" in request_data:
        try:
            subprocess.run(['python3', 'js_framework/build.py', root_folder+request_data['build_js'] ], check=True)
            success = True
            result = {"answer":"success"}
        except Exception as e:
            success = False
            result = "Internal error: "+str(e)
    else:
        success=False
        result="Invalid request."
    if success:
        return JsonResponse(result)
    else: 
        return HttpResponseBadRequest(result)

