from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="WARDROBE_")

    debug: bool = False

    database_url: str = (
        "mysql+pymysql://wardrobe:wardrobe_dev@localhost:3306/wardrobe?charset=utf8mb4"
    )
    redis_url: str = "redis://localhost:6379/0"

    oss_endpoint: str = "http://localhost:9000"
    oss_access_key: str = "wardrobe"
    oss_secret_key: str = "wardrobe_dev"
    oss_bucket_uploads: str = "wardrobe-uploads"
    oss_bucket_garments: str = "wardrobe-garments"

    ai_service_url: str = "http://localhost:8001"

    # 邀请码 (单一共享访问码 - 朋友间分发, 留空 = 不启用鉴权)
    access_code: str = ""
    # 管理员密码 (单独的后台入口, 留空 = 禁用管理后台)
    admin_code: str = ""
    # cookie 签名密钥 (轮换会让所有 session 失效)
    session_secret: str = "change-me-in-prod-please-rotate-this"
    session_max_age: int = 60 * 60 * 24 * 30  # 30 天

    jwt_secret: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_expire_seconds: int = 60 * 60 * 24 * 7

    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])


settings = Settings()
