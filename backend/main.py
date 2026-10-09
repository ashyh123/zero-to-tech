import uuid
import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request,Response
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from pypinyin import lazy_pinyin, Style
from snownlp import SnowNLP
import json
from datetime import datetime,timezone
from storage import init_db,save_record, get_history

init_db()
load_dotenv()
origins = os.getenv("ALLOWED_ORIGINS")
if not origins:
    raise ValueError("请在 backend/.env 中设置 ALLOWED_ORIGINS")
ALLOWED_ORIGINS = [origin.strip() for origin in origins.split(",") if origin.strip()]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins = ALLOWED_ORIGINS,
    allow_methods = ["GET","POST"],
    allow_credentials = True,
)
def get_session_id(request: Request, response: Response) -> str:
    sid = request.cookies.get("session_id")      # 先看有没有纸条
    if not sid:                                  # 第一次来，没有——发一张
        sid = uuid.uuid4().hex                    # 一串随机、不重复的 id
        response.set_cookie(
            "session_id", sid,
            httponly=True, samesite="lax",
            max_age=60 * 60 * 24 * 30,            # 记 30 天
        )
    return sid



profile = {
    "heroTitle": "关于我",  # 临时标记，联调验证成功后可删掉
    "heroSubtitle": "项目，创意，灵感，心得，我的作品",
    "featuredWork": {
        "kicker": "作品",
        "title": "文字实验室",
        "copy": "拼音和情绪，挖掘中文里的细节",
        "linkLabel": "打开作品",
    },
    "identity": {
        "motto": "已识乾坤大，尤怜草木青",
        "learning": "零到全栈",
    },
}
class AnalyzeRequest(BaseModel):
    text: str
def score_label(score):
    if(score > 0.6):
        return "积极"
    elif(score < 0.4):
        return "消极"
    else:
        return "中性"

@app.get("/api/profile")
def get_profile():
    return profile
@app.post("/api/analyze")
def analyze(req: AnalyzeRequest,requese : Request,response : Response):
    sid = get_session_id(requese,response)

    text = req.text
    score = round(SnowNLP(text).sentiments, 2)

    result = {
        "text": req.text,
        "score" : score,
        "label" :score_label(score),
        "pinyin" : " ".join(lazy_pinyin(req.text, style=Style.TONE)),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    save_record(sid,result)
    return result
@app.get("/api/history")
def history(request: Request, response: Response, limit: int = 10):
    sid = get_session_id(request,response)
    return get_history(sid,limit)
