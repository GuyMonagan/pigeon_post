import json
from channels.generic.websocket import AsyncWebsocketConsumer


class RoomConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.room_group_name = f"room_{self.room_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)

        # Получаем данные из JS (включая sender!)
        event_type = data.get("type")
        payload = data.get("payload")
        sender = data.get("sender")  # <--- ВАЖНО: сохраняем отправителя

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "broadcast_event",
                "event": event_type,
                "payload": payload,
                "sender": sender,  # <--- ВАЖНО: пробрасываем в группу
            }
        )

    async def broadcast_event(self, event):
        # Отправляем обратно в WebSocket ВСЕМ участникам группы
        await self.send(
            text_data=json.dumps(
                {
                    "type": event["event"],
                    "payload": event["payload"],
                    "sender": event["sender"],  # <--- ТЕПЕРЬ JS УВИДИТ, КТО ЭТО ПРИСЛАЛ
                }
            )
        )
