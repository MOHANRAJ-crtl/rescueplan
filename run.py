"""Run the API and the HTML/CSS/JS frontend together on localhost."""
from backend.app.config import Settings

if __name__ == "__main__":
    import uvicorn

    settings = Settings.from_env()
    uvicorn.run("backend.app.main:app", host=settings.host, port=settings.port)

