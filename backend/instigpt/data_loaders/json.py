import json

from langchain_core.embeddings import Embeddings

from instigpt import db


async def load_json_data(
    embeddings: Embeddings,
    document_name: str,
    data_path: str,
) -> int:
    """Reads the data in the json file and stores it in the database along with its embeddings.
    The json file must contain a list of documents. Each document must be a dictionary with a
    "doc" key containing the text of the document and an optional "metadata" key containing the metadata
    which is a dictionary.

    returns: int: number of chunks stored in the database
    """
    with open(data_path) as f:
        docs = json.load(f)

    if len(docs) == 0:
        return 0

    metadata_in_document = "metadata" in docs[0]

    if metadata_in_document:
        metadatas = []
        for doc in docs:
            metadata = doc["metadata"]
            if "source" not in metadata:
                metadata["source"] = document_name
            metadatas.append(metadata)
    else:
        metadatas = [{"source": document_name} for _ in range(len(docs))]
    docs = [json.dumps(doc["doc"]) for doc in docs]

    vectors = embeddings.embed_documents(docs)
    await db.document.create_docuements(
        [
            db.Document(
                content=docs[i],
                metadata=metadatas[i],
                vector=vectors[i],
            )
            for i in range(len(docs))
        ]
    )

    return len(docs)
