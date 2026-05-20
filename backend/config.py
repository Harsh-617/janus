from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GOOGLE_CLOUD_PROJECT: str
    GOOGLE_APPLICATION_CREDENTIALS: str = "./service-account.json"
    VERTEX_AI_LOCATION: str = "us-central1"
    ALPHA_VANTAGE_API_KEY: str
    PHOENIX_COLLECTOR_ENDPOINT: str = "http://localhost:6006/v1/traces"
    PHOENIX_BASE_URL: str = "http://localhost:6006"
    GOOGLE_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    GEMINI_MODEL_FAST: str = "llama-3.1-8b-instant"
    GEMINI_MODEL_JUDGE: str = "llama-3.3-70b-versatile"
    FIRESTORE_PORTFOLIO_ID: str = "janus_main"
    FIRESTORE_DATABASE: str = "(default)"
    AGENT_CYCLE_INTERVAL_SECONDS: int = 30
    JANUS_LOOP_INTERVAL_CYCLES: int = 10
    INITIAL_CAPITAL: float = 1_000_000.0
    LOG_LEVEL: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()


def get_settings() -> Settings:
    return settings
