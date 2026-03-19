from django.urls import path
from .views import index, create_room, call_page

urlpatterns = [
    path("", index),
    path("create/", create_room),
    path("call/<str:room_id>/", call_page),
]
