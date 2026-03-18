from channels.generic.websocket import AsyncWebsocketConsumer


class TestConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        await self.accept()

    async def receive(self, text_data):
        await self.send(text_data=f"echo: {text_data}")

    async def disconnect(self, close_code):
        pass
