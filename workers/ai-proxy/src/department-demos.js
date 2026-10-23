// 六個部門的伺服器端虛構資料；每次執行皆由主流程複製。
export const departmentRoles = {
  "marketing": {
    "title": "AI 行銷企劃",
    "owners": "行銷企劃、行銷主管",
    "data": {
      "company": "大想成業（Think BIG；示範資料，人名與數字皆為虛構）",
      "notice": "示範資料，人名與數字皆為虛構；非真實客戶或真實營收；不儲存、不連外，草稿須人工覆核",
      "artifacts": {
        "campaign_results": {
          "rows": [
            [
              "活動",
              "週末選物展"
            ],
            [
              "曝光",
              "1200 次"
            ],
            [
              "點擊",
              "96 次"
            ],
            [
              "詢問",
              "12 次"
            ],
            [
              "提醒",
              "虛構數據，不能推論活動造成成交"
            ]
          ]
        },
        "social_draft": {
          "rows": [
            [
              "貼文草稿",
              "週末來大想成業，看看適合日常的杯子與提袋。想先看哪一款？"
            ],
            [
              "狀態",
              "待行銷主管覆核，未發布"
            ]
          ]
        },
        "content_calendar": {
          "rows": [
            [
              "示範週二",
              "商品故事｜行銷企劃"
            ],
            [
              "示範週四",
              "使用情境｜門市店員提供素材"
            ],
            [
              "示範週六",
              "選物問答｜行銷主管覆核"
            ]
          ]
        }
      }
    }
  },
  "media": {
    "title": "AI 影音企劃",
    "owners": "影音企劃、攝影師、剪輯師",
    "data": {
      "company": "大想成業（Think BIG；示範資料，人名與數字皆為虛構）",
      "notice": "示範資料，人名與數字皆為虛構；非真實客戶或真實營收；不儲存、不連外，草稿須人工覆核",
      "artifacts": {
        "video_script": {
          "rows": [
            [
              "0–3 秒｜開場",
              "鏡頭：桌面杯子特寫；旁白：今天的休息時間，用哪個杯子？"
            ],
            [
              "3–12 秒｜示範",
              "鏡頭：倒水與提袋收納；旁白：兩件日常選物，陪你出門。"
            ],
            [
              "12–20 秒｜收尾",
              "鏡頭：商品並排；字幕：你喜歡哪一款？"
            ]
          ]
        },
        "video_titles": {
          "rows": [
            [
              "標題一",
              "一個杯子，留一點休息時間"
            ],
            [
              "標題二",
              "出門前的兩件日常選物"
            ],
            [
              "封面字",
              "今天，慢慢選"
            ]
          ]
        },
        "release_schedule": {
          "rows": [
            [
              "示範週一",
              "影音企劃確認腳本"
            ],
            [
              "示範週三",
              "攝影師拍攝、剪輯師初剪"
            ],
            [
              "示範週五",
              "主管覆核後手動發布；未排入平台"
            ]
          ]
        }
      }
    }
  },
  "accounting": {
    "title": "AI 會計助理",
    "owners": "會計、出納、會計主管",
    "data": {
      "company": "大想成業（Think BIG；示範資料，人名與數字皆為虛構）",
      "notice": "示範資料，人名與數字皆為虛構；非真實客戶或真實營收；不儲存、不連外，草稿須人工覆核",
      "artifacts": {
        "reconcile_accounts": {
          "rows": [
            [
              "示範單號 HM-01",
              "帳列 NT$3,000／入帳 NT$3,000／差異 NT$0"
            ],
            [
              "示範單號 HM-02",
              "帳列 NT$2,000／入帳 NT$1,800／差異 NT$200"
            ],
            [
              "待確認",
              "由出納核對 HM-02，尚不能認定短付原因"
            ]
          ]
        },
        "payment_list": {
          "rows": [
            [
              "HM-03",
              "展示架｜NT$1,200｜缺驗收紀錄"
            ],
            [
              "HM-04",
              "包裝材料｜NT$800｜待會計主管覆核"
            ],
            [
              "狀態",
              "未請款、未付款"
            ]
          ]
        },
        "monthly_summary": {
          "rows": [
            [
              "示範月份",
              "虛構營運月"
            ],
            [
              "帳列收入",
              "NT$5,000"
            ],
            [
              "已入帳",
              "NT$4,800"
            ],
            [
              "待核對差異",
              "NT$200"
            ],
            [
              "待請款",
              "NT$2,000；未含未提供費用，不代表損益"
            ]
          ]
        }
      }
    }
  },
  "admin": {
    "title": "AI 行政助理",
    "owners": "行政專員、採購專員、會議主持人",
    "data": {
      "company": "大想成業（Think BIG；示範資料，人名與數字皆為虛構）",
      "notice": "示範資料，人名與數字皆為虛構；非真實客戶或真實營收；不儲存、不連外，草稿須人工覆核",
      "artifacts": {
        "meeting_notes": {
          "rows": [
            [
              "會議重點",
              "大想成業準備週末展示，先核對陳列與包材。"
            ],
            [
              "行政專員",
              "示範週三前確認展示桌位置"
            ],
            [
              "採購專員",
              "示範週四前彙整包材數量"
            ]
          ]
        },
        "meeting_room": {
          "rows": [
            [
              "會議室",
              "大想成業示範 A 室"
            ],
            [
              "時段",
              "下個示範營業日 10:00–10:30"
            ],
            [
              "狀態",
              "僅本次示範草稿；未預約，由行政專員確認"
            ]
          ]
        },
        "purchase_list": {
          "rows": [
            [
              "紙袋",
              "20 個｜先核對庫存"
            ],
            [
              "標籤紙",
              "2 包｜先取得報價"
            ],
            [
              "狀態",
              "未採購、未付款，待採購專員覆核"
            ]
          ]
        }
      }
    }
  },
  "training": {
    "title": "AI 訓練專員",
    "owners": "訓練專員、店長、帶教店員",
    "data": {
      "company": "大想成業（Think BIG；示範資料，人名與數字皆為虛構）",
      "notice": "示範資料，人名與數字皆為虛構；非真實客戶或真實營收；不儲存、不連外，草稿須人工覆核",
      "artifacts": {
        "onboarding_list": {
          "rows": [
            [
              "第一天",
              "店長介紹環境與緊急聯絡方式"
            ],
            [
              "第二天",
              "帶教店員示範商品介紹與交接"
            ],
            [
              "第三天",
              "訓練專員安排演練與回饋"
            ]
          ]
        },
        "training_quiz": {
          "rows": [
            [
              "第 1 題",
              "遇到未確認庫存時怎麼回覆？｜參考：先請店員核對"
            ],
            [
              "第 2 題",
              "馬克杯可以直火嗎？｜參考：不可以"
            ],
            [
              "第 3 題",
              "客訴由誰接手？｜參考：店長"
            ],
            [
              "第 4 題",
              "交接需記錄什麼？｜參考：待辦與負責人"
            ],
            [
              "第 5 題",
              "發布資訊前要做什麼？｜參考：主管覆核"
            ]
          ]
        },
        "sop_steps": {
          "rows": [
            [
              "步驟一",
              "店員確認顧客詢問，不索取不必要個資"
            ],
            [
              "步驟二",
              "核對商品說明；未知資訊交店長確認"
            ],
            [
              "步驟三",
              "覆述確認結果並完成交接紀錄"
            ]
          ]
        }
      }
    }
  },
  "research": {
    "title": "AI 市調分析師",
    "owners": "市調專員、行銷主管",
    "data": {
      "company": "大想成業（Think BIG；示範資料，人名與數字皆為虛構）",
      "notice": "示範資料，人名與數字皆為虛構；非真實客戶或真實營收；不儲存、不連外，草稿須人工覆核",
      "artifacts": {
        "competitor_table": {
          "rows": [
            [
              "木禾小舖（虛構）",
              "主打杯具｜示範商品 8 款｜資料待驗證"
            ],
            [
              "晴山雜貨（虛構）",
              "主打提袋｜示範商品 6 款｜資料待驗證"
            ],
            [
              "範圍",
              "只用預置示範資料，未連網查詢"
            ]
          ]
        },
        "review_themes": {
          "rows": [
            [
              "示範評論 1",
              "「杯子好拿」→ 使用手感正面"
            ],
            [
              "示範評論 2",
              "「想看更多尺寸」→ 規格資訊不足"
            ],
            [
              "示範評論 3",
              "「提袋收納方便」→ 收納情境正面"
            ],
            [
              "限制",
              "僅三則虛構評論，不代表市場比例"
            ]
          ]
        },
        "market_hypotheses": {
          "rows": [
            [
              "假設一",
              "補上杯具尺寸資訊可能減少規格詢問；比較上架前後詢問件數"
            ],
            [
              "假設二",
              "提袋收納示範可能提高點擊；以相同受眾測試兩版素材"
            ],
            [
              "待確認",
              "市調專員先訂樣本與觀察期間，尚未驗證"
            ]
          ]
        }
      }
    }
  }
};
export const departmentTools = {
  "marketing": {
    "campaign_results": {},
    "social_draft": {},
    "content_calendar": {}
  },
  "media": {
    "video_script": {},
    "video_titles": {},
    "release_schedule": {}
  },
  "accounting": {
    "reconcile_accounts": {},
    "payment_list": {},
    "monthly_summary": {}
  },
  "admin": {
    "meeting_notes": {},
    "meeting_room": {},
    "purchase_list": {}
  },
  "training": {
    "onboarding_list": {},
    "training_quiz": {},
    "sop_steps": {}
  },
  "research": {
    "competitor_table": {},
    "review_themes": {},
    "market_hypotheses": {}
  }
};
export const departmentLabels = {
  "campaign_results": "查活動成效",
  "social_draft": "擬社群貼文草稿",
  "content_calendar": "排內容日曆",
  "video_script": "擬短影音腳本",
  "video_titles": "建議標題與封面字",
  "release_schedule": "排發片時程",
  "reconcile_accounts": "對帳找差異",
  "payment_list": "整理待請款清單",
  "monthly_summary": "月報摘要",
  "meeting_notes": "整理會議重點與待辦",
  "meeting_room": "訂會議室草稿",
  "purchase_list": "整理採購清單",
  "onboarding_list": "整理新人到職訓練清單",
  "training_quiz": "出 5 題小測驗",
  "sop_steps": "整理 SOP 步驟",
  "competitor_table": "整理競品資料表",
  "review_themes": "歸納顧客評論重點",
  "market_hypotheses": "列可驗證的市場假設"
};
