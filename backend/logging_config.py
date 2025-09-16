import os
import logging
import sys
from datetime import datetime

def setup_logger(logger_name):
    """
    Configure and return a logger with the specified name.
    
    Args:
        logger_name (str): Name for the logger
        
    Returns:
        logging.Logger: Configured logger instance
    """
    # Create logger with the given name
    logger = logging.getLogger(logger_name)
    
    # Skip if this logger is already configured
    if logger.handlers:
        return logger
        
    # Set the logging level from environment variable or default to INFO
    log_level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)
    logger.setLevel(log_level)
    
    # Create file handler for logging to file
    logs_dir = os.environ.get("LOGS_DIR", "logs")
    os.makedirs(logs_dir, exist_ok=True)
    
    log_file = os.path.join(
        logs_dir, 
        f"{logger_name}_{datetime.now().strftime('%Y%m%d')}.log"
    )
    
    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(log_level)
    
    # Create console handler for logging to console
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    
    # Create formatter and add it to the handlers
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    # Add the handlers to the logger
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger