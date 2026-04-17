import os
import re
import sys


def print_error(message):
    print(message, file=sys.stderr)


try:
    import pyttsx3
except Exception as exc:
    print_error(f"Không thể import pyttsx3: {exc}")
    sys.exit(1)


def get_best_voice(engine):
    preferred = os.getenv("TTS_VOICE_KEYWORDS", "")
    preferred_keywords = [item.strip() for item in preferred.split(",") if item.strip()]
    default_keywords = ["vietnam", "tieng viet", "vi-vn", "vietnamese"]

    voices = engine.getProperty("voices")
    if not voices:
        return None

    for keyword in preferred_keywords + default_keywords:
        for voice in voices:
            voice_name = getattr(voice, "name", "") or ""
            voice_id = getattr(voice, "id", "") or ""
            languages = " ".join(
                str(lang) for lang in (getattr(voice, "languages", None) or [])
            )
            haystack = f"{voice_name} {voice_id} {languages}"
            if re.search(keyword, haystack, re.IGNORECASE):
                return voice.id

    return voices[0].id


def speak(text):
    if not text or not text.strip():
        print_error("Vui lòng cung cấp văn bản cần đọc")
        sys.exit(1)

    engine = pyttsx3.init()

    voice_id = get_best_voice(engine)
    if voice_id:
        engine.setProperty("voice", voice_id)

    rate = int(os.getenv("TTS_RATE", "160"))
    volume = float(os.getenv("TTS_VOLUME", "0.9"))

    engine.setProperty("rate", rate)
    engine.setProperty("volume", volume)
    engine.say(text)
    engine.runAndWait()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        speak(sys.argv[1])
    else:
        print_error("Vui lòng cung cấp văn bản cần đọc")
        sys.exit(1)
