import json

from . import file_manager,time
from ..models import Entry,User,UserStat,Mark


def get_file(root_folder, file, user_id, user_session_id):
    access = file_manager.user_access_for_file(root_folder+file, user_id)
    if access in ["w", "r"]:
        # Return file and latest entry id of changes
        d = {
            "file": file,
            "content": "",
            "latest_entry_id": -1,
            "access": access
        }
        if len(Entry.objects.filter(filepath=root_folder+file)) == 0:
            e = Entry(filepath=root_folder+file, row=0, type="nothing", text="", user_session_id=user_session_id)
            e.save()
        try:
            while d["latest_entry_id"] != Entry.objects.filter(filepath=root_folder+file).latest('id').id: # check if id changed since open
                d["latest_entry_id"] = Entry.objects.filter(filepath=root_folder+file).latest('id').id
                d["content"] = file_manager.read_file(root_folder+file)
        except:
            return False, "Unable to get file content."
        return True, d
    else:
        return False, "You don't have access to that file. If you just created the file wait for up to 10 minutes for the service to mod it."

def change(root_folder,file,dev_user_id, dev_user_session_id,sync_id,changes):
    if file_manager.user_access_for_file(root_folder+file, dev_user_id) != "w":
        return False,"You are not allowed to change that file."
    d = {
        "answer": "success",
        "new_id": sync_id
    }
    if int(sync_id) != Entry.objects.filter(filepath=root_folder+file).latest('id').id:
        d["answer"] = "wrong sync_id"
        return True,d
    if len( UserStat.objects.filter(user_id=dev_user_id).filter(day=time.now())) == 0:
        userstat = UserStat(user_id=dev_user_id, user_alias=dev_user_alias)
    else:
        userstat = UserStat.objects.get(user_id=dev_user_id,day=time.now())
    for i in range(len(changes)):
        change = changes[i]
        try:
            file_len = file_manager.change_file(root_folder+file, change["row"], change["type"], change["text"])
        except:
            return False,"Error while applying the "+str(i)+"th change. File reopen required."
        try:
            change_row = int(change["row"])
            try:
                last_entry = Entry.objects.filter(filepath=root_folder+file).latest('id')
                if change["type"] == "change" and last_entry.type == "change" and last_entry.row == change_row:
                    last_entry.delete()
            except:
                pass
            e = Entry(filepath=root_folder+file, row=change_row, type=change["type"], text=change["text"], user_session_id=dev_user_session_id)
            if "old_text" in change:
                e.old_text = change["old_text"]
            e.save()
            d["new_id"] = e.id
            if change["type"] == "insert":
                userstat.lines_added += 1
                for mark in Mark.objects.filter(filepath=root_folder+file).filter(row_end__gte=change_row):
                    if mark.row_start >= change_row:
                        mark.row_start = min(mark.row_start+1,file_len)
                        mark.sync_id += 1
                    mark.row_end = min(mark.row_end+1,file_len)
                    mark.sync_id += 1
                    mark.save()
            elif change["type"] == "delete":
                userstat.lines_deleted += 1
                for mark in Mark.objects.filter(filepath=root_folder+file).filter(row_end__gte=change_row):
                    if mark.row_start > change_row:
                        mark.row_start -= 1
                        mark.sync_id += 1
                    elif mark.row_start == change_row:
                        mark.col_start = 0
                        mark.sync_id += 1
                    if mark.row_end == change_row:
                        mark.col_end = 0
                        mark.sync_id += 1
                    else: # mark.row_end > change_row
                        mark.row_end -= 1
                        mark.sync_id += 1
                    mark.save()
            elif change["type"] == "change":
                userstat.lines_changed += 1
                if e.text != e.old_text:
                    for mark in Mark.objects.filter(filepath=root_folder+file).filter(row_end__gte=change_row):
                        if mark.row_start == change_row and mark.row_end == change_row:
                            # old_text ... [ ... ] ...
                            #              cs    ce
                            #           x     y     z
                            cs = mark.col_start
                            ce = mark.col_end
                            x = e.old_text[:cs]
                            y = e.old_text[cs:ce]
                            z = e.old_text[ce:]
                            if e.text.startswith(x+y):
                                pass
                            elif e.text.endswith(y+z):
                                mark.col_start = len(e.text) - len(y+z)
                                mark.col_end = len(e.text) - len(z)
                                mark.sync_id += 1
                            elif e.text.startswith(x) and e.text.endswith(z):
                                mark.col_end = len(e.text) - len(z)
                                mark.sync_id += 1
                            elif e.text.startswith(x):
                                # set col_end to first change
                                col_change = -1
                                i=0
                                for i in range(len(x),min(len(e.text),len(e.old_text))):
                                    if e.text[i] != e.old_text[i]:
                                        col_change = i
                                        break
                                if col_change == -1:
                                    col_change = i+1
                                mark.col_end = col_change
                                mark.sync_id += 1
                            elif e.text.endswith(z):
                                # set col_start to last change
                                col_change = -1
                                i=0
                                for i in range(min(len(e.text)-len(z),len(e.old_text)-len(z))):
                                    if e.text[-1-i] != e.old_text[-1-i]:
                                        col_change = len(e.text)-i
                                        break
                                if col_change == -1:
                                    col_change = len(e.text)-i-1
                                mark.col_start = col_change
                                mark.sync_id += 1
                            elif y in e.text:
                                yi = e.text.index(y)
                                if mark.col_start != yi:
                                    mark.col_start = yi
                                    mark.sync_id += 1
                                if mark.col_end != yi+len(y):
                                    mark.col_end = yi+len(y)
                                    mark.sync_id += 1
                            else:
                                # set both to first change
                                col_change = -1
                                i=0
                                for i in range(len(x),min(len(e.text),len(e.old_text))):
                                    if e.text[i] != e.old_text[i]:
                                        col_change = i
                                        break
                                if col_change == -1:
                                    col_change = i+1
                                mark.col_start = col_change
                                mark.col_end = col_change
                        elif mark.row_start == change_row:
                            k = mark.col_start
                            n = len(e.old_text)
                            if k > n:
                                k=n
                            # check if texts are equal after col_start
                            if (e.text[k-n:] == e.old_text[k-n:]):
                                mark.col_start = len(e.text) - n + k
                                mark.sync_id += 1
                            # check if texts are equal up to col_start
                            elif (e.text[:k] == e.old_text[:k]):
                                pass # nothing to do
                            else:
                                # change is not an insertion
                                # set col_start to last change
                                col_change = -1
                                i=0
                                for i in range(min(len(e.text),len(e.old_text))):
                                    if e.text[-1-i] != e.old_text[-1-i]:
                                        col_change = len(e.text)-i
                                        break
                                if col_change == -1:
                                    col_change = len(e.text)-i-1
                                mark.col_start = col_change
                                mark.sync_id += 1
                        elif mark.row_end == change_row:
                            k = mark.col_end
                            n = len(e.old_text)
                            if k > n:
                                k=n
                            # check if texts are equal up to col_end
                            if (e.text[:k] == e.old_text[:k]):
                                pass # nothing to do
                            # check if texts are equal after col_end
                            elif (e.text[k-n:] == e.old_text[k-n:]):
                                mark.col_end = len(e.text) - n + k
                                mark.sync_id += 1
                            else:
                                # change is not an insertion
                                # set col_end to first change
                                col_change = -1
                                i=0
                                for i in range(min(len(e.text),len(e.old_text))):
                                    if e.text[i] != e.old_text[i]:
                                        col_change = i
                                        break
                                if col_change == -1:
                                    col_change = i+1
                                mark.col_end = col_change
                                mark.sync_id += 1
                        
                        mark.save()
        except:
            return False,"Error while applying the "+str(i)+"th change. File reopen required."
    userstat.save()
    #if dev_user_id == 1001:
    #    try:
    #        with open('/var/teclex_dev/misc/discord/bot/kevin.txt', 'w') as file:
    #            file.write(json.dumps({"lines_added":userstat.lines_added,"lines_deleted":userstat.lines_deleted,"lines_changed":userstat.lines_changed, "day":str(userstat.day)}))
    #    except:
    #        pass
    return True,d


