import json,subprocess,os

from django.http import JsonResponse,HttpResponseBadRequest

from .py import file_manager, file_sync, marks, time

# This function is called by our backend upon requesting /server_interface.py. If you have a different backend, let it call handle_request(), specifying the parameters to your needs.
def index(request, response_context, server_interface):
    if 'edit_webf' in request.GET:
        root_folder = os.getcwd()+"/"
    else:
        root_folder = server_interface.conf()['root']
    
    try:
        dev_user_id = request.COOKIES["dev_user_id"][1:]
        dev_user = {
            'id': int(dev_user_id),
            'session_id': dev_user_id + request.COOKIES["sessionid"],
            'alias': response_context["dev_user_info"]["first_name"],
        }
        # (!) Our backend checks if the COOKIES are valid beforehand. (!)
        # (!) Make sure to verify the session id for the user not later than this point. (!)
    except:
        return HttpResponseBadRequest("Invalid dev user")
    
    default_files = 'default_files/'
    from js_framework import build as build_interface
    return handle_request(request, root_folder, dev_user, default_files, build_interface)

# The function handling server_interface.py post requests
# returns an http object
# Parameters:
#   root_folder: The folder path the editor should open as a root folder.
#   dev_user: A dictionary containing the users info. Must contain the following keys:
#       {
#           'id': The uid of the user using the editor. In the linux filesystem it is checked whether this uid has read or write access to the files.
#           'session_id': A unique session ID for the user, usually stored as a cookie in the browser.
#           'alias': The alias under which the user will be displayed to other users, for example in comments.
#       }
#   default_files: A folder path containing default templates that are availible for the user upon creating a new file. Set to None if you don't want to use this feature.
#   build_interface: A python object or module used for building or compiling files, for example javascript frameworks via npm. Must contain the following two functions. Set it to None, if you don't want to use this feature
#       {
#           get_hooks(path): Takes a path (absolute or relative to your os.getcwd()) and returns a list of files that can be build or compiled. 
#               Each entry of the list must be a dictionary with the following keys:
#               {
#                   'dir': the path of the directory of the file relative to path,
#                   'name': Name of the file,
#                   'depends_on': [A list of file paths relative to path, where a change to these files requires a rebuild of this entry.],
#                   # additional info to pass on to build can be included as well
#               }
#               Info: Will only be called with path=root_folder
#           build(path, hooks): Takes a path (absolute or relative to your os.getcwd()), a list of hooks like the ones given by get_hooks() and builds the corresponding files.
#               Returns success, log:
#                    success: Boolean indicating if the build was successfull 
#                    log: A string containing the logs of the build process
#               Info: Will only be called with path=root_folder
#           reload(): A function that reloads the server to render the most up to date files.
#       }
# (!) WARNING (!): The dev user id is not checked for authentication here. It should always be done before ever calling this function.
def handle_request(request, root_folder, dev_user, default_files=None, build_interface=None):
    
    request_data = request.POST
    if "get_file" in request_data:
        success,result = file_sync.get_file(root_folder,request_data["get_file"],dev_user['id'], dev_user['session_id'])
    elif "change" in request_data and "file" in request_data and "sync_id" in request_data:
        success,result = file_sync.change(root_folder,request_data["file"],dev_user['id'], dev_user['session_id'], dev_user['alias'], request_data["sync_id"], json.loads(request_data["change"]))
    elif "changes_since" in request_data and "file" in request_data:
        success,result = file_sync.changes_since(root_folder,request_data,dev_user['id'], dev_user['session_id'])
    elif "get_file_tree" in request_data:
        success = True
        result = file_manager.get_file_tree(root_folder, dev_user['id'], default_files)
    elif "get_user_stats" in request_data:
        success = True
        result = file_sync.get_user_stats(dev_user['id'])
    elif "get_all_user_stats" in request_data:
        success = True
        result = file_sync.get_all_user_stats()
        
    elif "file_create" in request_data:
        default_content = None
        if "default_content" in request_data:
            default_content = request_data["default_content"]
        success,result = file_manager.file_create(root_folder, request_data["file_create"], default_files, default_content)
    elif "file_move" in request_data and "file_target" in request_data:
        success,result = file_manager.file_move(root_folder, request_data["file_move"],request_data["file_target"], dev_user['id'])
    elif "file_copy" in request_data and "file_target" in request_data:
        success,result = file_manager.file_copy(root_folder, request_data["file_copy"],request_data["file_target"], dev_user['id'])
    elif "file_delete" in request_data:
        success,result = file_manager.file_delete(root_folder, request_data["file_delete"], dev_user['id'])
    
    elif "get_marks" in request_data:
        success,result = marks.get_marks(root_folder, request_data, dev_user['id'])
    elif "add_mark" in request_data and "row_start" in request_data and "type" in request_data and "file" in request_data and "sync_id" in request_data:
        success,result = marks.add_mark(root_folder,request_data,dev_user['id'],dev_user['alias'])
    elif "remove_mark" in request_data:
        success,result = marks.remove_mark(request_data["remove_mark"])
    elif "change_mark_type" in request_data and "type" in request_data:
        success,result = marks.change_mark_type(request_data["change_mark_type"],request_data["type"])
    elif "change_mark_new_content" in request_data and "new_content" in request_data and "mark_id" in request_data and "sync_id" in request_data:
        success,result = marks.change_mark_new_content(request_data["mark_id"],request_data["sync_id"],request_data["change_mark_new_content"],request_data["new_content"])
    elif "get_comments" in request_data:
        success,result = marks.get_comments(request_data["get_comments"],dev_user['id'])
    elif "add_comment" in request_data and "mark_id" in request_data:
        success,result = marks.add_comment(request_data["mark_id"],request_data["add_comment"],dev_user['id'],dev_user['alias'])
    elif "edit_comment" in request_data and "text" in request_data:
        success,result = marks.edit_comment(request_data["edit_comment"],request_data["text"])
    elif "remove_comment" in request_data:
        success,result = marks.remove_comment(request_data["remove_comment"])
    
    elif "build_reload" in request_data:
        if build_interface==None:
            success = False
            result = "Feature not activated."
        else:
            try:
                build_interface.reload()
                success = True
                result = {"answer":"success"}
            except:
                success = False
                result = "Internal error."
    elif "build" in request_data:
        if build_interface==None:
            success = False
            result = "Feature not activated."
        else:
            try:
                hooks = json.loads(request_data["build"])
                build_success, log = build_interface.build(root_folder,hooks)
                if log == None:
                    log = 'No logs availible'
                success = True
                result = {"answer": "success" if build_success else 'Check logs for details.', 'log': log}
            except Exception as e:
                success = False
                result = "Internal error: "+str(e)
    elif "build_all" in request_data:
        if build_interface==None:
            success = False
            result = "Feature not activated."
        else:
            try:
                hooks = build_interface.get_hooks(root_folder)
                build_success, log = build_interface.build(root_folder,hooks)
                if log == None:
                    log = 'No logs availible'
                success = True
                result = {"answer": "success" if build_success else 'Check logs for details.', 'log': log}
            except Exception as e:
                success = False
                result = "Internal error: "+str(e)
    elif "build_get_hooks" in request_data:
        if build_interface==None:
            success = True
            result = {"hooks": []}
        else:
            try:
                result = {"hooks": build_interface.get_hooks(root_folder)}
                success = True
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

