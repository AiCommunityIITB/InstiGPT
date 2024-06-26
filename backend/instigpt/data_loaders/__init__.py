# NOTE: The HTML import must be at the top since it uses `grequests` which
# monkey-patches the SSL module and hence must be loaded before anyone loads the
# SSL module
# from .html import load_html_data
# from .csv import load_csv_data
# from .urls import load_urls_data
from .clean_html import extract_clean_html_data
from .json import load_json_data
from .pdf import load_pdf_data
