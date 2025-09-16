from flask import Flask, request, jsonify
import mysql.connector
import psycopg2
import pymongo
import sqlite3
import pymssql
import time
from flask_cors import CORS
import os
import uuid
import logging
from dotenv import load_dotenv
import requests

# Import the proper synthetic data generator
from gemini_service import generate_synthetic_data

app = Flask(__name__)
CORS(app)  # Allow frontend to make requests to backend

# Load environment variables if .env exists
try:
    load_dotenv()
except ImportError:
    pass  # dotenv module not installed, continue without it

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Store DB configuration globally 
db_config = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "",
    "port": "",
    "dbType": "mysql"
}

# Keep track of connection status
is_connected = False

@app.route("/connect-db", methods=["POST"])
def connect_db():
    """API to test and store database connection configuration."""
    global db_config, is_connected
    
    # Get connection details from request
    connection_data = request.json
    
    if not all(key in connection_data for key in ["host", "user", "dbType"]):
        return jsonify({"error": "Missing connection parameters"}), 400
    
    # Store the DB type
    db_type = connection_data.get("dbType", "mysql")
    
    # Create a clean copy of connection data
    connection_data_clean = {k: v for k, v in connection_data.items() 
                             if k in ["host", "user", "password", "database", "port"]}
    
    # Remove empty values
    connection_data_clean = {k: v for k, v in connection_data_clean.items() if v}
    
    # Handle port conversion
    if "port" in connection_data_clean and connection_data_clean["port"]:
        try:
            connection_data_clean["port"] = int(connection_data_clean["port"])
        except ValueError:
            return jsonify({"error": "Port must be a number"}), 400
    
    # Test the connection based on DB type
    try:
        conn = None
        
        if db_type == "mysql" or db_type == "mariadb":
            conn = mysql.connector.connect(**connection_data_clean)
        elif db_type == "postgresql" or db_type == "postgres":
            conn = psycopg2.connect(**connection_data_clean)
        elif db_type == "mongodb":
            client = pymongo.MongoClient(
                host=connection_data_clean.get("host", "localhost"),
                port=connection_data_clean.get("port", 27017),
                username=connection_data_clean.get("user"),
                password=connection_data_clean.get("password")
            )
            # Test connection by listing databases
            client.list_database_names()
            conn = client  # Just to indicate success
        elif db_type == "sqlite":
            # For SQLite, database is the path to the file
            db_path = connection_data_clean.get("database", ":memory:")
            conn = sqlite3.connect(db_path)
        elif db_type == "sqlserver":
            conn = pymssql.connect(
                server=connection_data_clean.get("host"),
                user=connection_data_clean.get("user"),
                password=connection_data_clean.get("password"),
                database=connection_data_clean.get("database")
            )
        else:
            return jsonify({"error": f"Unsupported database type: {db_type}"}), 400
        
        # If we got here, connection succeeded
        if conn and db_type != "mongodb":
            conn.close()
        elif conn:  # MongoDB case
            conn.close()
            
        # Store configuration globally
        db_config = connection_data_clean
        db_config["dbType"] = db_type  # Add DB type to config
        is_connected = True
        
        return jsonify({
            "success": True,
            "message": f"Successfully connected to {connection_data.get('database', '')} database",
            "is_connected": is_connected
        })
    except Exception as err:
        is_connected = False
        return jsonify({"error": str(err)}), 500

@app.route("/connection-status", methods=["GET"])
def connection_status():
    """API to check the current connection status."""
    global is_connected, db_config
    
    return jsonify({
        "is_connected": is_connected,
        "database": db_config.get("database", ""),
        "host": db_config.get("host", ""),
        "user": db_config.get("user", ""),
        "dbType": db_config.get("dbType", "mysql")
    })


