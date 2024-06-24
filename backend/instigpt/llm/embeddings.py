import os

from langchain_core.embeddings import Embeddings
from langchain_openai import AzureOpenAIEmbeddings

from instigpt import config


def get_embeddings() -> Embeddings:
    embeddings = AzureOpenAIEmbeddings(
        model=config.EMBEDDING_MODEL,
        azure_endpoint=os.environ["OPENAI_API_ENDPOINT"],
        api_key=os.environ["OPENAI_API_KEY"],
        api_version=os.environ["OPENAI_API_VERSION"],
    )

    return embeddings
