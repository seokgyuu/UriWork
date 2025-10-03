"""
AWS Lambda용 핸들러
Mangum을 사용하여 FastAPI를 Lambda에서 실행
"""
import os
import sys
from mangum import Mangum

# 현재 디렉토리를 Python 경로에 추가
sys.path.insert(0, os.path.dirname(__file__))

# main.py의 app 객체를 import
from main import app

# Lambda 핸들러 생성
handler = Mangum(app, lifespan="off")

# Lambda 진입점
def lambda_handler(event, context):
    return handler(event, context)
