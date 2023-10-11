from dev_sites.dev.editor.models import Entry
from django.http import HttpResponse

# This function is called by the backend upon requesting /clear_entries.py.
def index(request, response_dict=None, server_interface=None):
    Entry.objects.all().delete()
    return HttpResponse('cleared all entries')
