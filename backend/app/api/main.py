from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import datasets, auth, suites, evals, invocations
from app.modules.minio import MINIO
from app.modules.postgredb import PostgresDB


app = FastAPI(root_path="/api")

app.include_router(auth.router)
app.include_router(datasets.router)
app.include_router(suites.router)
app.include_router(evals.router)
app.include_router(invocations.router)


@app.get("/")
def root():
    return {"message": "Welcome Evangelist Backend API"}


minio = MINIO()

minio.init_buckets(["datasets", "suites"])

postgres = PostgresDB()

postgres.init_db()


# Add CORS middleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
