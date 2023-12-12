import subprocess,os,shutil

from filelock import FileLock

from ..models import Mark

access_cache = {}

def user_in_group(user_id, group_id):
    if group_id in access_cache and user_id in access_cache[group_id]:
        return True
    group_members = subprocess.run(['getent', 'group', group_id ], stdout=subprocess.PIPE, check=True).stdout.decode("utf-8").split(":")[-1].rstrip().split(",")
    username = subprocess.run(['getent', 'passwd', str(user_id) ], stdout=subprocess.PIPE, check=True).stdout.decode("utf-8").split(":")[0]
    if username in group_members:
        if not group_id in access_cache:
            access_cache[group_id] = []
        access_cache[group_id].append(user_id)
        return True
    else:
        return False
 
def user_access_for_file(file, user_id):
    global access_cache
    # "stat -c "%a" file" returns the access code, for example 775
    # "stat -c '%g' file" prints the group id of the file

    # "getent group group_id" prints something like teclex-dev-editors:x:1004:wolf,voss
    # finally "getent passwd user_id" prints something like wolf:x:1001 ...
    try:
        permissions = subprocess.run(['stat', '-c', '%a,%g', file ], stdout=subprocess.PIPE, check=True).stdout.decode("utf-8").rstrip().split(",")
        group_id = permissions[1]
        permissions_group = int(permissions[0][1])
        permissions_other = int(permissions[0][2])

        # avoid using user_in_group() if possible. I.e. handle the cases where it is not needed first
        if permissions_other >= 6:
            return "w"
        elif permissions_other >= 4 and permissions_group < 6:
            return "r"
        elif permissions_other < 4 and permissions_group < 4:
            return "n"

        u_in_g = user_in_group(user_id, group_id)
        
        if u_in_g and permissions_group >= 6:
            return "w"
        elif permissions_other >= 4 or (u_in_g and permissions_group >= 4):
            return "r"
        else:
            return "n"
        
    except:
        return "n"

# Caution: This function has no security check. Only call it with a access check beforehand
def read_file(file):
    lock = FileLock(file+".lock")
    with lock:
        with open(file, "r") as f:
            content = f.read()
    return content

# Caution: This function has no security check. Only call it with a access check beforehand
def change_file(file, row, type, text):
    lock = FileLock(file+".lock")
    with lock:
        with open(file, "r+") as f:
            lines = f.readlines()
            f.seek(0)
            l = len(lines)
            if row > l and type == "insert":
                while(l < row):
                    lines.append('\n')
                    l += 1
                l += 1 # now l=row+1
            elif row == l:
                l += 1 # l = row+1, i.e. the last index in the below for loop will be i=row
            else:
                assert(row >= 0 and row < l)
            for i in range(l):
                if i == row:
                    if type == "delete":
                        continue # skip this line
                    elif type == "insert":
                        f.write(text+'\n') # write new line before the current line
                        if i < len(lines):
                            f.write(lines[i])
                    elif type == "change":
                        f.write(text+'\n')
                else:
                    f.write(lines[i])
            f.truncate()
    return l

def ignore_folder(folder):
    folder_list = folder.split("/")
    return ".git" in folder_list or "__pycache__" in folder_list or 'node_modules' in folder_list

def get_file_tree(root_folder, user_id, default_files_folder=None):
    tree = { "dirs": {}, "files": [] }
    for subdir, dirs, files in os.walk(root_folder):
        if subdir.startswith(root_folder):
            subdir = subdir[len(root_folder):]
        if ignore_folder(subdir):
            continue
        root = tree
        if subdir != '':
            for p in subdir.split("/"):
                root = root["dirs"][p]
        for d in dirs:
            if ignore_folder(d):
                continue
            root["dirs"][d] = { "dirs": {}, "files": [] }
        for f in files:
            if not f.endswith(".lock") and not f.endswith("db.sqlite3"): 
                #filename = ("" if subdir == "." else subdir[2:]+"/")+f # ignore "./"
                filename = (subdir+"/" if subdir != '' else '')+f # needs / before file if not root folder
                root["files"].append( [filename, user_access_for_file(root_folder+filename, user_id)] )
    default_files = []
    if default_files_folder != None:
        for subdir, dirs, files in os.walk(default_files_folder):
            if subdir.startswith(default_files_folder):
                subdir = subdir[len(default_files_folder):]
            for f in files:
                if not f.endswith(".lock"):
                    default_files.append(subdir+f)
    return {"tree":tree, 'default_files': default_files}


