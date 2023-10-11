import pytz

from django.utils import timezone

date_template = '%d.%m.%y %H:%M'

def now():
    return timezone.now()

def timedelta(minutes):
    return timezone.timedelta(minutes=minutes)

def to_string(t):
    return timezone.localtime(t).strftime(date_template)

def activate(timezone_str):
    timezone.activate(pytz.timezone(timezone_str))
