import phoenix as px
import logging
import time

logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
    print("Starting Arize Phoenix on http://localhost:6006")
    print("Open http://localhost:6006 in your browser to view traces")
    print("Press Ctrl+C to stop")

    session = px.launch_app()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Phoenix stopped")
