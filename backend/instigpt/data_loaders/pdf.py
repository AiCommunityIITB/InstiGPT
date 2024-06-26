from typing import Optional

from langchain_core.embeddings import Embeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader

from instigpt import db


def extract_pdf_content(link: str) -> Optional[str]:
    try:
        loader = PyPDFLoader("/tmp/live_extract.pdf")
        loader.web_path = link
    except:
        return None

    docs = loader.load()
    return "\n".join([doc.page_content for doc in docs])


async def load_pdf_data(
    embeddings: Embeddings,
    document_name: str,
    data_path: str,
) -> int:
    """Reads the data in the pdf, chunks it and stores the chunks in the
    database along with its embeddings.

    returns: int: number of chunks stored in the database
    """

    try:
        loader = PyPDFLoader(data_path)
    except ValueError:
        return 0

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=2000,
        chunk_overlap=1000,
        length_function=len,
        is_separator_regex=True,
    )
    docs = loader.load()
    docs = [
        "\n".join([docs[i + j].page_content for j in range(4)])
        for i in range(len(docs) - 3)
    ]
    docs = text_splitter.create_documents(docs)
    docs = [doc.page_content for doc in docs]

    if len(docs) == 0:
        return 0

    vectors = embeddings.embed_documents(docs)
    await db.document.create_docuements(
        [
            db.Document(
                content=docs[i],
                metadata={"source": document_name},
                vector=vectors[i],
            )
            for i in range(len(docs))
        ]
    )

    return len(docs)
