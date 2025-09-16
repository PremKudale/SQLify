import os
import logging
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import re
from logging_config import setup_logger
from model_handler import conversation_handler
import json
import requests

# Load environment variables
load_dotenv()

# Import model_handler after environment variables are loaded
import model_handler

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Setup logger
logger = setup_logger('app_logger')

# Define supported database types
SUPPORTED_DB_TYPES = ["mysql", "postgres", "trino"]

# Database-specific function dictionaries
DB_FUNCTIONS = {
    "mysql": {
        "string_concat": "CONCAT",
        "current_timestamp": "NOW()",
        "limit_offset": "LIMIT {limit} OFFSET {offset}",
        "string_agg": "GROUP_CONCAT",
        "date_format": "DATE_FORMAT"
    },
    "postgres": {
        "string_concat": "CONCAT",
        "current_timestamp": "CURRENT_TIMESTAMP",
        "limit_offset": "LIMIT {limit} OFFSET {offset}",
        "string_agg": "STRING_AGG",
        "date_format": "TO_CHAR"
    },
    "trino": {
        "string_concat": "CONCAT",
        "current_timestamp": "CURRENT_TIMESTAMP",
        "limit_offset": "LIMIT {limit} OFFSET {offset}",
        "string_agg": "LISTAGG",
        "date_format": "DATE_FORMAT"
    }
}

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify the service is running."""
    # Check if Ollama API is accessible
    try:
        models_available = []
        if model_handler.model_handler.is_model_available(model_handler.SCHEMA_MODEL_NAME):
            models_available.append(model_handler.SCHEMA_MODEL_NAME)
        if model_handler.model_handler.is_model_available(model_handler.QUERY_MODEL_NAME):
            models_available.append(model_handler.QUERY_MODEL_NAME)
            
        return jsonify({
            "status": "healthy", 
            "ollama_api": "connected",
            "gpu_available": model_handler.model_handler.is_gpu_available(),
            "available_memory_mb": model_handler.model_handler.get_available_memory(),
            "available_models": models_available,
            "current_model": model_handler.model_handler.current_model,
            "supported_db_types": SUPPORTED_DB_TYPES
        }), 200
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            "status": "unhealthy", 
            "error": str(e)
        }), 500

@app.route('/generate-schema', methods=['POST'])
def generate_schema():
    """Endpoint to generate database schema based on input prompt."""
    start_time = time.time()
    
    try:
        data = request.get_json()
        
        if not data:
            logger.error("No JSON data provided")
            return jsonify({"status": "error", "message": "No data provided"}), 400
        
        input_prompt = data.get('prompt')
        output_format = data.get('output_format', 'json')
        
        if not input_prompt:
            logger.error("No input prompt provided")
            return jsonify({"status": "error", "message": "Input prompt is required"}), 400
            
        enhanced_prompt = (
            f"Generate a database schema based on: {input_prompt}\n"
            f"Return in PROPER JSON format (with double quotes) with tables, columns, "
            f"data types, primary keys, foreign keys, and constraints.\n"
            f"Format must be:\n```json\n{{\"tables\": [{{\"name\": \"table_name\", \"columns\": [{{\"name\": \"column_name\", \"data_type\": \"type\", \"primary_key\": boolean, \"foreign_key\": {{\"table\": \"ref_table\", \"column\": \"ref_column\"}}, \"unique\": boolean, \"default\": value}}]}}]}}\n```"
        )
        
        logger.info(f"Processing schema generation: {input_prompt[:50]}...")
        
        # Get the raw response from model handler
        raw_response = model_handler.generate_schema(enhanced_prompt)
        logger.debug(f"Raw model response: {raw_response}")
        
        # Process the response
        elapsed_time = time.time() - start_time
        json_schema = extract_json_schema(raw_response)
        
        if json_schema:
            formatted_output = format_schema_for_display(json_schema)
            return jsonify({
                "status": "success",
                "schema": json_schema,
                "formatted_output": formatted_output,
                "execution_time_seconds": round(elapsed_time, 2)
            }), 200
        else:
            logger.error(f"Failed to parse schema. Raw response: {raw_response}")
            return jsonify({
                "status": "error",
                "message": "Failed to parse schema response. The schema must include 'tables' array with each table having 'name' and 'columns', and each column must have at least 'name' and 'data_type'.",
                "raw_response": raw_response,
                "execution_time_seconds": round(elapsed_time, 2)
            }), 400
            
    except Exception as e:
        elapsed_time = time.time() - start_time
        logger.exception(f"Error in generate_schema: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "execution_time_seconds": round(elapsed_time, 2)
        }), 500

SECONDARY_SERVICE_URL = os.environ.get("SECONDARY_SERVICE_URL", "http://localhost:5002")

@app.route('/generate-query', methods=['POST'])
def generate_query():
    """Enhanced endpoint with automatic schema detection"""
    """
    Endpoint to generate SQL queries based on input prompt and database type.
    
    Expected JSON input:
    {
        "prompt": "Find all users who registered in the last month",
        "database_type": "postgres",
        "schema": "Optional schema definition to use as context"
    }
    """
    start_time = time.time()
    
    try:
        data = request.get_json()
        
        if not data:
            logger.error("No JSON data provided")
            return jsonify({"status": "error", "message": "No data provided"}), 400
        
        input_prompt = data.get('prompt')
        database_type = data.get('database_type', 'postgres').lower()
        schema_context = data.get('schema', '')
        
        # Auto-fetch schema if not provided and connected
        auto_schema_used = False
        if not schema_context:
            try:
                # Check connection status
                status_resp = requests.get(f"{SECONDARY_SERVICE_URL}/connection-status")
                if status_resp.status_code == 200 and status_resp.json().get("is_connected"):
                    schema_resp = requests.get(f"{SECONDARY_SERVICE_URL}/get-full-schema")
                    if schema_resp.status_code == 200:
                        schema_context = schema_resp.json().get("tables", [])
                        database_type = status_resp.json().get("dbType", database_type)
                        auto_schema_used = True
                        logger.info(f"Auto-fetched schema with {len(schema_context)} tables")
            except Exception as e:
                logger.warning(f"Schema auto-fetch failed: {str(e)}")

        # Original prompt enhancement logic
        db_functions = generate_db_function_reference(database_type)
        
        enhanced_prompt = (
            f"### Task\nGenerate a {database_type.upper()} SQL query for:\n{input_prompt}\n\n"
            f"### Database Type\n{database_type.upper()}\n\n"
        )
        
        if schema_context:
            enhanced_prompt += f"### Database Schema\n{json.dumps(schema_context, indent=2)}\n\n"
            
        enhanced_prompt += (
            f"### Important Instructions\n"
            f"1. Use proper {database_type.upper()} syntax\n"
            f"2. Include all necessary built-in functions\n"
            f"3. Return only the SQL query wrapped in ```sql ```\n\n"
            f"### Function Reference\n{db_functions}\n\n"
            f"### SQL Query\n"
        )
        
        # Original query generation logic
        logger.info(f"Generating query for {database_type}")
        sql_query = model_handler.generate_query(enhanced_prompt)
        
        # Original validation logic
        is_valid, error_message = validate_sql_syntax(sql_query, database_type)
        
        elapsed_time = time.time() - start_time
        
        return jsonify({
            "status": "success",
            "query": sql_query,
            "database_type": database_type,
            "is_valid": is_valid,
            "validation_message": error_message if not is_valid else "Valid query",
            "auto_schema_used": auto_schema_used,
            "execution_time_seconds": round(elapsed_time, 2)
        }), 200
        
    except Exception as e:
        elapsed_time = time.time() - start_time
        logger.exception(f"Error in generate_query: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "execution_time_seconds": round(elapsed_time, 2)
        }), 500

@app.route('/generate-schema-sql', methods=['POST'])
def generate_schema_sql():
    """Endpoint to convert schema JSON to SQL CREATE TABLE statements."""
    try:
        data = request.get_json()
        
        if not data or 'schema' not in data:
            return jsonify({"status": "error", "message": "Schema data is required"}), 400
            
        schema = data['schema']
        
        if not schema or 'tables' not in schema or not schema['tables']:
            return jsonify({"status": "error", "message": "Invalid schema format or empty schema"}), 400
        
        sql = schema_to_sql(schema)
        
        return jsonify({
            "status": "success",
            "sql": sql
        }), 200
            
    except Exception as e:
        logger.exception(f"Error in generate_schema_sql: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/generate-schema-json', methods=['POST'])
def generate_schema_json():
    """Endpoint to convert schema JSON to the requested JSON format."""
    try:
        data = request.get_json()
        
        if not data or 'schema' not in data:
            return jsonify({"status": "error", "message": "Schema data is required"}), 400
            
        schema = data['schema']
        table_name = data.get('tableName')
        
        if not schema or 'tables' not in schema or not schema['tables']:
            return jsonify({"status": "error", "message": "Invalid schema format or empty schema"}), 400
        
        # If no table name specified, use the first table
        if not table_name:
            table_name = schema['tables'][0]['name']
        
        # Find the requested table
        target_table = None
        for table in schema['tables']:
            if table['name'] == table_name:
                target_table = table
                break
        
        if not target_table:
            return jsonify({"status": "error", "message": f"Table '{table_name}' not found in schema"}), 400
        
        formatted_json = schema_to_json_format(target_table)
        
        return jsonify({
            "status": "success",
            "json": formatted_json
        }), 200
            
    except Exception as e:
        logger.exception(f"Error in generate_schema_json: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# Helper functions for SQL and JSON conversion

def schema_to_sql(schema):
    """Convert schema JSON to SQL CREATE TABLE statements."""
    sql_statements = []
    
    for table in schema['tables']:
        table_name = table['name']
        columns = []
        primary_keys = []
        foreign_keys = []
        
        for column in table['columns']:
            # Process column definition
            col_def = f"  {column['name']} {column['data_type']}"
            
            # Add NOT NULL if not explicitly nullable
            if column.get('nullable', False) != True:
                col_def += " NOT NULL"
                
            # Add DEFAULT if specified
            if column.get('default') is not None:
                default_value = column['default']
                # Handle string defaults
                if isinstance(default_value, str) and default_value.upper() != 'CURRENT_TIMESTAMP':
                    default_value = f"'{default_value}'"
                col_def += f" DEFAULT {default_value}"
                
            # Add UNIQUE constraint
            if column.get('unique', False) and not column.get('primary_key', False):
                col_def += " UNIQUE"
                
            # Track primary key columns
            if column.get('primary_key', False):
                primary_keys.append(column['name'])
                
                # Check for auto-increment
                if is_auto_increment_type(column['data_type']):
                    if 'serial' not in column['data_type'].lower():
                        col_def += " AUTO_INCREMENT"
            
            columns.append(col_def)
            
            # Track foreign key relationships
            if column.get('foreign_key'):
                fk = column['foreign_key']
                fk_constraint = f"  FOREIGN KEY ({column['name']}) REFERENCES {fk['table']}({fk['column']})"
                foreign_keys.append(fk_constraint)
        
        # Add primary key constraint
        if primary_keys:
            pk_constraint = f"  PRIMARY KEY ({', '.join(primary_keys)})"
            columns.append(pk_constraint)
        
        # Add foreign key constraints
        columns.extend(foreign_keys)
        
        # Assemble the CREATE TABLE statement
        create_statement = f"CREATE TABLE {table_name} (\n"
        create_statement += ",\n".join(columns)
        create_statement += "\n);"
        
        sql_statements.append(create_statement)
    
    return "\n\n".join(sql_statements)

def schema_to_json_format(table):
    """Convert a table schema to the requested JSON format."""
    result = {
        "tableName": table['name'],
        "columns": [],
        "count": 100  # Default value
    }
    
    for column in table['columns']:
        # Map database types to simplified types
        data_type = map_data_type(column['data_type'])
        
        column_obj = {
            "name": column['name'],
            "type": data_type,
            "autoIncrement": is_auto_increment(column)
        }
        
        # Add options if applicable
        options = {}
        
        # Min/max for strings
        if data_type == "string":
            length_match = re.search(r'varchar\((\d+)\)', column['data_type'].lower())
            if length_match:
                options["max"] = int(length_match.group(1))
                options["min"] = 1
        
        # Add unique constraint
        if column.get('unique', False):
            options["unique"] = True
            
        # Add date options
        if data_type == "date" and column.get('default') == "CURRENT_TIMESTAMP":
            options["past"] = True
            
        # Add min/max for numeric types
        if data_type == "int" or data_type == "float":
            # Check for known constraints in the column definition
            # For example logic only - in a real implementation you might parse CHECK constraints
            if "positive" in column.get('description', '').lower():
                options["min"] = 0
        
        if options:
            column_obj["options"] = options
            
        result["columns"].append(column_obj)
    
    return result

def map_data_type(db_type):
    """Map database types to simplified types."""
    db_type = db_type.lower()
    
    if any(t in db_type for t in ['int', 'serial', 'bigint', 'smallint']):
        return "int"
    elif any(t in db_type for t in ['varchar', 'char', 'text', 'string']):
        return "string"
    elif any(t in db_type for t in ['date', 'time', 'timestamp']):
        return "date"
    elif any(t in db_type for t in ['bool', 'boolean', 'tinyint(1)']):
        return "boolean"
    elif any(t in db_type for t in ['float', 'double', 'decimal', 'numeric', 'real']):
        return "float"
    else:
        return "string"  # Default to string for unknown types

def is_auto_increment(column):
    """Determine if a column is auto-incrementing."""
    # Check for primary key and appropriate type
    if column.get('primary_key', False):
        if is_auto_increment_type(column['data_type']):
            return True
    return False

def is_auto_increment_type(data_type):
    """Check if a data type supports auto-increment."""
    data_type = data_type.lower()
    return any(t in data_type for t in ['int', 'serial', 'bigint', 'smallint'])

@app.route('/explain-query', methods=['POST'])
def explain_query():
    """
    Endpoint to explain an SQL query and handle follow-up questions.
    
    Initial request JSON:
    {
        "query": "SELECT * FROM users WHERE created_at > NOW() - INTERVAL '1 month'",
        "database_type": "postgres",
        "session_id": "unique-session-identifier"
    }
    
    Follow-up request JSON:
    {
        "session_id": "unique-session-identifier",
        "question": "How can I add a WHERE clause to filter by user_id?"
    }
    """
    start_time = time.time()
    
    try:
        data = request.get_json()
        
        if not data:
            logger.error("No JSON data provided")
            return jsonify({
                "status": "error",
                "message": "No data provided"
            }), 400
            
        # Extract required fields
        session_id = data.get('session_id')
        query = data.get('query')
        database_type = data.get('database_type', 'postgres').lower()
        question = data.get('question')
        
        if not session_id:
            logger.error("No session_id provided")
            return jsonify({
                "status": "error",
                "message": "session_id is required"
            }), 400
            
        if not query and not question:
            logger.error("Neither query nor question provided")
            return jsonify({
                "status": "error",
                "message": "Either query or question is required"
            }), 400
            
        if database_type not in SUPPORTED_DB_TYPES:
            logger.warning(f"Unsupported database type: {database_type}. Defaulting to postgres.")
            database_type = "postgres"
            
        # Determine if this is an initial explanation or a follow-up
        is_followup = bool(question and not query)
        
        # Generate explanation or answer follow-up
        logger.info(f"Processing {'follow-up' if is_followup else 'initial explanation'} for session {session_id}")
        
        response = model_handler.explain_sql_query(
            session_id=session_id,
            query=query,
            database_type=database_type,
            question=question
        )
        
        elapsed_time = time.time() - start_time
        logger.info(f"Query explanation completed in {elapsed_time:.2f}s")
        
        # Get conversation context for response
        context = model_handler.conversation_handler.get_conversation_context(session_id)
        
        return jsonify({
            "status": "success",
            "response": response,
            "session_id": session_id,
            "database_type": context["database_type"],
            "query": context["query"],
            "history_length": len(context["history"]),
            "is_followup": is_followup,
            "execution_time_seconds": round(elapsed_time, 2)
        }), 200
        
    except Exception as e:
        elapsed_time = time.time() - start_time
        logger.exception(f"Error in explain_query endpoint: {str(e)}")
        
        return jsonify({
            "status": "error",
            "message": str(e),
            "execution_time_seconds": round(elapsed_time, 2)
        }), 500
    
@app.route('/cleanup-conversations', methods=['POST'])
def cleanup_conversations():
    """
    Endpoint to clean up old conversations.
    
    Expected JSON input:
    {
        "max_age_minutes": 30
    }
    """
    try:
        data = request.get_json()
        max_age_minutes = data.get('max_age_minutes', 30) if data else 30
        
        # Clean up old conversations
        removed_count = model_handler.conversation_handler.cleanup_old_conversations(max_age_minutes)
        
        return jsonify({
            "status": "success",
            "message": f"Removed {removed_count} old conversations",
            "active_conversations": len(model_handler.conversation_handler.conversations)
        }), 200
        
    except Exception as e:
        logger.exception(f"Error cleaning up conversations: {str(e)}")
        
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/nlp-task', methods=['POST'])
def nlp_task():
    """
    Endpoint to process NLP tasks based on input prompt.
    
    Expected JSON input:
    {
        "prompt": "Summarize the following text: [text to summarize]"
    }
    """
    start_time = time.time()
    
    try:
        data = request.get_json()
        
        if not data:
            logger.error("No JSON data provided")
            return jsonify({
                "status": "error",
                "message": "No data provided"
            }), 400
        
        input_prompt = data.get('prompt')
        
        if not input_prompt:
            logger.error("No input prompt provided")
            return jsonify({
                "status": "error",
                "message": "Input prompt is required"
            }), 400
            
        logger.info(f"Processing NLP task request: {input_prompt[:50]}...")
        
        # Send to model handler
        response = model_handler.generate_text(input_prompt)
        
        elapsed_time = time.time() - start_time
        logger.info(f"NLP task completed in {elapsed_time:.2f}s")
        
        return jsonify({
            "status": "success",
            "response": response,
            "execution_time_seconds": round(elapsed_time, 2)
        }), 200
        
    except Exception as e:
        elapsed_time = time.time() - start_time
        logger.exception(f"Error in nlp_task endpoint: {str(e)}")
        
        return jsonify({
            "status": "error",
            "message": str(e),
            "execution_time_seconds": round(elapsed_time, 2)
        }), 500

@app.route('/models/status', methods=['GET'])
def model_status():
    """
    Endpoint to check the status of available models.
    """
    try:
        available_models = []
        
        # Check which models are available
        schema_model_available = model_handler.model_handler.is_model_available(model_handler.SCHEMA_MODEL_NAME)
        query_model_available = model_handler.model_handler.is_model_available(model_handler.QUERY_MODEL_NAME)
        
        if schema_model_available:
            available_models.append(model_handler.SCHEMA_MODEL_NAME)
        if query_model_available:
            available_models.append(model_handler.QUERY_MODEL_NAME)
            
        return jsonify({
            "status": "success",
            "current_model": model_handler.model_handler.current_model,
            "available_models": available_models,
            "gpu_available": model_handler.model_handler.is_gpu_available(),
            "available_memory_mb": model_handler.model_handler.get_available_memory(),
            "supported_db_types": SUPPORTED_DB_TYPES
        }), 200
        
    except Exception as e:
        logger.exception(f"Error checking model status: {str(e)}")
        
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/models/load', methods=['POST'])
def load_model():
    """
    Endpoint to explicitly load a specific model.
    
    Expected JSON input:
    {
        "model_name": "mistral:7b-instruct"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            logger.error("No JSON data provided")
            return jsonify({
                "status": "error",
                "message": "No data provided"
            }), 400
            
        model_name = data.get('model_name')
        
        if not model_name:
            logger.error("No model name provided")
            return jsonify({
                "status": "error",
                "message": "Model name is required"
            }), 400
            
        # Load the model
        if model_handler.model_handler.load_model(model_name):
            return jsonify({
                "status": "success",
                "message": f"Model {model_name} loaded successfully",
                "current_model": model_handler.model_handler.current_model
            }), 200
        else:
            return jsonify({
                "status": "error",
                "message": f"Failed to load model {model_name}"
            }), 500
            
    except Exception as e:
        logger.exception(f"Error loading model: {str(e)}")
        
        return jsonify({
            "status": "error", 
            "message": str(e)
        }), 500

@app.route('/models/unload', methods=['POST'])
def unload_model():
    """
    Endpoint to explicitly unload the current model by restarting Ollama.
    """
    try:
        if model_handler.model_handler.current_model:
            current_model = model_handler.model_handler.current_model
            
            # Attempt to unload using the new restart-based method
            if model_handler.model_handler.unload_model():
                return jsonify({
                    "status": "success",
                    "message": f"Model {current_model} unloaded successfully"
                }), 200
            else:
                return jsonify({
                    "status": "error",
                    "message": f"Failed to unload model {current_model}"
                }), 500
        else:
            return jsonify({
                "status": "success",
                "message": "No model currently loaded"
            }), 200
            
    except Exception as e:
        logger.exception(f"Error unloading model: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Error unloading model: {str(e)}"
        }), 500

