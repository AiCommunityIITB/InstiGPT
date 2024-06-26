from typing import Any, Iterable
from beanie import Document as BeanieDocument


class Document(BeanieDocument):
    content: str
    metadata: dict[str, Any]
    vector: list[float]


async def create_docuement(document: Document) -> None:
    await document.insert()


async def create_docuements(documents: Iterable[Document]) -> None:
    await Document.insert_many(documents)


async def clear_docuements() -> None:
    await Document.delete_all()


# async def search_documents(embeddings: Any) -> list[Document]:
#     coll = Document.get_motor_collection()
#     docs: list[Document] = await coll.aggregate(
#         pipeline=[
#             {
#                 "$search": {
#                     "cosmosSearch": {
#                         "vector": embeddings,
#                         "path": "vector",
#                         "k": 2,
#                         "efSearch": 40,
#                     },
#                 }
#             }
#         ]
#     ).to_list(2)

#     return docs


async def create_vector_search_index() -> None:
    coll = Document.get_motor_collection()
    # indexes = coll.list_indexes()
    await coll.create_index(
        {
            "name": "VectorSearchIndex",
            "key": {"vector": "cosmosSearch"},
            "cosmosSearchOptions": {
                "kind": "vector-hnsw",
                "m": 16,
                "efConstruction": 64,
                "similarity": "COS",
                "dimensions": 3,
            },
        }
    )
