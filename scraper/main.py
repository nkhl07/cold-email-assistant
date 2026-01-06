from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List

import requests
from bs4 import BeautifulSoup
from PyPDF2 import PdfReader
import io
import json

# Create the FastAPI app object
app = FastAPI()


# ----- Data models -----

class ScrapeRequest(BaseModel):
    # The JSON body must have: { "urls": ["https://...", "https://..."] }
    urls: List[HttpUrl]


class ScrapedProfile(BaseModel):
    # What we send back: just one big chunk of text for now
    combined_text: str


class ProcessedData(BaseModel):
    # Combined scraped text from URLs and extracted PDF text
    combined_text: str  # Scraped from URLs
    student_profile: str  # Extracted from PDF


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


@app.post("/process", response_model=ProcessedData)
async def process_pdf_and_urls(
    pdf: UploadFile = File(...),
    urls: str = Form(...)
):
    """
    Accept a PDF file and URLs, extract text from PDF,
    scrape URLs, and return both.
    """
    # Validate PDF file type
    if not pdf.content_type or 'pdf' not in pdf.content_type.lower():
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # Parse URLs from JSON string
    try:
        url_list = json.loads(urls)
    except json.JSONDecodeError:
        url_list = []

    # Extract text from PDF
    pdf_text = ""
    try:
        # Read PDF file content
        pdf_content = await pdf.read()
        pdf_file = io.BytesIO(pdf_content)

        # Extract text using PyPDF2
        pdf_reader = PdfReader(pdf_file)

        # Extract text from all pages
        text_parts = []
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

        pdf_text = "\n\n".join(text_parts)

        # Limit to 15000 characters (reasonable resume length)
        pdf_text = pdf_text[:15000]

        if not pdf_text.strip():
            pdf_text = "[Error: Could not extract text from PDF. The PDF may be image-based.]"

    except Exception as e:
        pdf_text = f"[Error extracting PDF: {e}]"

    # Scrape URLs (same logic as existing /scrape endpoint)
    scraped_pieces: list[str] = []

    for url_str in url_list:
        try:
            resp = requests.get(url_str, timeout=10)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            text = soup.get_text(separator="\n", strip=True)
            scraped_pieces.append(text[:10000])
        except Exception as e:
            scraped_pieces.append(f"[Error scraping {url_str}: {e}]")

    combined_scraped = "\n\n--- PAGE BREAK ---\n\n".join(scraped_pieces) if scraped_pieces else ""

    return ProcessedData(
        combined_text=combined_scraped,
        student_profile=pdf_text
    )
