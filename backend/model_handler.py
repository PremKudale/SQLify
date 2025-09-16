import os
import json
import requests
import logging
import time
import psutil
from dotenv import load_dotenv
from logging_config import setup_logger
import openai
import re

# Load environment variables
load_dotenv()

# Setup logger
logger = setup_logger('model_handler')

# Configuration from environment variables
OLLAMA_API_BASE = os.environ.get("OLLAMA_API_BASE", "http://localhost:11434/api")
AKASH_API_KEY = os.environ.get("AKASH_API_KEY")
AKASH_API_BASE = os.environ.get("AKASH_API_BASE", "https://chatapi.akash.network/api/v1")
MAX_TOKENS = int(os.environ.get("MAX_TOKENS", 2048))
TEMPERATURE = float(os.environ.get("TEMPERATURE", 0.7))
REQUEST_TIMEOUT = int(os.environ.get("REQUEST_TIMEOUT", 120))

# Model names - Keep SQLCoder for Ollama, DeepSeek for Akash
QUERY_MODEL_NAME = os.environ.get("QUERY_MODEL_NAME", "")  # Ollama
SCHEMA_MODEL_NAME = os.environ.get("SCHEMA_MODEL_NAME", "")

class ModelHandler:
    def __init__(self):
        # Initialize Ollama client (for SQLCoder)
        self.ollama_client = None
        
        # Initialize Akash/DeepSeek client
        self.akash_client = None
        if os.environ.get("AKASH_API_KEY"):
            try:
                self.akash_client = openai.OpenAI(
                    api_key=os.environ["AKASH_API_KEY"],
                    base_url=AKASH_API_BASE
                )
            except Exception as e:
                logger.error(f"Failed to initialize Akash client: {str(e)}")
        
        self.current_model = None

    def is_gpu_available(self):
        """
        Check if CUDA GPU is available.
        """
        try:
            import subprocess
            result = subprocess.run(['nvidia-smi'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            return result.returncode == 0
        except:
            return False

    def get_available_memory(self):
        """
        Get available GPU or system memory in MB.
        """
        if self.is_gpu_available():
            try:
                import subprocess
                result = subprocess.run(
                    ['nvidia-smi', '--query-gpu=memory.free', '--format=csv,nounits,noheader'],
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True
                )
                return int(result.stdout.strip())
            except:
                pass
        
        return psutil.virtual_memory().available // (1024 * 1024)

    def is_model_available(self, model_name):
        """Check model availability - different checks for each backend"""
        if model_name == SCHEMA_MODEL_NAME:
            return True  # DeepSeek is always available via API
        else:
        # Ollama model check for SQLCoder
            try:
                response = requests.get(f"{OLLAMA_API_BASE.replace('/api', '')}/api/tags", 
                                  timeout=REQUEST_TIMEOUT)  # Use REQUEST_TIMEOUT
                if response.status_code == 200:
                    models = response.json().get("models", [])
                    return any(m.get("name", "").startswith(model_name) for m in models)
                return False
            except Exception as e:
                logger.error(f"Error checking model availability: {str(e)}")
                return False

    def generate_response(self, prompt, model_name, max_tokens=MAX_TOKENS, temperature=TEMPERATURE):
        """Route to appropriate backend based on model name"""
        # Route to Akash API only for DeepSeek model
        if model_name == SCHEMA_MODEL_NAME:
            if not self.akash_client:
                raise Exception("Akash API client not initialized")
            
            try:
                response = self.akash_client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=max_tokens,
                    temperature=temperature
                )
                return response.choices[0].message.content
            except Exception as e:
                logger.error(f"Akash API error: {str(e)}")
                raise Exception(f"Akash API error: {str(e)}")
        
        # Default to Ollama for SQLCoder and other models
        else:
            try:
                response = requests.post(
                    f"{OLLAMA_API_BASE}/generate",
                    json={
                        "model": model_name,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": temperature,
                            "num_predict": max_tokens
                        }
                    },
                    timeout=REQUEST_TIMEOUT
                )
                if response.status_code != 200:
                    raise Exception(f"Ollama API error: {response.status_code}")
                return response.json().get("response", "")
            except Exception as e:
                logger.error(f"Ollama API error: {str(e)}")
                raise Exception(f"Ollama API error: {str(e)}")
    
    def _init_ollama_client(self):
        """Initialize Ollama client for SQLCoder"""
        self.ollama_client = True  # Just a flag
        # Verify SQLCoder is available
        if not self.is_model_available(QUERY_MODEL_NAME):
            raise Exception(f"SQLCoder model {QUERY_MODEL_NAME} not available in Ollama")
        


