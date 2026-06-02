from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="WARDROBE_AI_")

    debug: bool = False

    # 阿里云 VIAPI
    viapi_access_key_id: str = ""
    viapi_access_key_secret: str = ""
    viapi_endpoint: str = "imageseg.cn-shanghai.aliyuncs.com"

    # 豆包 VLM
    doubao_api_key: str = ""
    doubao_model: str = "doubao-vision-lite"
    doubao_endpoint: str = "https://ark.cn-beijing.volces.com/api/v3"

    # 商汤 SenseNova VLM (优先级最高 - 配置了就用它代替 viapi/doubao)
    # OpenAI 兼容 endpoint, 模型 sensenova-6.7-flash-lite 多模态, 用户 plan 内免费 quota
    sensenova_api_key: str = ""
    sensenova_base_url: str = "https://token.sensenova.cn"
    sensenova_model: str = "sensenova-6.7-flash-lite"

    # 对象存储（用于分割出的单品 crop 上传）
    oss_endpoint: str = "http://localhost:9000"
    oss_access_key: str = "wardrobe"
    oss_secret_key: str = "wardrobe_dev"
    oss_bucket: str = "wardrobe-garments"

    # 模型权重路径
    schp_weights: str = "models/schp_atr.pth"
    segformer_model: str = "mattmdjaga/segformer_b2_clothes"


settings = Settings()
