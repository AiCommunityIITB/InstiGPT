import os
from functools import partial
from typing import Generator

import chromadb
from chromadb.config import Settings
from chromadb.api import ClientAPI
from langchain_core.embeddings import Embeddings
from langchain.vectorstores.chroma import Chroma
from langchain.tools import Tool
from langchain_community.utilities.google_search import GoogleSearchAPIWrapper

from instigpt import config



def get_db_client() -> ClientAPI:
    try:
        host = os.environ["VECTOR_DB_HOST"]
        port = os.environ["VECTOR_DB_PORT"]
        if not host or not port:
            print("VECTOR_DB_HOST or VECTOR_DB_PORT environment variables are empty.")
            return None

        return chromadb.HttpClient(
            host=host,
            port=port,
            settings=Settings(allow_reset=True),
        )
    except KeyError as e:
        print(f"Missing environment variable: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred while creating the DB client: {e}")
        return None



def get_retriever(embeddings: Embeddings):
    try:
        client = get_db_client()
        if client is None:
            print("Error: Database client is not initialized. Check environment variables and Chroma server.")
            return None
        
        db = Chroma(
            client=client,
            collection_name=config.COLLECTION_NAME,
            embedding_function=embeddings,
        )
        return db.as_retriever(search_kwargs={"k": 5})

    except Exception as e:
        print(f"An error occurred while creating the retriever: {e}")
        return None


import os
from typing import Generator, Optional
from functools import partial

def get_search_results_retriever() -> Generator[Tool, None, None]:
    try:
        google_api_keys = os.environ["GOOGLE_API_KEYS"]
        if not google_api_keys:
            raise KeyError("GOOGLE_API_KEYS is empty.")
        
        api_keys = google_api_keys.split(",")
        wrappers = [GoogleSearchAPIWrapper(google_api_key=key) for key in api_keys]  # type: ignore
        tools = [
            Tool(
                name="Google Search",
                description="Search Google for recent results.",
                func=partial(wrapper.results, num_results=5),
            )
            for wrapper in wrappers
        ]

        i = 0
        while True:
            yield tools[i]
            i += 1
            i %= len(api_keys)

    except KeyError:
        # Fallback: yield a dummy Tool
        def dummy_search(*args, **kwargs):
            return ["Google Search is not configured."]  

        yield Tool(
            name="Google Search (Disabled)",
            description="Google search is not configured.",
            func=dummy_search,
        )

    except Exception as e:
        print(f"Unexpected error in search retriever: {e}")

        # Yield a dummy tool in case of unexpected errors
        def dummy_search(*args, **kwargs):
            return ["Google Search is not available due to an error."]

        yield Tool(
            name="Google Search (Error)",
            description="An error occurred while setting up Google Search.",
            func=dummy_search,
        )

