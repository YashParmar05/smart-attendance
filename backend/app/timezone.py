from datetime import datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def now_ist() -> datetime:
    """
    Return current Indian Standard Time as a naive datetime.

    Database timestamps in this project are stored as
    naive IST values.
    """
    return datetime.now(IST).replace(tzinfo=None)