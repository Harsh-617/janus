from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GOOGLE_CLOUD_PROJECT: str
    GOOGLE_APPLICATION_CREDENTIALS: str = "./service-account.json"
    VERTEX_AI_LOCATION: str = "us-central1"
    PHOENIX_COLLECTOR_ENDPOINT: str = "http://localhost:6006/v1/traces"
    PHOENIX_BASE_URL: str = "http://localhost:6006"
    GOOGLE_API_KEY: str = ""
    # Gemini keys — read all 10, filter out empty ones
    GEMINI_API_KEY_1: str = ""
    GEMINI_API_KEY_2: str = ""
    GEMINI_API_KEY_3: str = ""
    GEMINI_API_KEY_4: str = ""
    GEMINI_API_KEY_5: str = ""
    GEMINI_API_KEY_6: str = ""
    GEMINI_API_KEY_7: str = ""
    GEMINI_API_KEY_8: str = ""
    GEMINI_API_KEY_9: str = ""
    GEMINI_API_KEY_10: str = ""
    # Alpha Vantage keys — read all 4, filter out empty ones
    ALPHA_VANTAGE_API_KEY_1: str = ""
    ALPHA_VANTAGE_API_KEY_2: str = ""
    ALPHA_VANTAGE_API_KEY_3: str = ""
    ALPHA_VANTAGE_API_KEY_4: str = ""
    GEMINI_MODEL_FAST: str = "gemini-2.5-flash"
    GEMINI_MODEL_JUDGE: str = "gemini-2.5-flash"
    FIRESTORE_PORTFOLIO_ID: str = "janus_main"
    FIRESTORE_DATABASE: str = "(default)"
    AGENT_CYCLE_INTERVAL_SECONDS: int = 60
    JANUS_LOOP_INTERVAL_CYCLES: int = 10
    INITIAL_CAPITAL: float = 1_000_000.0
    LOG_LEVEL: str = "INFO"
    DEMO_MODE: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def alpha_vantage_api_keys(self) -> list[str]:
        keys = [
            self.ALPHA_VANTAGE_API_KEY_1,
            self.ALPHA_VANTAGE_API_KEY_2,
            self.ALPHA_VANTAGE_API_KEY_3,
            self.ALPHA_VANTAGE_API_KEY_4,
        ]
        return [k for k in keys if k and k != "your-alpha-vantage-key-1"]


settings = Settings()


def get_settings() -> Settings:
    return settings