def changes_since(root_folder,request_data,dev_user_id, dev_user_session_id):
    file = request_data["file"]
    if "activity_position_line" in request_data:
        try:
            u = None
            if len(User.objects.filter(user_id=dev_user_id)) == 0:
                u = User(activity_file=root_folder+file, user_id=dev_user_id, user_alias=dev_user_alias)
            if u == None:
                u = User.objects.get(user_id=dev_user_id)
            u.activity_file = root_folder+file
            u.latest_activity = time.now()
            u.activity_position_line = request_data["activity_position_line"]
            u.activity_position_col = request_data["activity_position_col"]
            u.activity_row_start = request_data["activity_row_start"]
            u.activity_row_end = request_data["activity_row_end"]
            u.activity_col_start = request_data["activity_col_start"]
            u.activity_col_end = request_data["activity_col_end"]
            u.save()
        except:
            pass
        
    changes_since = int(request_data["changes_since"])
    # return list of changes since given id of other users of the file
    access = file_manager.user_access_for_file(root_folder+file, dev_user_id)
    d = {
        "changes": []
    }
    if access in ["w", "r"]:
        for entry in Entry.objects.filter( id__gt=changes_since ).filter(filepath=root_folder+file):
            if entry.user_session_id != dev_user_session_id:
                d["changes"].append([entry.id, entry.row,entry.type,entry.text,entry.old_text])
            else:
            #    return False,"Your sync_id is not up 2 date. Reopen the file."
                d = {
                    "changes": [],
                    "bad_sync_id": entry.id
                }
                return True,d
        if "since_mark_id" in request_data:
            d["marks"] = []
            marks = Mark.objects.filter(filepath=root_folder+file)
            for mark in marks.filter( id__gt=int(request_data["since_mark_id"]) ).exclude(type="deleted"):
                d["marks"].append([mark.id, mark.row_start, mark.row_end, mark.col_start, mark.col_end, mark.type, mark.sync_id, mark.has_new_content, mark.new_content, mark.user_id==dev_user_id, mark.user_alias, time.to_string(mark.date)])
            if "mark_sync_ids" in request_data:
                sync_ids = json.loads(request_data["mark_sync_ids"])
                # each entry is [mark_id, mark_sync_id]
                for mark_id, mark_sync_id in sync_ids:
                    try:
                        m = marks.get(id=int(mark_id))
                        if m != None and m.sync_id != int(mark_sync_id):
                            d["marks"].append([m.id, m.row_start, m.row_end, m.col_start, m.col_end, m.type, m.sync_id, m.has_new_content, m.new_content, m.user_id==dev_user_id, m.user_alias, time.to_string(m.date)])
                    except:
                        continue
    else:
        d["error"] = "You don't have access to that file."
    d["activities"] = []
    time_delta = time.now()-time.timedelta(minutes=1)
    for u in User.objects.filter( latest_activity__gt=time_delta ).exclude(user_id=dev_user_id):
        if u.activity_file.startswith(root_folder):
            d["activities"].append({
                "file": u.activity_file[len(root_folder):],
                "date": time.to_string(u.latest_activity),
                "user_id": u.user_id,
                "user_alias": u.user_alias,
                "activity_position_line": u.activity_position_line,
                "activity_position_col": u.activity_position_col,
                "activity_row_start": u.activity_row_start,
                "activity_row_end": u.activity_row_end,
                "activity_col_start": u.activity_col_start,
                "activity_col_end": u.activity_col_end
            })
    return True,d

def get_user_stats(dev_user_id):
    d = {"user_stats": []}
    for us in UserStat.objects.filter(user_id=dev_user_id):
        uss = {}
        uss["day"] = str(us.day) 
        uss["lines_added"] = us.lines_added
        uss["lines_deleted"] = us.lines_deleted
        uss["lines_changed"] = us.lines_changed
        d["user_stats"].append(uss)
    return d


def get_all_user_stats():
    d = { "user_stats": {} }
    for us in UserStat.objects.all():
        if not us.user_alias in d["user_stats"]:
            d["user_stats"][us.user_alias] = []
        uss = {}
        uss["day"] = str(us.day) 
        uss["lines_added"] = us.lines_added
        uss["lines_deleted"] = us.lines_deleted
        uss["lines_changed"] = us.lines_changed
        d["user_stats"][us.user_alias].append(uss)
    return d
