from fastapi import FastAPI
from pydantic import BaseModel, HttpUrl
from typing import List

import requests
from bs4 import BeautifulSoup

# Create the FastAPI app object
app = FastAPI()


# ----- Data models -----

class ScrapeRequest(BaseModel):
    # The JSON body must have: { "urls": ["https://...", "https://..."] }
    urls: List[HttpUrl]


class ScrapedProfile(BaseModel):
    # What we send back: just one big chunk of text for now
    combined_text: str


# ----- Route -----

@app.post("/scrape", response_model=ScrapedProfile)
def scrape(req: ScrapeRequest):
    """
    Take a list of URLs, download each page, extract text,
    and return all the text combined into a single string.
    """
    pieces: list[str] = []

    for url in req.urls:
        try:
            # 1. Download the HTML
            resp = requests.get(str(url), timeout=10)
            resp.raise_for_status()

            # 2. Parse the HTML with BeautifulSoup
            soup = BeautifulSoup(resp.text, "html.parser")

            # 3. Extract visible text from the page
            text = soup.get_text(separator="\n", strip=True)

            # 4. Keep only the first 10k characters per page for now
            pieces.append(text[:10000])
        except Exception as e:
            # If something goes wrong, store an error message instead of text
            pieces.append(f"[Error scraping {url}: {e}]")

    combined = "\n\n--- PAGE BREAK ---\n\n".join(pieces)

    # FastAPI will convert this Pydantic model to JSON
    return ScrapedProfile(combined_text=combined)
