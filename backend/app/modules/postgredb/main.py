import os
import psycopg2 as psycopg

# from dotenv import load_dotenv
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from .queries import QUERY


host: str = os.getenv("POSTGRES_HOST")
database: str = os.getenv("POSTGRES_DB")
user: str = os.getenv("POSTGRES_USER")
password: str = os.getenv("POSTGRES_PASSWORD")
port: str = os.getenv("POSTGRES_PORT", "5432")
tz: str = os.getenv("TIME_ZONE", "Asia/Jakarta")

DATABASE_URL: str = f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{database}"
engine = create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=30,
    pool_timeout=60,
    pool_recycle=3600,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class PostgresDB:
    def __init__(self, database: str = database):
        self.conn = psycopg.connect(
            dbname=database,
            user=user,
            password=password,
            host=host,
            port=port,
        )

        self.cursor = self.conn.cursor()
        self.query = QUERY

    def init_db(self):
        self.cursor.execute(self.query["CREATE_DATASETS_TABLE"])
        self.cursor.execute(self.query["CREATE_SUITES_TABLE"])

        self.conn.commit()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()

    def get_session() -> Generator:
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()
