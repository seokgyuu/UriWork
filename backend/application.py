"""
AWS Elastic Beanstalk용 WSGI 애플리케이션 진입점
"""
import os
import sys

# 현재 디렉토리를 Python 경로에 추가
sys.path.insert(0, os.path.dirname(__file__))

# main.py의 app 객체를 import
from main import app

# WSGI 애플리케이션 객체
application = app

if __name__ == "__main__":
    application.run()