# Initialize a global instance of ModelHandler
model_handler = ModelHandler()

class ConversationHandler:
    """
    Manages conversation context for SQL explanations and follow-up questions.
    Stores query history and maintains context across multiple requests.
    """
    
    def __init__(self):
        self.conversations = {}  # Dictionary to store conversations by session ID
        self.max_history = 5     # Maximum number of messages to keep in history
        
    def create_or_reset_conversation(self, session_id, query=None, database_type="postgres"):
        """
        Create a new conversation or reset an existing one.
        
        Args:
            session_id (str): Unique identifier for the conversation
            query (str): Initial SQL query (optional)
            database_type (str): Type of database (postgres, mysql, trino)
        """
        self.conversations[session_id] = {
            "query": query,
            "database_type": database_type,
            "history": [],
            "last_updated": time.time()
        }
        
    def add_message(self, session_id, role, content):
        """
        Add a message to the conversation history.
        
        Args:
            session_id (str): Unique identifier for the conversation
            role (str): Role of the message sender ('user' or 'assistant')
            content (str): Message content
        """
        if session_id not in self.conversations:
            self.create_or_reset_conversation(session_id)
            
        self.conversations[session_id]["history"].append({
            "role": role,
            "content": content
        })
        
        # Trim history if it exceeds max length
        if len(self.conversations[session_id]["history"]) > self.max_history * 2:  # *2 for pairs of messages
            self.conversations[session_id]["history"] = self.conversations[session_id]["history"][-self.max_history*2:]
            
        self.conversations[session_id]["last_updated"] = time.time()
        
    def update_query(self, session_id, query, database_type=None):
        """
        Update the query for an existing conversation.
        
        Args:
            session_id (str): Unique identifier for the conversation
            query (str): New SQL query
            database_type (str): Type of database (optional)
        """
        if session_id not in self.conversations:
            self.create_or_reset_conversation(session_id, query, database_type)
        else:
            self.conversations[session_id]["query"] = query
            if database_type:
                self.conversations[session_id]["database_type"] = database_type
            self.conversations[session_id]["last_updated"] = time.time()
            
    def get_conversation_context(self, session_id):
        """
        Get the full conversation context for a session.
        
        Args:
            session_id (str): Unique identifier for the conversation
            
        Returns:
            dict: Conversation context
        """
        if session_id not in self.conversations:
            return None
        return self.conversations[session_id]
        
    def get_prompt_with_history(self, session_id, new_question=None):
        """
        Format the conversation history into a prompt for the model.
        
        Args:
            session_id (str): Unique identifier for the conversation
            new_question (str): New question to add to the context (optional)
            
        Returns:
            str: Formatted prompt with history
        """
        if session_id not in self.conversations:
            return new_question if new_question else ""
            
        context = self.conversations[session_id]
        database_type = context["database_type"]
        query = context["query"]
        history = context["history"]
        
        # Build prompt with query and database type
        prompt = f"### SQL Query Context\n"
        prompt += f"Database Type: {database_type.upper()}\n\n"
        prompt += f"```sql\n{query}\n```\n\n"
        
        # Add conversation history
        if history:
            prompt += "### Conversation History\n"
            for message in history:
                role = "User" if message["role"] == "user" else "Assistant"
                prompt += f"{role}: {message['content']}\n\n"
                
        # Add new question if provided
        if new_question:
            prompt += f"### New Question\n{new_question}\n\n"
            
        prompt += "### Response\n"
        prompt += "Provide a detailed and accurate explanation of the SQL query or answer the follow-up question."
        
        return prompt
        
    def cleanup_old_conversations(self, max_age_minutes=30):
        """
        Remove conversations that haven't been updated for a while.
        
        Args:
            max_age_minutes (int): Maximum age of conversations in minutes
        """
        current_time = time.time()
        sessions_to_remove = []
        
        for session_id, context in self.conversations.items():
            if current_time - context["last_updated"] > max_age_minutes * 60:
                sessions_to_remove.append(session_id)
                
        for session_id in sessions_to_remove:
            del self.conversations[session_id]
            
        return len(sessions_to_remove)


# Initialize a global instance of ConversationHandler
conversation_handler = ConversationHandler()

# New constants for SQL explanation model
EXPLANATION_MODEL_NAME = os.environ.get("EXPLANATION_MODEL_NAME", "codellama:7b-instruct-q4_0")
EXPLANATION_TEMPERATURE = float(os.environ.get("EXPLANATION_TEMPERATURE", 0.2))
EXPLANATION_MAX_TOKENS = int(os.environ.get("EXPLANATION_MAX_TOKENS", 2048))

