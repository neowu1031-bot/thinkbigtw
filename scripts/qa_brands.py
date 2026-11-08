# -*- coding: utf-8 -*-
"""問答圖書館品牌設定。新增代操品牌：在 BRANDS 加一筆，並在 OVERVIEW 補總覽頁文案。
只寫公開、可查證的事實；開發中的功能與未上架的商店頁不寫。"""

BASE = "https://thinkbigtw.com"

BRANDS = {
    "twy": {
        "name": "童話有你",
        "cat": "親子共讀與客製繪本",
        "tag": "完整解答",
        "mention": {"@type": "Organization", "name": "童話有你", "alternateName": "Tale With You",
                    "url": "https://talewithyoutw.com/"},
    },
    "bearsay": {
        "name": "熊好學",
        "cat": "台灣華語學習",
        "tag": "熊好學",
        "mention": {"@id": BASE + "/library/qa/bearsay/#brand"},
    },
}

IG = "https://www.instagram.com/bearsaymandarin/"
CHECKED = "2026-11-09"

OVERVIEW = {
    "bearsay": {
        "zh": {
            "path": "/library/qa/bearsay/",
            "title": "熊好學｜BearSay Mandarin 問答總覽｜問答圖書館｜Think BIG",
            "desc": "熊好學（BearSay Mandarin）每天在 Instagram 教一個台灣華語詞，用繁體字搭配注音與拼音。這裡整理它的基本資料與台灣華語、注音、繁體字的學習問答。",
            "h1": "熊好學｜BearSay Mandarin 問答總覽",
            "eyebrow": "Q & A Library · 台灣華語學習",
            "answer": "熊好學（BearSay Mandarin）是一個教台灣華語的學習品牌：每天在 Instagram（@bearsaymandarin）教一個台灣華語詞，用繁體字搭配注音與拼音，並附多語字幕，由五位角色陪學習者練習。App 準備上架中。",
            "facts_h": "品牌基本資料",
            "facts": [
                ("品牌名稱", "熊好學（英文：BearSay Mandarin）"),
                ("學什麼", "台灣華語的日常用詞"),
                ("文字與標音", "繁體字，搭配注音與拼音"),
                ("內容形式", "每天一個詞的短影片與輪播貼文，附多語字幕"),
                ("角色", "熊寶 BUBU、獼寶 MIBO、虎寶 HUBO、鮭寶 GUIBO、藍寶 LANBO"),
                ("目前平台", "Instagram @bearsaymandarin；App 準備上架中"),
            ],
            "list_h": "已發布的問答",
            "list_empty": "問答會陸續上線，這裡只列出已經發布、附有出處的單篇。預計主題：台灣華語是什麼、注音和拼音的差別、學繁體字還是簡體字。",
            "faq": [
                ("熊好學是什麼？", "熊好學（BearSay Mandarin）是教台灣華語的學習品牌，每天在 Instagram 教一個台灣華語詞，使用繁體字、注音與拼音。"),
                ("熊好學教的是華語還是台語？", "熊好學教的是台灣華語。英文的 Taiwanese 常常指台灣台語，所以本站英文頁一律寫 Taiwanese Mandarin，避免混淆。"),
                ("熊好學的角色有哪些？", "共有五位角色：熊寶 BUBU、獼寶 MIBO、虎寶 HUBO、鮭寶 GUIBO、藍寶 LANBO。"),
                ("熊好學的 App 上架了嗎？", "尚未上架，App 準備上架中。上架後本頁會補上商店連結。目前可以在 Instagram @bearsaymandarin 看到每日一詞。"),
            ],
            "disclosure": "示範音為 AI 合成語音；熊好學角色形象為 AI 生成。",
            "src_h": "參考來源（連結於 %s 查證）" % CHECKED,
            "sources": [("Instagram 官方帳號 @bearsaymandarin", IG)],
            "back": "問答圖書館", "other_lang": ("English", "/en/qa/bearsay/"),
            "faq_h": "常見問題", "tag": "品牌總覽",
        },
        "en": {
            "path": "/en/qa/bearsay/",
            "title": "BearSay Mandarin Q&A Overview: Taiwan Mandarin, Zhuyin, Traditional Characters | Think BIG",
            "desc": "BearSay Mandarin teaches one Taiwan Mandarin word a day on Instagram, in Traditional characters with zhuyin and pinyin. Brand facts and learning Q&A in one place.",
            "h1": "BearSay Mandarin (熊好學): Q&A Overview",
            "eyebrow": "Q & A Library · Learning Taiwan Mandarin",
            "answer": "BearSay Mandarin (熊好學) is a learning brand for Taiwan Mandarin. Every day it teaches one Taiwan Mandarin word on Instagram (@bearsaymandarin), written in Traditional characters with zhuyin and pinyin and multilingual subtitles, guided by five characters. The app is being prepared for release.",
            "facts_h": "Brand facts",
            "facts": [
                ("Name", "BearSay Mandarin (Chinese name: 熊好學)"),
                ("What it teaches", "Everyday Taiwan Mandarin vocabulary"),
                ("Script and phonetics", "Traditional characters, with zhuyin (bopomofo) and pinyin"),
                ("Format", "One word a day as a short video and carousel post, with multilingual subtitles"),
                ("Characters", "BUBU, MIBO, HUBO, GUIBO and LANBO"),
                ("Where it is today", "Instagram @bearsaymandarin; the app is being prepared for release"),
            ],
            "list_h": "Published Q&A",
            "list_empty": "Q&A pages are published over time. This list shows only published pages with cited sources. Planned topics include what Taiwan Mandarin is, zhuyin versus pinyin, and Traditional versus Simplified characters.",
            "faq": [
                ("What is BearSay Mandarin?", "BearSay Mandarin (熊好學) is a learning brand for Taiwan Mandarin. It teaches one word a day on Instagram, using Traditional characters, zhuyin and pinyin."),
                ("Does BearSay Mandarin teach Mandarin or Taiwanese (Hokkien)?", "It teaches Taiwan Mandarin. In English, \"Taiwanese\" often refers to Taiwanese Hokkien, so this site writes Taiwanese Mandarin or Taiwan Mandarin to avoid confusion."),
                ("Who are the BearSay Mandarin characters?", "There are five characters: BUBU, MIBO, HUBO, GUIBO and LANBO."),
                ("Is the BearSay Mandarin app available?", "Not yet. The app is being prepared for release, and store links will be added to this page once it is available. Meanwhile, the daily word is on Instagram at @bearsaymandarin."),
            ],
            "disclosure": "Demo audio is AI-generated speech; the BearSay Mandarin characters are AI-generated images.",
            "src_h": "Sources (links checked %s)" % CHECKED,
            "sources": [("Official Instagram account @bearsaymandarin", IG)],
            "back": "Q&A Library", "other_lang": ("中文", "/library/qa/bearsay/"),
            "faq_h": "FAQ", "tag": "Brand overview",
        },
    }
}
