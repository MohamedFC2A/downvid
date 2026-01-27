import asyncio
import httpx
import websockets
import sys

async def check_http():
    print("Checking HTTP http://127.0.0.1:8000/")
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get('http://127.0.0.1:8000/')
            print(f"HTTP Status: {resp.status_code}")
            print(f"HTTP Response: {resp.text}")
            return resp.status_code == 200
    except Exception as e:
        print(f"HTTP Error: {e}")
        return False

async def check_ws():
    uri = "ws://127.0.0.1:8000/api/download/test_client"
    print(f"\nChecking WS {uri}")
    try:
        async with websockets.connect(uri) as websocket:
            print("WS Connected!")
            await websocket.close()
            return True
    except Exception as e:
        print(f"WS Error: {e}")
        return False

async def main():
    http_ok = await check_http()
    if http_ok:
        await check_ws()
    else:
        print("Skipping WS check due to HTTP failure")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
