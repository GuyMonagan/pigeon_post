from django.shortcuts import render, redirect
import uuid


def index(request):
    # Просто отдаем страницу с кнопкой "Создать звонок"
    return render(request, "core/index.html")


def create_room(request):
    room_id = str(uuid.uuid4())
    return redirect(f"/call/{room_id}/")


def call_page(request, room_id):
    return render(request, "core/call.html", {"room_id": room_id})
