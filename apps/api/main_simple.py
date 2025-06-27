"""
Simple FastAPI test server to verify basic functionality
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="ColdCopy API (Test Mode)",
    description="AI-powered cold outreach automation platform",
    version="0.1.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "Welcome to ColdCopy API",
        "status": "running",
        "mode": "test",
        "note": "This is a simplified version for testing. Database and other services are not connected."
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "api": "operational",
        "database": "not connected (test mode)",
        "redis": "not connected (test mode)"
    }

@app.get("/api/test")
async def test_endpoint():
    return {
        "message": "API is working!",
        "frontend_url": os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
        "environment": os.getenv("ENVIRONMENT", "development")
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)