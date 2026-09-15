from config.llm_client import LLMTools


def test_llm_client_accepts_base_or_full_chat_url():
    base = LLMTools(api_key="key", base_url="https://example.com/v1/", model="demo")
    full = LLMTools(
        api_key="key",
        base_url="https://example.com/v1/chat/completions",
        model="demo",
    )

    assert base.chat_url == "https://example.com/v1/chat/completions"
    assert full.chat_url == "https://example.com/v1/chat/completions"


def test_only_local_endpoints_may_run_without_api_key():
    local = LLMTools(api_key="", base_url="http://127.0.0.1:11434/v1", model="demo")
    remote = LLMTools(api_key="", base_url="https://example.com/v1", model="demo")

    assert local._can_call_without_key() is True
    assert remote._can_call_without_key() is False