@app.route('/supported-functions', methods=['GET'])
def supported_functions():
    """
    Endpoint to get a list of all supported SQL functions per database type.
    """
    try:
        database_type = request.args.get('database_type', 'all').lower()
        
        functions_by_category = {
            "aggregate": ["AVG", "SUM", "COUNT", "MIN", "MAX", "GROUP_CONCAT"],
            "mathematical": ["ROUND", "FLOOR", "CEIL", "ABS", "MOD", "POWER", "EXP", "SQRT", "LOG", "RAND", "SIGN", "TRUNCATE"],
            "string": ["CONCAT", "SUBSTRING", "LENGTH", "UPPER", "LOWER", "TRIM", "LTRIM", "RTRIM", "REPLACE", "LOCATE", "LEFT", "RIGHT", "REPEAT", "REVERSE"],
            "date_time": ["NOW", "CURDATE", "CURTIME", "YEAR", "MONTH", "DAY", "HOUR", "MINUTE", "SECOND", "TIMESTAMPDIFF", "DATE_FORMAT", "ADDDATE", "SUBDATE", "DATEDIFF", "DAYOFWEEK", "WEEK", "WEEKDAY", "LAST_DAY"],
            "conditional": ["IF", "IFNULL", "NULLIF", "COALESCE", "CASE WHEN"],
            "type_conversion": ["CAST", "CONVERT"],
            "grouping_ordering": ["GROUP BY", "ORDER BY", "DISTINCT", "HAVING", "LIMIT", "OFFSET"],
            "joins_unions": ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL JOIN", "UNION", "UNION ALL"],
            "window": ["ROW_NUMBER", "RANK", "DENSE_RANK", "LAG", "LEAD", "NTILE", "FIRST_VALUE", "LAST_VALUE", "PERCENT_RANK"],
            "logical": ["AND", "OR", "NOT", "BETWEEN", "IN", "LIKE", "EXISTS", "ANY", "ALL"]
        }
        
        # Database-specific function differences
        db_specific_functions = {
            "mysql": {
                "string_agg": "GROUP_CONCAT",
                "date_format": "DATE_FORMAT"
            },
            "postgres": {
                "string_agg": "STRING_AGG",
                "date_format": "TO_CHAR" 
            },
            "trino": {
                "string_agg": "LISTAGG",
                "date_format": "DATE_FORMAT"
            }
        }
        
        if database_type == 'all':
            return jsonify({
                "status": "success",
                "supported_functions": {
                    "common": functions_by_category,
                    "database_specific": db_specific_functions
                }
            }), 200
        elif database_type in SUPPORTED_DB_TYPES:
            # Merge common functions with database-specific ones
            db_functions = functions_by_category.copy()
            for category, functions in db_functions.items():
                # Replace any database-specific function variations
                for i, func in enumerate(functions):
                    if func in db_specific_functions.get(database_type, {}):
                        db_functions[category][i] = db_specific_functions[database_type][func]
                        
            return jsonify({
                "status": "success",
                "database_type": database_type,
                "supported_functions": db_functions
            }), 200
        else:
            return jsonify({
                "status": "error",
                "message": f"Unsupported database type: {database_type}. Available types are: {', '.join(SUPPORTED_DB_TYPES)}"
            }), 400
    except Exception as e:
        logger.exception(f"Error getting supported functions: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

def generate_db_function_reference(database_type):
    """
    Generate a reference guide for supported functions based on database type.
    
    Args:
        database_type (str): The database type (mysql, postgres, trino)
        
    Returns:
        str: Function reference guide text
    """
    # Common functions across all databases
    common_functions = {
        "Aggregate Functions": "AVG, SUM, COUNT, MIN, MAX",
        "Mathematical Functions": "ROUND, FLOOR, CEIL, ABS, MOD, POWER, EXP, SQRT, LOG",
        "String Functions": "SUBSTRING, LENGTH, UPPER, LOWER, TRIM, REPLACE",
        "Date and Time Functions": "YEAR, MONTH, DAY, HOUR, MINUTE, SECOND",
        "Conditional Functions": "CASE WHEN, COALESCE, NULLIF",
        "Type Conversion": "CAST",
        "Window Functions": "ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD"
    }
    
    # Database-specific function variations
    db_specific = {
        "mysql": {
            "String Aggregation": "GROUP_CONCAT(expression [ORDER BY column] [SEPARATOR separator])",
            "Date Format": "DATE_FORMAT(date, format_string)",
            "String Concat": "CONCAT(str1, str2, ...)",
            "Current Timestamp": "NOW()",
            "Type Casting": "CAST(expression AS type) or CONVERT(expression, type)",
            "JSON Functions": "JSON_EXTRACT, JSON_OBJECT, JSON_ARRAY",
            "Full Text Search": "MATCH() AGAINST()"
        },
        "postgres": {
            "String Aggregation": "STRING_AGG(expression, delimiter [ORDER BY columns])",
            "Date Format": "TO_CHAR(date, format_string)",
            "String Concat": "CONCAT(str1, str2, ...) or str1 || str2",
            "Current Timestamp": "CURRENT_TIMESTAMP",
            "Type Casting": "CAST(expression AS type) or expression::type",
            "JSON Functions": "jsonb_extract_path, jsonb_build_object",
            "Text Search": "to_tsvector, to_tsquery"
        },
        "trino": {
            "String Aggregation": "LISTAGG(expression, delimiter)",
            "Date Format": "DATE_FORMAT(date, format_string)",
            "String Concat": "CONCAT(str1, str2, ...) or str1 || str2",
            "Current Timestamp": "CURRENT_TIMESTAMP",
            "Type Casting": "CAST(expression AS type)",
            "JSON Functions": "JSON_EXTRACT, JSON_PARSE, JSON_FORMAT",
            "Array Functions": "ARRAY_JOIN, ARRAY_CONTAINS, ARRAY_POSITION"
        }
    }
    
    # Build the function reference text
    reference_text = f"# {database_type.upper()} SQL Function Reference\n\n"
    
    # Add common functions
    for category, functions in common_functions.items():
        reference_text += f"## {category}\n{functions}\n\n"
    
    # Add database-specific functions
    for category, syntax in db_specific.get(database_type, {}).items():
        reference_text += f"## {category} (Database-specific)\n{syntax}\n\n"
    
    # Add tips for specific database type
    if database_type == "mysql":
        reference_text += "## MySQL Tips\n"
        reference_text += "- Use backticks (``) for table and column names\n"
        reference_text += "- LIMIT clause comes at the end of the query\n"
        reference_text += "- Use NULL-safe equality operator (<=>) for NULL comparisons\n"
    elif database_type == "postgres":
        reference_text += "## PostgreSQL Tips\n"
        reference_text += "- Use double quotes (\"\") for case-sensitive identifiers\n"
        reference_text += "- Use ILIKE for case-insensitive pattern matching\n"
        reference_text += "- RETURNING clause can be used with INSERT/UPDATE/DELETE\n"
    elif database_type == "trino":
        reference_text += "## Trino Tips\n"
        reference_text += "- Use catalogs and schemas to refer to tables (catalog.schema.table)\n"
        reference_text += "- UNNEST can be used to flatten arrays into rows\n"
        reference_text += "- WITH ORDINALITY can be used to add ordinal positions\n"
    
    return reference_text

def extract_json_schema(response_text):
    """Extract and validate JSON schema from the model's response text"""
    try:
        schema = None
        
        # Handle case where response is already a dictionary
        if isinstance(response_text, dict):
            schema = response_text
            
        # Handle case where response is a string
        elif isinstance(response_text, str):
            # Clean the response text first
            cleaned = response_text.strip()
            
            # Try to parse directly if it looks like JSON
            if (cleaned.startswith('{') and cleaned.endswith('}')) or \
               (cleaned.startswith('[') and cleaned.endswith(']')):
                try:
                    schema = json.loads(cleaned)
                except json.JSONDecodeError:
                    pass  # Try other methods
                    
            # Handle markdown-wrapped JSON
            if schema is None and '```json' in cleaned:
                json_start = cleaned.find('```json') + len('```json')
                json_end = cleaned.find('```', json_start)
                json_str = cleaned[json_start:json_end].strip()
                schema = json.loads(json_str)
            elif schema is None and '```' in cleaned:
                # Try generic code block extraction
                json_start = cleaned.find('```') + len('```')
                json_end = cleaned.find('```', json_start)
                json_str = cleaned[json_start:json_end].strip()
                try:
                    schema = json.loads(json_str)
                except json.JSONDecodeError:
                    pass

        # Validate the schema structure
        if schema and isinstance(schema, dict) and "tables" in schema:
            # Ensure each table has required fields
            for table in schema["tables"]:
                if not all(key in table for key in ["name", "columns"]):
                    return None
                
                # Ensure each column has at least name and type
                for column in table["columns"]:
                    if not all(key in column for key in ["name", "data_type"]):
                        return None
                        
            return schema
            
        return None
    except Exception as e:
        logger.error(f"Error extracting JSON schema: {str(e)}")
        return None

# In your Flask backend (generate-schema endpoint)
def format_schema_for_display(schema):
    """Convert the schema JSON to well-formatted markdown"""
    markdown = ["# Database Schema\n"]
    
    for table in schema.get('tables', []):
        markdown.append(f"## Table: `{table['name']}`\n")
        
        # Create table header
        markdown.append("| Column Name | Data Type | Constraints |")
        markdown.append("|-------------|-----------|-------------|")
        
        for column in table.get('columns', []):
            constraints = []
            if column.get('primary_key'):
                constraints.append("PK")
            if column.get('foreign_key'):
                fk = column['foreign_key']
                constraints.append(f"FK → {fk['table']}.{fk['column']}")
            if column.get('unique'):
                constraints.append("Unique")
            if column.get('default') is not None:
                constraints.append(f"Default: {column['default']}")
                
            markdown.append(
                f"| `{column['name']}` | `{column['data_type']}` | {', '.join(constraints)} |"
            )
        
        markdown.append("\n")  # Add space between tables
    
    return "\n".join(markdown)


def extract_sql_query(response):
    """
    Extract SQL query from the model's response.
    This function attempts to find and extract the SQL query from the text response.
    
    Args:
        response (str): The raw text response from the model
        
    Returns:
        str: The extracted SQL query
    """
    # First, try to extract SQL between ```sql and ``` markers if they exist
    sql_pattern = re.compile(r'```(?:sql)?\s*(.*?)\s*```', re.DOTALL)
    match = sql_pattern.search(response)
    
    if match:
        return match.group(1).strip()
    
    # If no SQL code blocks, try to extract between SELECT and semicolon
    # This regex looks for common SQL statement starts and captures until a semicolon
    sql_starts = r'(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)'
    query_pattern = re.compile(f'{sql_starts}.*?;', re.DOTALL | re.IGNORECASE)
    match = query_pattern.search(response)
    
    if match:
        return match.group(0).strip()
    
    # If no clear patterns match, return the raw response
    return response.strip()

def validate_sql_syntax(sql_query, database_type="postgres"):
    """
    Validate SQL syntax based on database type.
    
    Args:
        sql_query (str): The SQL query to validate
        database_type (str): The database type (mysql, postgres, trino)
        
    Returns:
        tuple: (is_valid, error_message)
    """
    sql_lower = sql_query.lower().strip()
    valid_starts = ('select', 'insert', 'update', 'delete', 'create', 'alter', 'drop', 'with')
    
    # Check if query starts with a valid SQL command
    if not any(sql_lower.startswith(start) for start in valid_starts):
        return False, "Invalid SQL command"
    
    # Check for balanced parentheses
    if sql_query.count('(') != sql_query.count(')'):
        return False, "Unbalanced parentheses"
    
    # Check if query ends with a semicolon
    if not sql_lower.endswith(';'):
        return False, "Query should end with a semicolon"
    
    # Database-specific validation
    if database_type == "mysql":
        # Check for proper backtick usage (if any used)
        if '`' in sql_query and sql_query.count('`') % 2 != 0:
            return False, "Unbalanced backticks in MySQL query"
            
    elif database_type == "postgres":
        # Check for proper double quote usage (if any used)
        if '"' in sql_query and sql_query.count('"') % 2 != 0:
            return False, "Unbalanced double quotes in PostgreSQL query"
            
    elif database_type == "trino":
        # Check for common Trino syntax patterns
        if 'catalog.' in sql_lower and not re.search(r'[a-z0-9_]+\.[a-z0-9_]+\.[a-z0-9_]+', sql_lower):
            return False, "Invalid catalog.schema.table format in Trino query"
    
    # Check for common SQL injection patterns
    if any(pattern in sql_lower for pattern in ["--", "/*", "*/"]):
        return False, "Possible SQL injection detected (comment markers)"
    
    # Additional checks could be added for specific functions per database
        
    return True, ""

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug_mode = os.environ.get("FLASK_DEBUG", "False").lower() == "true"
    
    # Log system information
    logger.info(f"Starting Flask server on port {port}, debug mode: {debug_mode}")
    logger.info(f"Supported database types: {', '.join(SUPPORTED_DB_TYPES)}")
    
    if model_handler.model_handler.is_gpu_available():
        logger.info("GPU is available for model execution")
    else:
        logger.info("GPU is not available, using CPU for model execution")
        
    logger.info(f"Available memory: {model_handler.model_handler.get_available_memory()} MB")
    
    # Check if models are available
    schema_model_available = model_handler.model_handler.is_model_available(model_handler.SCHEMA_MODEL_NAME)
    query_model_available = model_handler.model_handler.is_model_available(model_handler.QUERY_MODEL_NAME)
    
    logger.info(f"Schema model {model_handler.SCHEMA_MODEL_NAME} available: {schema_model_available}")
    logger.info(f"Query model {model_handler.QUERY_MODEL_NAME} available: {query_model_available}")
    
    app.run(host="0.0.0.0", port=port, debug=debug_mode)