# colide
Colide is an open-source live collaborative code editor that runs in a browser without any installation on the users' device. Its main features are the following.
- The source code files are edited remotely on your server environment. You don't need to synchronize it manually across multiple devices.
- The program code is compiled and executed directly on the server in an appropriate test environment. In particular, it has access to other services, such as Redis or databases.
- The editor is usable collaboratively, both live and asynchronously, within a team.

Meanwhile, Colide has even more features, such as the ability to comment on program code, suggest changes, and much more. 

Colide implements <a href="https://github.com/microsoft/monaco-editor" target="_blank">Monaco editor</a> as its editor component. Therefore, it supports most programming languages.

# Installing
Colide is intended to run in a <a href="https://github.com/django/django" target="_blank">Django</a> backend, utilizing also its model database system. 

Inside your Django environment, make sure to include this app in your settings.py INSTALLED_APPS variable, and don't forget to run `python3 manage.py migrate` afterwards. You might need to edit the name in `apps.py` accordingly. Also, make sure that the following packages are installed in your Python environment.

```
pip install pytz filelock
```

You must configure Django such that when a browser requests the editor, the file `index.html` inside Colide's root folder is rendered and sent as an HTTP response. For example, if on your web server the path `/your_colide_path/` should open the editor, then your Django function to handle that request should look something like the following.

```python
from django.shortcuts import render
def index(request, path):
    response = render(request, 'colide/index.html')
    return response
```

Moreover, it is important that a post request for `/your_colide_path/server_interface.py` returns as a response the one that the function `handle_request(...)` inside that file of the Colide root folder returns. This function takes a few parameters that must be specified accordingly. If needed, look at the documentation of the function inside that file. The code for this can look something like this.
```python
from django.http import HttpResponseBadRequest
from colide import server_interface
def index(request, path):
    root_folder = "your_root_folder" # This is the root folder for the files that you want to edit in the editor.
    try:
        user_id = int(request.COOKIES["user_id"]) # The user id must be the uid of a linux user.
        user_session_id = request.COOKIES["user_session_id"]
        # (!) If not done already, make sure to also verify the session id for the user. (!)
        user_alias = request.COOKIES["user_alias"]
    except:
        return HttpResponseBadRequest("Invalid user.")
    
    return server_interface.handle_request(request, root_folder, user_id, user_session_id, user_alias)
```

# Security
Since Colide edits actual files on your server, always make sure that the Django user has strongly limited access on the server. Moreover, Colide should never be openly availible on the internet, always hide it behind a secure authentication process for all users.