@app.route('/get-full-schema', methods=['GET'])
def get_full_schema():
    """Get complete database schema including tables, columns, constraints"""
    global db_config, is_connected
    
    if not is_connected:
        return jsonify({"error": "Database not connected"}), 400

    try:
        start_time = time.time()
        schema = {"tables": []}
        db_type = db_config["dbType"].lower()

        # MySQL/MariaDB implementation
        if db_type in ["mysql", "mariadb"]:
            conn = mysql.connector.connect(**{k: v for k, v in db_config.items() if k != "dbType"})
            cursor = conn.cursor(dictionary=True)
            
            # Get tables
            cursor.execute("SHOW TABLES")
            tables = [table[0] for table in cursor.fetchall()]
            
            for table in tables:
                # Get columns
                cursor.execute(f"SHOW FULL COLUMNS FROM `{table}`")
                columns = cursor.fetchall()
                
                # Get constraints
                cursor.execute(f"""
                    SELECT 
                        COLUMN_NAME,
                        REFERENCED_TABLE_NAME,
                        REFERENCED_COLUMN_NAME
                    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = '{table}'
                    AND REFERENCED_TABLE_NAME IS NOT NULL
                """)
                foreign_keys = cursor.fetchall()
                
                table_schema = {
                    "name": table,
                    "columns": [
                        {
                            "name": col["Field"],
                            "data_type": col["Type"],
                            "nullable": col["Null"] == "YES",
                            "primary_key": col["Key"] == "PRI",
                            "foreign_key": next((
                                {"table": fk[1], "column": fk[2]} 
                                for fk in foreign_keys 
                                if fk[0] == col["Field"]
                            ), None),
                            "default": col["Default"]
                        } for col in columns
                    ]
                }
                schema["tables"].append(table_schema)
            cursor.close()
            conn.close()

        # PostgreSQL implementation
        elif db_type in ["postgres", "postgresql"]:
            conn = psycopg2.connect(**{k: v for k, v in db_config.items() if k != "dbType"})
            cursor = conn.cursor()
            
            # Get tables
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                AND table_type = 'BASE TABLE'
            """)
            tables = [t[0] for t in cursor.fetchall()]
            
            for table in tables:
                # Get columns
                cursor.execute(f"""
                    SELECT 
                        column_name, data_type, is_nullable,
                        column_default, ordinal_position
                    FROM information_schema.columns
                    WHERE table_name = '{table}'
                    ORDER BY ordinal_position
                """)
                columns = cursor.fetchall()
                
                # Get constraints
                cursor.execute(f"""
                    SELECT
                        kcu.column_name,
                        ccu.table_name AS foreign_table,
                        ccu.column_name AS foreign_column
                    FROM information_schema.table_constraints AS tc
                    JOIN information_schema.key_column_usage AS kcu
                        ON tc.constraint_name = kcu.constraint_name
                    JOIN information_schema.constraint_column_usage AS ccu
                        ON ccu.constraint_name = tc.constraint_name
                    WHERE tc.table_name = '{table}'
                    AND tc.constraint_type = 'FOREIGN KEY'
                """)
                foreign_keys = cursor.fetchall()
                
                table_schema = {
                    "name": table,
                    "columns": [
                        {
                            "name": col[0],
                            "data_type": col[1],
                            "nullable": col[2] == "YES",
                            "default": col[3],
                            "foreign_key": next((
                                {"table": fk[1], "column": fk[2]} 
                                for fk in foreign_keys 
                                if fk[0] == col[0]
                            ), None)
                        } for col in columns
                    ]
                }
                schema["tables"].append(table_schema)
            cursor.close()
            conn.close()

        # SQLite implementation
        elif db_type == "sqlite":
            conn = sqlite3.connect(db_config.get("database", ":memory:"))
            cursor = conn.cursor()
            
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [t[0] for t in cursor.fetchall()]
            
            for table in tables:
                cursor.execute(f"PRAGMA table_info('{table}')")
                columns = cursor.fetchall()
                
                cursor.execute(f"PRAGMA foreign_key_list('{table}')")
                foreign_keys = cursor.fetchall()
                
                table_schema = {
                    "name": table,
                    "columns": [
                        {
                            "name": col[1],
                            "data_type": col[2],
                            "nullable": not col[3],
                            "primary_key": col[5] == 1,
                            "foreign_key": next((
                                {"table": fk[2], "column": fk[3]} 
                                for fk in foreign_keys 
                                if fk[3] == col[1]
                            ), None)
                        } for col in columns
                    ]
                }
                schema["tables"].append(table_schema)
            cursor.close()
            conn.close()

        # Add execution metadata
        schema["metadata"] = {
            "execution_time": round(time.time() - start_time, 2),
            "database_type": db_type,
            "table_count": len(schema["tables"])
        }
        
        return jsonify(schema)
    
    except Exception as e:
        logger.error(f"Schema extraction failed: {str(e)}")
        return jsonify({"error": f"Schema extraction failed: {str(e)}"}), 500


@app.route("/execute-sql", methods=["POST"])
def execute_sql():
    """API to execute SQL queries."""
    global db_config, is_connected
    
    if not is_connected:
        return jsonify({"error": "Database not connected. Please connect first."}), 400
    
    data = request.json
    
    if not data or "sqlQuery" not in data:
        return jsonify({"error": "No SQL query provided"}), 400
    
    sql_query = data["sqlQuery"].strip()
    
    if not sql_query:
        return jsonify({"error": "Empty SQL query"}), 400
    
    try:
        db_type = db_config.get("dbType", "mysql")
        
        # Execute query based on database type
        if db_type == "mysql" or db_type == "mariadb":
            return execute_mysql_query(sql_query)
        elif db_type == "postgresql" or db_type == "postgres":
            return execute_postgres_query(sql_query)
        elif db_type == "sqlite":
            return execute_sqlite_query(sql_query)
        elif db_type == "sqlserver":
            return execute_sqlserver_query(sql_query)
        elif db_type == "mongodb":
            return jsonify({"error": "Direct SQL execution not supported for MongoDB"}), 400
        else:
            return jsonify({"error": f"Unsupported database type: {db_type}"}), 400
        
    except Exception as err:
        return jsonify({"error": str(err)}), 500

def execute_mysql_query(sql_query):
    """Execute query for MySQL/MariaDB."""
    conn = mysql.connector.connect(**{k: v for k, v in db_config.items() if k != "dbType"})
    cursor = conn.cursor(dictionary=True)
    
    # Determine query type
    query_type = sql_query.split()[0].upper()
    
    # Execute the query
    cursor.execute(sql_query)
    
    # Handle different query types
    if query_type == "SELECT":
        result = cursor.fetchall()
        message = f"Query executed successfully. Returned {len(result)} rows."
    else:
        # For INSERT, UPDATE, DELETE, etc.
        conn.commit()
        affected_rows = cursor.rowcount
        result = [{"affected_rows": affected_rows}]
        message = f"Query executed successfully. Affected {affected_rows} rows."
    
    cursor.close()
    conn.close()
    
    return jsonify({
        "success": True,
        "message": message,
        "query_type": query_type,
        "result": result
    })

def execute_postgres_query(sql_query):
    """Execute query for PostgreSQL."""
    conn = psycopg2.connect(**{k: v for k, v in db_config.items() if k != "dbType"})
    cursor = conn.cursor()
    
    # Determine query type
    query_type = sql_query.split()[0].upper()
    
    # Execute the query
    cursor.execute(sql_query)
    
    # Handle different query types
    if query_type == "SELECT":
        columns = [desc[0] for desc in cursor.description]
        result = [dict(zip(columns, row)) for row in cursor.fetchall()]
        message = f"Query executed successfully. Returned {len(result)} rows."
    else:
        conn.commit()
        affected_rows = cursor.rowcount
        result = [{"affected_rows": affected_rows}]
        message = f"Query executed successfully. Affected {affected_rows} rows."
    
    cursor.close()
    conn.close()
    
    return jsonify({
        "success": True,
        "message": message,
        "query_type": query_type,
        "result": result
    })

def execute_sqlite_query(sql_query):
    """Execute query for SQLite."""
    conn = sqlite3.connect(db_config.get("database", ":memory:"))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Determine query type
    query_type = sql_query.split()[0].upper()
    
    # Execute the query
    cursor.execute(sql_query)
    
    # Handle different query types
    if query_type == "SELECT":
        rows = cursor.fetchall()
        # Convert sqlite3.Row objects to dictionaries
        result = [dict(row) for row in rows]
        message = f"Query executed successfully. Returned {len(result)} rows."
    else:
        conn.commit()
        affected_rows = cursor.rowcount
        result = [{"affected_rows": affected_rows}]
        message = f"Query executed successfully. Affected {affected_rows} rows."
    
    cursor.close()
    conn.close()
    
    return jsonify({
        "success": True,
        "message": message,
        "query_type": query_type,
        "result": result
    })

def execute_sqlserver_query(sql_query):
    """Execute query for SQL Server."""
    conn = pymssql.connect(
        server=db_config.get("host"),
        user=db_config.get("user"),
        password=db_config.get("password"),
        database=db_config.get("database")
    )
    cursor = conn.cursor(as_dict=True)
    
    # Determine query type
    query_type = sql_query.split()[0].upper()
    
    # Execute the query
    cursor.execute(sql_query)
    
    # Handle different query types
    if query_type == "SELECT":
        result = cursor.fetchall()
        message = f"Query executed successfully. Returned {len(result)} rows."
    else:
        conn.commit()
        affected_rows = cursor.rowcount
        result = [{"affected_rows": affected_rows}]
        message = f"Query executed successfully. Affected {affected_rows} rows."
    
    cursor.close()
    conn.close()
    
    return jsonify({
        "success": True,
        "message": message,
        "query_type": query_type,
        "result": result
    })

@app.route("/get-tables", methods=["GET"])
def get_tables():
    """API to get all tables in the current database."""
    global db_config, is_connected
    
    if not is_connected:
        return jsonify({"error": "Database not connected. Please connect first."}), 400
    
    try:
        db_type = db_config.get("dbType", "mysql")
        tables = []
        
        if db_type == "mysql" or db_type == "mariadb":
            conn = mysql.connector.connect(**{k: v for k, v in db_config.items() if k != "dbType"})
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SHOW TABLES")
            tables_raw = cursor.fetchall()
            tables = [list(table.values())[0] for table in tables_raw]
            cursor.close()
            conn.close()
        elif db_type == "postgresql" or db_type == "postgres":
            conn = psycopg2.connect(**{k: v for k, v in db_config.items() if k != "dbType"})
            cursor = conn.cursor()
            cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
            tables = [table[0] for table in cursor.fetchall()]
            cursor.close()
            conn.close()
        elif db_type == "sqlite":
            conn = sqlite3.connect(db_config.get("database", ":memory:"))
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [table[0] for table in cursor.fetchall()]
            cursor.close()
            conn.close()
        elif db_type == "sqlserver":
            conn = pymssql.connect(
                server=db_config.get("host"),
                user=db_config.get("user"),
                password=db_config.get("password"),
                database=db_config.get("database")
            )
            cursor = conn.cursor()
            cursor.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")
            tables = [table[0] for table in cursor.fetchall()]
            cursor.close()
            conn.close()
        elif db_type == "mongodb":
            client = pymongo.MongoClient(
                host=db_config.get("host", "localhost"),
                port=db_config.get("port", 27017),
                username=db_config.get("user"),
                password=db_config.get("password")
            )
            db_name = db_config.get("database")
            if db_name:
                tables = client[db_name].list_collection_names()
            else:
                tables = []
            client.close()
        
        return jsonify({
            "success": True,
            "tables": tables
        })
    
    except Exception as err:
        return jsonify({"error": str(err)}), 500

@app.route("/generate-data", methods=["POST"])
def generate_data():
    """API to generate synthetic data and insert into database."""
    global db_config, is_connected
    
    if not is_connected:
        return jsonify({"error": "Database not connected. Please connect first."}), 400
    
    try:
        start_time = time.time()
        data = request.json
        
        if not data or 'schema' not in data:
            return jsonify({'error': 'Schema is required'}), 400
        
        schema = data['schema']
        num_rows = schema.get('count', 10)
        table_name = schema.get('tableName', f'synthetic_{uuid.uuid4().hex[:6]}')
        
        # Validate schema format
        if 'columns' not in schema:
            return jsonify({'error': 'Schema must contain a "columns" array'}), 400
        
        for column in schema['columns']:
            if 'name' not in column:
                return jsonify({'error': 'Each column must have a name'}), 400
            if 'type' not in column:
                return jsonify({'error': 'Each column must have a type'}), 400
        
        db_type = db_config.get("dbType", "mysql")
        
        # Create table based on database type
        if db_type == "mysql" or db_type == "mariadb":
            create_table_sql = generate_mysql_create_table_sql(table_name, schema['columns'])
            conn = mysql.connector.connect(**{k: v for k, v in db_config.items() if k != "dbType"})
            cursor = conn.cursor()
            cursor.execute(create_table_sql)
            conn.commit()
        elif db_type == "postgresql" or db_type == "postgres":
            create_table_sql = generate_postgres_create_table_sql(table_name, schema['columns'])
            conn = psycopg2.connect(**{k: v for k, v in db_config.items() if k != "dbType"})
            cursor = conn.cursor()
            cursor.execute(create_table_sql)
            conn.commit()
        elif db_type == "sqlite":
            create_table_sql = generate_sqlite_create_table_sql(table_name, schema['columns'])
            conn = sqlite3.connect(db_config.get("database", ":memory:"))
            cursor = conn.cursor()
            cursor.execute(create_table_sql)
            conn.commit()
        elif db_type == "sqlserver":
            create_table_sql = generate_sqlserver_create_table_sql(table_name, schema['columns'])
            conn = pymssql.connect(
                server=db_config.get("host"),
                user=db_config.get("user"),
                password=db_config.get("password"),
                database=db_config.get("database")
            )
            cursor = conn.cursor()
            cursor.execute(create_table_sql)
            conn.commit()
        elif db_type == "mongodb":
            # For MongoDB, we don't need to create a table/collection beforehand
            client = pymongo.MongoClient(
                host=db_config.get("host", "localhost"),
                port=db_config.get("port", 27017),
                username=db_config.get("user"),
                password=db_config.get("password")
            )
            conn = client
            cursor = None
        else:
            return jsonify({"error": f"Unsupported database type: {db_type}"}), 400
        
        # Generate synthetic data using the imported function
        try:
            # Use gemini_service to generate data
            records = generate_synthetic_data(schema['columns'], num_rows)
            logger.info(f"Generated {len(records)} records")
        except Exception as e:
            logger.error(f"Error generating data: {str(e)}")
            # Fall back to simple generator if Gemini fails
            records = simple_generate_synthetic_data(schema['columns'], num_rows)
            logger.info(f"Fell back to simple generator, created {len(records)} records")
        
        # Insert data into table/collection
        inserted_count = 0
        
        if db_type == "mongodb":
            # MongoDB insertion
            db_name = db_config.get("database")
            if not db_name:
                return jsonify({'error': 'Database name required for MongoDB'}), 400
                
            db = conn[db_name]
            collection = db[table_name]
            
            if records:
                result = collection.insert_many(records)
                inserted_count = len(result.inserted_ids)
            
            client.close()
        else:
            # SQL database insertion
            for record in records:
                # Skip auto increment columns
                filtered_record = {k: v for k, v in record.items() 
                                if not any(col.get("autoIncrement", False) and col["name"] == k 
                                           for col in schema['columns'])}
                
                if not filtered_record:  # Skip if all columns were filtered out
                    continue
                    
                columns = list(filtered_record.keys())
                values = list(filtered_record.values())
                
                if db_type == "mysql" or db_type == "mariadb":
                    placeholders = ', '.join(['%s'] * len(filtered_record))
                    columns_str = ', '.join(f"`{col}`" for col in columns)
                    insert_sql = f"INSERT INTO `{table_name}` ({columns_str}) VALUES ({placeholders})"
                elif db_type == "postgresql" or db_type == "postgres":
                    placeholders = ', '.join(['%s'] * len(filtered_record))
                    columns_str = ', '.join(f"\"{col}\"" for col in columns)
                    insert_sql = f"INSERT INTO \"{table_name}\" ({columns_str}) VALUES ({placeholders})"
                elif db_type == "sqlite":
                    placeholders = ', '.join(['?'] * len(filtered_record))
                    columns_str = ', '.join(f"\"{col}\"" for col in columns)
                    insert_sql = f"INSERT INTO \"{table_name}\" ({columns_str}) VALUES ({placeholders})"
                elif db_type == "sqlserver":
                    placeholders = ', '.join(['%s'] * len(filtered_record))
                    columns_str = ', '.join(f"[{col}]" for col in columns)
                    insert_sql = f"INSERT INTO [{table_name}] ({columns_str}) VALUES ({placeholders})"
                
                try:
                    cursor.execute(insert_sql, values)
                    inserted_count += 1
                except Exception as err:
                    logger.error(f"Error inserting record: {err}")
            
            # Commit and close for SQL databases
            conn.commit()
            cursor.close()
            conn.close()
        
        end_time = time.time()
        execution_time = round(end_time - start_time, 2)
        
        return jsonify({
            'success': True,
            'message': f'Data generated and stored successfully in {execution_time} seconds',
            'table_name': table_name,
            'records_inserted': inserted_count
        }), 201

    except Exception as e:
        logger.error(f"Error in generate_data: {str(e)}")
        return jsonify({'error': str(e)}), 500

def simple_generate_synthetic_data(columns, num_rows):
    """Simple fallback data generator if the Gemini API fails"""
    records = []
    
    for i in range(num_rows):
        record = {}
        for column in columns:
            col_name = column["name"]
            col_type = column.get("type", "string").lower()
            
            # Skip auto increment columns
            if column.get("autoIncrement", False):
                continue
                
            # Simple type-based generation
            if col_type == "int" or col_type == "integer":
                record[col_name] = i + 1
            elif col_type == "string" or col_type == "text":
                record[col_name] = f"Sample {col_name} {i+1}"
            elif col_type == "email":
                record[col_name] = f"user{i+1}@example.com"
            elif col_type == "date":
                record[col_name] = "2025-03-19"
            elif col_type == "datetime":
                record[col_name] = "2025-03-19 12:00:00"
            elif col_type == "boolean":
                record[col_name] = i % 2 == 0
            elif col_type == "float" or col_type == "decimal":
                record[col_name] = float(i) + 0.5
            else:
                record[col_name] = f"Default value for {col_name} {i+1}"
                
        records.append(record)
        
    return records

def generate_mysql_create_table_sql(table_name, columns):
    """Generate SQL to create a MySQL table based on schema."""
    column_defs = []
    primary_key = None
    
    for column in columns:
        name = column["name"]
        col_type = column.get("type", "string").lower()
        
        # Map schema types to MySQL types
        if col_type == "string" or col_type == "text":
            sql_type = "VARCHAR(255)"
        elif col_type == "int" or col_type == "integer":
            sql_type = "INT"
        elif col_type == "float" or col_type == "decimal":
            sql_type = "FLOAT"
        elif col_type == "boolean":
            sql_type = "BOOLEAN"
        elif col_type == "date":
            sql_type = "DATE"
        elif col_type == "datetime":
            sql_type = "DATETIME"
        elif col_type == "email":
            sql_type = "VARCHAR(100)"
        else:
            sql_type = "VARCHAR(255)"  # Default
        
        # Add auto increment if specified
        if column.get("autoIncrement", False):
            sql_type += " AUTO_INCREMENT"
            primary_key = name
        
        # Add not null if specified
        if column.get("notNull", False):
            sql_type += " NOT NULL"
            
        column_defs.append(f"`{name}` {sql_type}")
    
    # Add primary key if there's an auto increment column
    if primary_key:
        column_defs.append(f"PRIMARY KEY (`{primary_key}`)")
    
    return f"CREATE TABLE IF NOT EXISTS `{table_name}` ({', '.join(column_defs)})"

def generate_postgres_create_table_sql(table_name, columns):
    """Generate SQL to create a PostgreSQL table based on schema."""
    column_defs = []
    primary_key = None
    
    for column in columns:
        name = column["name"]
        col_type = column.get("type", "string").lower()
        
        # Map schema types to PostgreSQL types
        if col_type == "string" or col_type == "text":
            sql_type = "VARCHAR(255)"
        elif col_type == "int" or col_type == "integer":
            sql_type = "INTEGER"
        elif col_type == "float" or col_type == "decimal":
            sql_type = "FLOAT"
        elif col_type == "boolean":
            sql_type = "BOOLEAN"
        elif col_type == "date":
            sql_type = "DATE"
        elif col_type == "datetime":
            sql_type = "TIMESTAMP"
        elif col_type == "email":
            sql_type = "VARCHAR(100)"
        else:
            sql_type = "VARCHAR(255)"  # Default
        
        # Add primary key and auto increment if specified
        if column.get("autoIncrement", False):
            sql_type = "SERIAL"
            primary_key = name
        
        # Add not null if specified
        if column.get("notNull", False):
            sql_type += " NOT NULL"
            
        column_defs.append(f"\"{name}\" {sql_type}")
    
    # Add primary key if there's an auto increment column
    if primary_key:
        column_defs.append(f"PRIMARY KEY (\"{primary_key}\")")
    
    return f"CREATE TABLE IF NOT EXISTS \"{table_name}\" ({', '.join(column_defs)})"

def generate_sqlite_create_table_sql(table_name, columns):
    """Generate SQL to create a SQLite table based on schema."""
    column_defs = []
    primary_key = None
    
    for column in columns:
        name = column["name"]
        col_type = column.get("type", "string").lower()
        
        # Map schema types to SQLite types
        if col_type == "string" or col_type == "text":
            sql_type = "TEXT"
        elif col_type == "int" or col_type == "integer":
            sql_type = "INTEGER"
        elif col_type == "float" or col_type == "decimal":
            sql_type = "REAL"
        elif col_type == "boolean":
            sql_type = "INTEGER"  # SQLite doesn't have a boolean type
        elif col_type == "date" or col_type == "datetime":
            sql_type = "TEXT"  # SQLite doesn't have date types
        elif col_type == "email":
            sql_type = "TEXT"
        else:
            sql_type = "TEXT"  # Default
        
        # Add primary key and auto increment if specified
        if column.get("autoIncrement", False):
            sql_type += " PRIMARY KEY AUTOINCREMENT"
            primary_key = name
        
        # Add not null if specified
        if column.get("notNull", False):
            sql_type += " NOT NULL"
            
        column_defs.append(f"\"{name}\" {sql_type}")
    
    return f"CREATE TABLE IF NOT EXISTS \"{table_name}\" ({', '.join(column_defs)})"

def generate_sqlserver_create_table_sql(table_name, columns):
    """Generate SQL to create a SQL Server table based on schema."""
    column_defs = []
    primary_key = None
    
    for column in columns:
        name = column["name"]
        col_type = column.get("type", "string").lower()
        
        # Map schema types to SQL Server types
        if col_type == "string" or col_type == "text":
            sql_type = "NVARCHAR(255)"
        elif col_type == "int" or col_type == "integer":
            sql_type = "INT"
        elif col_type == "float" or col_type == "decimal":
            sql_type = "FLOAT"
        elif col_type == "boolean":
            sql_type = "BIT"
        elif col_type == "date":
            sql_type = "DATE"
        elif col_type == "datetime":
            sql_type = "DATETIME"
        elif col_type == "email":
            sql_type = "NVARCHAR(100)"
        else:
            sql_type = "NVARCHAR(255)"  # Default
        
        # Add auto increment if specified
        if column.get("autoIncrement", False):
            sql_type = "INT IDENTITY(1,1)"
            primary_key = name
        
        # Add not null if specified
        if column.get("notNull", False):
            sql_type += " NOT NULL"
            
        column_defs.append(f"[{name}] {sql_type}")
    
    # Add primary key if there's an auto increment column
    if primary_key:
        column_defs.append(f"PRIMARY KEY ([{primary_key}])")
    
    return f"IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='{table_name}' AND xtype='U') CREATE TABLE [{table_name}] ({', '.join(column_defs)})"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=True)