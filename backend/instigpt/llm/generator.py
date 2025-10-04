from typing import TypedDict, Generator
import re
import os 

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate, ChatPromptTemplate
from langchain_core.runnables import Runnable, RunnableConfig, chain
from langchain_core.language_models import BaseChatModel
from langchain_core.output_parsers import StrOutputParser
from langchain_core.vectorstores import VectorStoreRetriever
from langchain.callbacks.tracers import ConsoleCallbackHandler
from langchain.tools import Tool

from instigpt import config, data_loaders

debug_config: RunnableConfig = {"callbacks": [ConsoleCallbackHandler()]}


def get_generator_model():
    google_api_key = os.getenv("GOOGLE_API_KEY")
    if not google_api_key:
        print("Error: GOOGLE_API_KEY is missing. Please set it in environment variables.")
        return None  # or raise an exception, or handle as needed
    
    return ChatGoogleGenerativeAI(
        model=config.GENERATOR_MODEL,
        temperature=config.GENERATOR_TEMPERATURE,
    )  # type: ignore


CONDENSE_QUESTION_PROMPT = PromptTemplate.from_template(
    """Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.
If the follow up question is already a standalone question, simply copy it.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:"""
)

ANSWER_PROMPT = ChatPromptTemplate.from_template(
    """Hello there, Your name is InstiGPT! You are developed by the InstiGPT Team, AI Community of IIT Bombay. Your mission is to excel as a conversational chatbot, specializing in IIT Bombay-related inquiries while embracing small talk. Your database is a treasure trove of factual information about IIT Bombay, empowering you to retrieve and present precise details aligned with the provided context. Ensure your responses are informative, concise, and warmly welcoming.

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
CONTEXT: {search_results} \n {context}
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


def get_chain(
    llm: BaseChatModel,
    retriever: VectorStoreRetriever,
    search_results_retriever: Generator[Tool, None, None],
) -> Runnable[ChainInput, str]:
    # https://python.langchain.com/docs/expression_language/cookbook/retrieval
    if llm is None:
        raise RuntimeError("LLM model is not initialized. Cannot build chains.")

    question_condenser = CONDENSE_QUESTION_PROMPT | llm | StrOutputParser()
    final_answer = ANSWER_PROMPT | llm | StrOutputParser()

    @chain
    def my_chain(inp: ChainInput) -> str:
        question = inp["question"].lower()
        search_regex = r"\bpor\b|\bpors\b|\bp.o.r\b|\bp.o.r.s\b|\bp.o.rs\b|\bp.o.r\b|\bp.or\b|\bpo.r\b|\bp.ors\b|\bpo.rs\b"
        replacement_text = "Positions of Responsibilities"
        question = re.sub(search_regex, replacement_text, question)
        if inp["chat_history"] == "None":
            condensed_question = question
        else:
            condensed_question = question_condenser.invoke(
                {"question": question, "chat_history": inp["chat_history"]}
            )

        # TOOD: Use GPTCache here!

        context = retriever.invoke(condensed_question)
        search_results = next(search_results_retriever).invoke(
            f"{condensed_question} in IIT Bombay"
        )

        # Fetching search results sometimes results in:
        # [{'Result': 'No good Google Search Result was found'}]
        try:
            search_result_links = [res["link"] for res in search_results]
            html_links = [
                link for link in search_result_links if not link.endswith(".pdf")
            ]
            pdf_links = [
                res["link"] for res in search_results if res["link"].endswith(".pdf")
            ]

            extracted_search_results = [
                data_loaders.clean_html.extract_clean_html_data(res)
                for res in data_loaders.clean_html.get_responses(html_links)
            ]
            extracted_search_results += [
                data_loaders.pdf.extract_pdf_content(link) for link in pdf_links
            ]
        except:
            extracted_search_results = []

        return final_answer.invoke(
            {
                "question": question,
                "context": context,
                "search_results": [
                    res[:3000] for res in extracted_search_results if res is not None
                ],
                "chat_history": inp["chat_history"],
            }
        )

    return my_chain
