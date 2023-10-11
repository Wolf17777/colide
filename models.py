from django.db import models
from django.utils.timezone import now
   
class Entry(models.Model):
    filepath = models.CharField(max_length=255)
    row = models.IntegerField() # row to be changed
    type = models.CharField(max_length=255)
    # type can be delete, change, insert, nothing:
    #   delete deletes the row
    #   change changes the row content to the specified text
    #   insert inserts a line that than has index "row", with the specified text
    #   nothing does nothing, only used as the first entry
    text = models.TextField()
    old_text = models.TextField(default="")
    user_session_id = models.CharField(max_length=255)

class Mark(models.Model):
    filepath = models.CharField(max_length=255)
    row_start = models.IntegerField()
    row_end = models.IntegerField()
    col_start = models.IntegerField()
    col_end = models.IntegerField()
    type = models.CharField(max_length=255)
    # type can be todo, question, remark, suggestion or deleted
    has_new_content = models.BooleanField(default=False)
    new_content = models.TextField(default="")
    sync_id = models.IntegerField(default=0)
    
    user_id = models.IntegerField()
    user_alias = models.CharField(max_length=255)
    date = models.DateTimeField(default=now)

class Comment(models.Model):
    mark = models.ForeignKey(Mark, on_delete=models.CASCADE)
    text = models.TextField()
    user_id = models.IntegerField()
    user_alias = models.CharField(max_length=255)
    initial = models.BooleanField(default=False)
    date = models.DateTimeField(default=now)

class User(models.Model):
    user_id = models.IntegerField()
    user_alias = models.CharField(max_length=255)
    latest_activity = models.DateTimeField(default=now)
    activity_file = models.CharField(max_length=255)
    activity_position_line = models.IntegerField(default=0)
    activity_position_col = models.IntegerField(default=0)
    activity_row_start = models.IntegerField(default=0)
    activity_row_end = models.IntegerField(default=0)
    activity_col_start = models.IntegerField(default=0)
    activity_col_end = models.IntegerField(default=0)
 
class UserStat(models.Model):
    user_id = models.IntegerField()
    user_alias = models.CharField(max_length=255)
    day = models.DateField(default=now)
    lines_added = models.IntegerField(default=0)
    lines_deleted = models.IntegerField(default=0)
    lines_changed = models.IntegerField(default=0)
