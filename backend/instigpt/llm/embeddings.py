import os

from langchain_core.embeddings import Embeddings
from langchain_community.embeddings import VoyageEmbeddings

# from langchain_community.embeddings import HuggingFaceEmbeddings
# from huggingface_hub import login

# from langchain_google_genai import GoogleGenerativeAIEmbeddings


from instigpt import config


import os

def get_embeddings() -> Embeddings:
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
