import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from db.firestore_client import db

def clear_history(portfolio_id: str):
    col = (db.collection("portfolios")
             .document(portfolio_id)
             .collection("history"))
    docs = list(col.stream())
    for doc in docs:
        doc.reference.delete()
    print(f"Deleted {len(docs)} history docs for {portfolio_id}")

clear_history("janus_main")
clear_history("janus_baseline")
print("Done.")
