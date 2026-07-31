import uvicorn

if __name__ == "__main__":
    # Launch Uvicorn dev server on port 8000
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
