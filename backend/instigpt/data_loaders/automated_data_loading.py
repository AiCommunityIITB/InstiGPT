from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain.docstore.document import Document
from langchain_core.embeddings import Embeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain.embeddings import HuggingFaceEmbeddings
from transformers import AutoModel
import os
import json
from langchain_community.embeddings import VoyageEmbeddings
import chromadb
from chromadb.config import Settings
from chromadb.api import ClientAPI
from .csv import load_csv_data
from .json import load_json_data
from .pdf import load_pdf_data
from .urls import load_urls_data
from instigpt import config

from dotenv import load_dotenv

load_dotenv()

# Document Paths
PDFS = [
    "Apping Guide Booklet",
    "Bluebook Edition Three",
    "Course Info Booklet 2020-21",
    "Non-Core Apping Guide",
    "SAC-Constitution-March-2018",
    "MInDS Minor",
    "itc_report",
    "ugrulebook"
]
PDFS = ["pdf/" + pdf + ".pdf" for pdf in PDFS]
JSONS = ["resobin_courses_final", "itc"]  # "dept_web_scrap", "misc_web_scrap", "resobin_courses_final", 
JSONS = ["json/" + json + ".json" for json in JSONS]
URLS_DEPT = [
    "aero",
    "bio",
    "che",
    "chem",
    "civil",
    "earth",
    "eco",
    "elec",
    "env",
    "hss",
    "maths",
    "mech",
]
URLS_DEPT = ["urls/dept/" + url + ".json" for url in URLS_DEPT]
URLS_DAMP = ["aero", "civil", "cse", "elec", "ese", "mems"]
URLS_DAMP = ["urls/damp/" + url + ".json" for url in URLS_DAMP]
URLS_MISC = ["smp", "dept_urls"]
URLS_MISC = ["urls/" + url + ".json" for url in URLS_MISC]
URLS = URLS_DEPT + URLS_DAMP + URLS_MISC
CSVS = [
    "elec_damp_intern",
    "elec_damp_minor",
    "elec_damp_minor",
    "mech_damp_courses",
    "mech_damp_events",
]
CSVS = ["csv/" + csv + ".csv" for csv in CSVS]
root_pdf = "data/pdf/new/"
NEW_PDFS = os.listdir(root_pdf)
NEW_PDFS = ["pdf/new/" + pdf for pdf in NEW_PDFS]

root = "data/urls/misc/"
LATEST_URLS = os.listdir(root)
LATEST_URLS = ["urls/misc/" + url for url in LATEST_URLS]

root_itc = "data/urls/itc/"
ITC_URLS = os.listdir(root_itc)
ITC_URLS = ["urls/itc/" + url for url in ITC_URLS]

# use PDFS, JSONS, CSVS, URLS as input

ROOT_PATH = "data/"

EMBEDDING_MODEL = "models/embedding-001"

# Retriever
# COLLECTION_NAME = "beta-test-no-urls"

# Generator
GENERATOR_MODEL = "gemini-pro"
GENERATOR_TEMPERATURE = 0

# emdbeddings = GoogleGenerativeAIEmbeddings(model=EMBEDDING_MODEL)  # type: ignore

def get_embeddings() -> Embeddings:
    # embeddings = HuggingFaceEmbeddings(model_name=config.EMBEDDING_MODEL)
    # embeddings = GoogleGenerativeAIEmbeddings(model=config.EMBEDDING_MODEL)  # type: ignore
    embeddings = VoyageEmbeddings(voyage_api_key="pa-rkmFdeflRlZT3dastzQP5E8J_ee7A82rKwLtyG7I8v8", model="voyage-large-2")
    return embeddings

emdbeddings = get_embeddings()


# emdbeddings = AutoModel.from_pretrained('jinaai/jina-embeddings-v2-base-en', trust_remote_code=True) 
# model_name = "jinaai/jina-embeddings-v2-base-en"
# model_kwargs = {'device': 'cpu'}
# emdbeddings = HuggingFaceEmbeddings(
#     model_name=model_name,
#     model_kwargs=model_kwargs,
# )


def get_db_client() -> ClientAPI:
    return chromadb.HttpClient(
        host=os.environ["VECTOR_DB_HOST"],
        port=os.environ["VECTOR_DB_PORT"],
        settings=Settings(allow_reset=True),
    )


client = get_db_client()


def load_list_of_paths(doc_list: list):
    total_docs = 0
    for data_path in doc_list:
        data_path = ROOT_PATH + data_path
        document_name = data_path.split("/")[-1].split(".")[0]
        num_docs_added = 0
        if data_path.endswith(".pdf"):
            num_docs_added = load_pdf_data(
                client=client,
                embeddings=emdbeddings,
                document_name=document_name,
                data_path=data_path,
            )
        elif data_path.endswith(".json"):
            with open(data_path) as f:
                data = json.load(f)
            if type(data[0]) == str and data[0].startswith("http"):
                num_docs_added = load_urls_data(
                    client=client,
                    embeddings=emdbeddings,
                    data_path=data_path,
                )
            else:
                num_docs_added = load_json_data(
                    client=client,
                    embeddings=emdbeddings,
                    document_name=document_name,
                    data_path=data_path,
                )
        elif data_path.endswith(".csv"):
            num_docs_added = load_csv_data(
                client=client,
                embeddings=emdbeddings,
                document_name=document_name,
                data_path=data_path,
            )
        print(f"Number of documents added for {document_name}: {num_docs_added}\n")
        total_docs += num_docs_added
    print(f"Total Documents added: {total_docs}\n")


client.reset()

load_list_of_paths(PDFS)
load_list_of_paths(NEW_PDFS)
load_list_of_paths(JSONS)
load_list_of_paths(CSVS)

print(client.list_collections())
