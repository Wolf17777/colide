from django.apps import AppConfig
import os

class ColideConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    # name should be the directory path where apps.py lies in relation to the django root folder with . as seperator
    name = os.path.abspath(__file__)[len(os.getcwd())+1:-len('apps.py')-1].replace('/','.')
