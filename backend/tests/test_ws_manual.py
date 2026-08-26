import asyncio
import websockets


async def test_ws():
    uri = 'ws://127.0.0.1:8000/ws/session/sess_test'
    async with websockets.connect(uri) as ws:
        fake_audio = b'x' * 48000
        await ws.send(fake_audio)
        response = await ws.recv()
        print('ACK 1:', response)

        await ws.send(fake_audio)
        response = await ws.recv()
        print('ACK 2:', response)


if __name__ == '__main__':
    asyncio.run(test_ws())
