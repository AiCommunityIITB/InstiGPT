import os

from langchain_core.embeddings import Embeddings
from langchain_community.embeddings import VoyageEmbeddings

from langchain_community.embeddings import HuggingFaceEmbeddings
from huggingface_hub import login

from langchain_google_genai import GoogleGenerativeAIEmbeddings


from instigpt import config


import os

def get_embeddings() -> Embeddings:
     # login to huggingface hub to access private models
    # login(os.environ["HUGGINGFACE_API_KEY"])

    # embeddings = HuggingFaceEmbeddings(model_name=config.EMBEDDING_MODEL, model_kwargs = {'device': 'cpu'})
    # embeddings = GoogleGenerativeAIEmbeddings(model=config.EMBEDDING_MODEL)  # type: ignore
    try:
        voyage_api_key = os.environ["VOYAGE_API_KEY"]
        if not voyage_api_key:
            print("Voyage API key is not set.")
            return None
        
        embeddings = VoyageEmbeddings(
            voyage_api_key=voyage_api_key,
            model=config.EMBEDDING_MODEL,
        )
        return embeddings
    
    except KeyError:
        print("Environment variable VOYAGE_API_KEY is missing.")
        return None
    
    except Exception as e:
        print(f"An unexpected error occurred while initializing embeddings: {e}")
        return None
    login to huggingface hub to access private models
    login(os.environ["HUGGINGFACE_API_KEY"])


    # Check embedding model 
    if config.EMBEDDING_MODEL == "voyage-large-2":
        embeddings = VoyageEmbeddings(
            voyage_api_key=os.environ["VOYAGE_API_KEY"],  # for voyageembeddings
            model=config.EMBEDDING_MODEL,
        )
    elif config.EMBEDDING_MODEL == "jinaai/jina-embeddings-v2-base-en": # for huggingfaceembeddings
        embeddings = HuggingFaceEmbeddings(model_name=config.EMBEDDING_MODEL,
        model_kwargs = {'device': 'cpu'})
    elif config.EMBEDDING_MODEL == "models/embedding-001": # For google gen ai
        embeddings = GoogleGenerativeAIEmbeddings(model=config.EMBEDDING_MODEL)  
    else:
        raise Exception("config.EMBEDDING_MODEL not set")

    return embeddings