def file_create(root_folder,new_file, default_files_folder=None, default_content_file=None):
    try:
        if new_file[0] == "/":
            new_file = new_file[1:]
        
        if os.path.exists(root_folder+new_file):
            return False,"File "+new_file+" already exists."

        if "/" in new_file:
            folder = new_file[:new_file.rindex("/")]
            if not os.path.exists(root_folder+folder):
                os.makedirs(root_folder+folder)
        if default_files_folder!=None and default_content_file!=None and default_content_file!='':
            if not os.path.exists(default_files_folder+default_content_file):
                return False,"Default file "+default_files_folder+default_content_file+" does not exist."
            shutil.copyfile(default_files_folder+default_content_file, root_folder+new_file)
        else:
            open(root_folder+new_file, 'a').close()
        return True,{"answer":"success"}
    except:
        return False,"Internal error."

def file_move(root_folder,move_file,target_file,dev_user_id):
    try:
        if move_file[0] == "/":
            move_file = move_file[1:]
        if target_file[0] == "/":
            target_file = target_file[1:]
        
        if os.path.exists(root_folder+target_file):
            return False,"File "+target_file+" already exists."
        
        if user_access_for_file(root_folder+move_file, dev_user_id) != "w":
            return False,"No access to "+move_file+"."

        if "/" in target_file:
            folder = target_file[:target_file.rindex("/")]
            if not os.path.exists(root_folder+folder):
                os.makedirs(root_folder+folder)
        shutil.move(root_folder+move_file, root_folder+target_file)
        # Update mark paths
        for m in Mark.objects.filter(filepath=root_folder+move_file):
            m.filepath = root_folder+target_file
            m.save()
        return True,{"answer":"success"}
    except:
        return False,"Internal error."
def file_copy(root_folder,copy_file,target_file,dev_user_id):
    try:
        if copy_file[0] == "/":
            copy_file = copy_file[1:]
        if target_file[0] == "/":
            target_file = target_file[1:]
        
        if os.path.exists(root_folder+target_file):
            return False,"File "+target_file+" already exists."
        
        if not user_access_for_file(root_folder+copy_file, dev_user_id) in ["w", "r"]:
            return False,"No access to "+copy_file+"."

        if "/" in target_file:
            folder = target_file[:target_file.rindex("/")]
            if not os.path.exists(root_folder+folder):
                os.makedirs(root_folder+folder)
        shutil.copyfile(root_folder+copy_file, root_folder+target_file)

        return True,{"answer":"success"}
    except:
        return False,"Internal error."
def file_delete(root_folder,delete_file,dev_user_id):
    #try:
        if delete_file[0] == "/":
            delete_file = delete_file[1:]
        
        if not os.path.exists(root_folder+delete_file):
            return False,"Path "+delete_file+" does not exist."
        
        if os.path.isdir(root_folder+delete_file):
            if len(os.listdir(root_folder+delete_file)) != 0:
                return False,"Directory "+delete_file+" is not empty."
            else:
                os.rmdir(root_folder+delete_file)
                return True,{"answer":"success"}
        else:
            if user_access_for_file(root_folder+delete_file, dev_user_id) != "w":
                return False,"No access to "+delete_file+"."
            
            os.remove(root_folder+delete_file)
            if os.path.exists(root_folder+delete_file + ".lock"):
                os.remove(root_folder+delete_file + ".lock")
            return True,{"answer":"success"}
    #except:
    #    return False,"Internal error."
