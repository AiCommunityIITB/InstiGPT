import os
from functools import partial
from typing import Generator

from langchain_core.embeddings import Embeddings
from langchain.tools import Tool
from langchain_community.utilities.google_search import GoogleSearchAPIWrapper
from langchain_community.vectorstores import AzureCosmosDBVectorSearch

from instigpt import db


def get_retriever(embeddings: Embeddings):
    return AzureCosmosDBVectorSearch.from_connection_string(
        os.environ["DATABASE_URL"],
        "instigpt.Document",
        embeddings,
        index_name="VectorSearchIndex",
    )


def get_search_results_retriever() -> Generator[Tool, None, None]:
    api_keys = os.environ["GOOGLE_API_KEYS"].split(",")
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
