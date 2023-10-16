import os

from . import file_manager,time
from ..models import Entry,Mark,Comment

def get_marks(root_folder, request_data, dev_user_id):
    try:
        marks = Mark.objects.exclude(type="deleted")
        if "file" in request_data:
            marks = marks.filter(filepath=root_folder+request_data["file"])
        if "since_id" in request_data:
            marks = marks.filter(id__gt=int(request_data["since_id"]))
        d = { "marks": [] }
        time.activate('Europe/Berlin')
        for mark in marks:
            if not mark.filepath.startswith(root_folder):
                continue
            # also return author information, number of comments, latest comment date
            comments = Comment.objects.filter(mark=mark)
            # set timezone 
            if (len(comments) != 0):
                latest_date = time.to_string(comments.latest("date").date)
            else:
                latest_date = time.to_string(mark.date)
            if os.path.exists(mark.filepath):
                d["marks"].append( [mark.id, mark.filepath[len(root_folder):], mark.row_start, mark.row_end, mark.col_start, mark.col_end, mark.type, mark.sync_id, len(comments), latest_date, mark.has_new_content, mark.new_content, mark.user_id==dev_user_id, mark.user_alias, time.to_string(mark.date)] )
        return True,d
    except:
        return False,"Internal error."
def add_mark(root_folder,request_data,dev_user_id,dev_user_alias):
    try:
        d = {"answer":"success"}
        if "id_on_return" in request_data:
            d["id_on_return"] = request_data["id_on_return"]
        if int(request_data["sync_id"]) != Entry.objects.filter(filepath=root_folder+request_data["file"]).latest('id').id:
            d["answer"] = "wrong sync_id"
            return True,d
        #return False,str(dev_user_alias))
        m = Mark(filepath=root_folder+request_data["file"], row_start=int(request_data["row_start"]), row_end=int(request_data["row_end"]), col_start=int(request_data["col_start"]), col_end=int(request_data["col_end"]), type=request_data["type"], user_id=dev_user_id, user_alias=dev_user_alias)
        if "new_content" in request_data: #m.type == "suggestion":
            m.has_new_content = True
            m.new_content = request_data["new_content"]
        m.save()
        if "initial_comment" in request_data:
            c = Comment(mark=m, initial=True, text=request_data["initial_comment"], user_id=dev_user_id, user_alias=dev_user_alias)
            c.save()
        d["mark_id"] = m.id
        return True,d
    except:
        return False,"Internal error."
def remove_mark(remove_mark_id):
    try:
        m = Mark.objects.get(id=int(remove_mark_id))
        m.type = "deleted"
        m.sync_id += 1
        m.save()
        return True,{"answer":"success"}
    except:
        return False,"Internal error."
def change_mark_type(change_mark_type_id,type):
    try:
        m = Mark.objects.get(id=int(change_mark_type_id))
        m.type = type 
        m.sync_id += 1
        m.save()
        return True,{"answer":"success"}
    except:
        return False,"Internal error."
def change_mark_new_content(mark_id,sync_id,change_mark_new_content,new_content):
    try:
        m = Mark.objects.get(id=int(mark_id))
        d = {
            "answer": "success"
        }
        if int(sync_id) != m.sync_id:
            d["answer"] = "wrong sync_id"
            return True,d
        m.has_new_content = change_mark_new_content == "true"
        m.new_content = new_content
        m.sync_id += 1
        m.save()
        return True,{"answer":"success"}
    except:
        return False,"Internal error."
def get_comments(mark_id,dev_user_id):
    try:
        mark_id = int(mark_id)
        d = { "comments": [] }
        time.activate('Europe/Berlin')
        for comment in Comment.objects.filter( mark__id=mark_id ):
            d["comments"].append( [comment.id, comment.text, comment.user_id, comment.user_alias, time.to_string(comment.date), comment.user_id==dev_user_id] )
        return True,d
    except:
        return False,"Internal error."
def add_comment(mark_id,ctext,dev_user_id,dev_user_alias):
    try:
        m = Mark.objects.get(id=int(mark_id))
        c = Comment(mark=m, initial=False, text=ctext, user_id=dev_user_id, user_alias=dev_user_alias)
        c.save()
        return True,{"answer":"success"}
    except:
        return False,"Internal error."
def edit_comment(comment_id,text):
    try:
        c = Comment.objects.get(id=int(comment_id))
        c.text = text
        c.save()
        return True,{"answer":"success"}
    except:
        return False,"Internal error."
def remove_comment(comment_id):
    try:
        c = Comment.objects.get(id=int(comment_id))
        if not c.initial:
            c.delete()
            return True,{"answer":"success"}
        return True,{"answer":"initial comment can not be deleted, delete mark instead"}
    except:
        return False,"Internal error."
