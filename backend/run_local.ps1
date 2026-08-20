$ErrorActionPreference = "Stop"

# Run the development API with a local SQLite database.
$env:DATABASE_URL = "sqlite:///./healthwatch.db"

py seed_data.py
py -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
