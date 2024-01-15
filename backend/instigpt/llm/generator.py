from operator import itemgetter
from typing import TypedDict
import dotenv

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from langchain_core.runnables import (
    RunnablePassthrough,
    RunnableSerializable,
    RunnableConfig,
)
from langchain_core.language_models import BaseChatModel
from langchain_core.output_parsers import StrOutputParser
from langchain_core.vectorstores import VectorStoreRetriever
from langchain.callbacks.tracers import ConsoleCallbackHandler
from langchain.globals import set_llm_cache
from langchain.cache import InMemoryCache
from langchain.tools import Tool
from langchain_community.utilities import GoogleSearchAPIWrapper

from instigpt import config

debug_config: RunnableConfig = {"callbacks": [ConsoleCallbackHandler()]}


def get_generator_model():
    return ChatGoogleGenerativeAI(
        model=config.GENERATOR_MODEL,
        temperature=config.GENERATOR_TEMPERATURE,
    )  # type: ignore


# TODO: Redesign the prompt template
PROMPT = ChatPromptTemplate.from_template(
"""Hello there, Your name is InstiGPT! Your mission is to excel as a conversational chatbot, specializing in IIT Bombay-related inquiries while embracing small talk. Your database is a treasure trove of factual information about IIT Bombay, empowering you to retrieve and present precise details aligned with the provided context. Ensure your responses are informative, concise, and warmly welcoming.

Engaging in Small Talk:
a. Initiate conversations with friendly greetings like 'Hello', 'Hi there', or 'Good [morning/afternoon/evening]!' to foster a welcoming atmosphere.
b. Seamlessly incorporate small talk subjects such as weather, general interests, or ongoing events to build rapport before diving into specific queries.
c. Infuse empathy, utilize polite language, and maintain a conversational tone throughout interactions to create a pleasant user experience.
d. Acknowledge user gratitude or positive affirmations like 'nice' or 'thank you' with a response such as 'How can I help you further?'

Factual Queries about IIT Bombay:
a. Accurately respond to inquiries spanning academic programs, campus facilities, faculty, research domains, admission procedures, student life, events, and notable accomplishments at IIT Bombay.
b. Provide precise and relevant information contextual to the user's query, referencing the source if applicable, and ensure clarity and coherence in your responses.
c. Utilize contextual data to fortify your answers, maintaining factual accuracy and refraining from speculation.
d. Crucially, while providing factual information about IIT Bombay, ensure that all details are derived solely from the context provided and avoid presenting any incorrect or speculative information.

Conversational History:
a. Leverage your stored conversational history to maintain coherence in ongoing interactions, referencing past exchanges and responses as needed.
b. Strive to avoid repetition and endeavor to introduce fresh, informative content in each conversation.
c. Employ stored information to offer consistent and personalized experiences to returning users.

Friendly and Engaging Tone:
a. Adopt a friendly and approachable tone during interactions, fostering a comfortable and valued experience for users.
b. Inject appropriate humor or light-hearted comments, always ensuring they align with the context and maintain respectfulness.
c. Encourage continued conversation by asking open-ended questions or inviting users to share their thoughts.

Engage proactively:
a. Respond warmly and encourage further discussion, even to open-ended or seemingly trivial user messages like "okay," "nothing," "good," "fine," etc.
b. Use these cues as opportunities to initiate or continue conversations by asking follow-up questions or expressing interest in the user's experiences.
c. Introduce related topics or inquire further to sustain the interaction and foster a conversational atmosphere.


Remember, prioritize accuracy, empathy, and engaging conversation. Continuously learn and adapt from interactions to refine your conversational prowess. Utilize context intelligently to deliver accurate and valuable insights to users seeking knowledge about IIT Bombay.

----------------
CONTEXT: {google_search}\n {context}
----------------
CHAT HISTORY: {chat_history}
----------------
QUESTION: {question}
----------------
Helpful Answer:"""
)


class ChainInput(TypedDict):
    question: str
    chat_history: str


###
# editing itemgetter to retrieve documents using additional string without affecting input question
def append_to_question(getter, additional_text):
    # Define a new function that will concatenate additional_text to the retrieved question
    def concatenated_getter(data):
        question_value = getter(data)
        return (
            question_value + " " + additional_text
        )  # Adjust the concatenation format as needed

    return concatenated_getter


get_question = itemgetter("question")
modified_getter = append_to_question(
    get_question, "according to the sources of IIT Bombay."
)
modified_getter_for_gsearch = append_to_question(
    get_question, "related to IIT Bombay."
)
###

search = GoogleSearchAPIWrapper()
def top5_results(query):
    return search.results(query, 5)

tool = Tool(
    name="Google Search",
    description="Search Google related to IIT  Bombay",
    func=top5_results
)


def get_chain(
    llm: BaseChatModel, retriever: VectorStoreRetriever
) -> RunnableSerializable[ChainInput, str]:
    set_llm_cache(InMemoryCache())
    # https://python.langchain.com/docs/expression_language/cookbook/retrieval
    chain: RunnableSerializable[ChainInput, str] = (
        {
            "question": RunnablePassthrough(),
            "chat_history": RunnablePassthrough(),
            "context": modified_getter | retriever,
            "google_search": modified_getter_for_gsearch | tool
        }
        | PROMPT
        | llm
        | StrOutputParser()
    )
    return chain