# SQL Explanation and Follow-up (CodeLlama-7B-instruct-q4_0)
def explain_sql_query(session_id, query=None, database_type="postgres", question=None):
    """
    Generate an explanation for an SQL query or answer a follow-up question.
    
    Args:
        session_id (str): Unique identifier for the conversation
        query (str): SQL query to explain (optional if in existing conversation)
        database_type (str): Type of database (postgres, mysql, trino)
        question (str): Follow-up question (optional)
        
    Returns:
        str: Explanation or answer to follow-up question
    """
    # If query is provided, reset conversation
    if query:
        conversation_handler.create_or_reset_conversation(session_id, query, database_type)
    
    # Get conversation context
    context = conversation_handler.get_conversation_context(session_id)
    if not context:
        if not query:
            raise Exception("No active conversation found and no query provided")
        conversation_handler.create_or_reset_conversation(session_id, query, database_type)
        
    # Build prompt with conversation history
    prompt = conversation_handler.get_prompt_with_history(session_id, question)
    
    # Generate explanation
    response = model_handler.generate_response(
        prompt,
        EXPLANATION_MODEL_NAME,
        max_tokens=EXPLANATION_MAX_TOKENS,
        temperature=EXPLANATION_TEMPERATURE
    )
    
    # Add to conversation history
    if question:
        conversation_handler.add_message(session_id, "user", question)
    conversation_handler.add_message(session_id, "assistant", response)
    
    return response




# Schema Generation (Mistral-7B)
def generate_schema(prompt):
    return model_handler.generate_response(
        prompt,
        SCHEMA_MODEL_NAME,  
        max_tokens=2048,
        temperature=0.3
    )


# Query Generation (SQLCoder-7B)
# In model_handler.py

# Update the generate_query function to use Meta-Llama-3
def generate_query(prompt):
    """
    Generate SQL query using Meta-Llama-3 via Akash API
    """
    try:
        # Generate the prompt with specific instructions
        enhanced_prompt = (
            f"You are a SQL expert. Generate a SQL query for the following request:\n\n"
            f"{prompt}\n\n"
            f"Important Instructions:\n"
            f"1. Use the correct SQL dialect for the specified database type\n"
            f"2. Include all necessary built-in functions\n"
            f"3. Ensure proper syntax for the database type\n"
            f"4. Return only the SQL query wrapped in ```sql ``` markers\n"
        )
        
        response = model_handler.generate_response(
            enhanced_prompt,
            QUERY_MODEL_NAME,  # Using Meta-Llama-3
            max_tokens=1024,
            temperature=0.1
        )
        
        # Extract SQL from the response
        sql_query = extract_sql_query(response)
        return sql_query
        
    except Exception as e:
        logger.error(f"Error generating query: {str(e)}")
        raise

# General Text Generation (Mistral-7B)
def generate_text(prompt):
    return model_handler.generate_response(
        prompt,
        SCHEMA_MODEL_NAME,
        max_tokens=MAX_TOKENS,
        temperature=TEMPERATURE
    )

def extract_sql_query(response_text):
    """
    Extract SQL query from the model's response text.
    This function attempts to find and extract the SQL query from the text response.
    
    Args:
        response_text (str): The raw text response from the model
        
    Returns:
        str: The extracted SQL query
    """
    # First, try to extract SQL between ```sql and ``` markers if they exist
    sql_pattern = re.compile(r'```(?:sql)?\s*(.*?)\s*```', re.DOTALL)
    match = sql_pattern.search(response_text)
    
    if match:
        return match.group(1).strip()
    
    # If no SQL code blocks, try to extract between SELECT and semicolon
    # This regex looks for common SQL statement starts and captures until a semicolon
    sql_starts = r'(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)'
    query_pattern = re.compile(f'{sql_starts}.*?;', re.DOTALL | re.IGNORECASE)
    match = query_pattern.search(response_text)
    
    if match:
        return match.group(0).strip()
    
    # If no clear patterns match, return the raw response
    return response_text.strip()

# Validate SQL Syntax
def validate_sql_syntax(sql_query):
    sql_lower = sql_query.lower().strip()
    valid_starts = ('select', 'insert', 'update', 'delete', 'create', 'alter', 'drop')

    if not sql_lower.startswith(valid_starts):
        return False, "Invalid SQL command"

    if sql_query.count('(') != sql_query.count(')'):
        return False, "Unbalanced parentheses"

    if not sql_lower.endswith(';'):
        return False, "Query should end with a semicolon"

    return True, "" 
