import os
import uuid
import tempfile
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
from collections import Counter

# Import analyzer functions
from backend.analyzer import analyze_sentiment_and_emotions


app = FastAPI(
    title="Sentilyze AI API",
    description="Backend services for real-time social media sentiment & emotion intelligence",
    version="1.0.0"
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Temporary directory for generated report files
TEMP_DIR = tempfile.gettempdir()
REPORTS_DB = {} # Simple in-memory map of file_id -> file_path

class TextAnalysisRequest(BaseModel):
    text: str

# Mock social media comments database categorized by topics/keywords
MOCK_TOPICS = {
    "default": [
        "This is absolutely amazing! I'm so excited about this development.",
        "Honestly, it's pretty decent, but they could have improved the speed.",
        "I hate this update so much. It literally broke everything on my computer! 😡",
        "It's okay, nothing special really. Just another regular release.",
        "WOW! I am shocked at how clean this design is. Truly unbelievable work!",
        "This is the worst customer service I've ever experienced in my life.",
        "I'm feeling a bit nervous about the upcoming changes, hope it turns out fine.",
        "This is so funny 😂, I can't stop laughing at this video!",
        "Very sad news today. Hope everyone affected is doing alright.",
        "Just checked the new features and they seem standard. Average quality."
    ],
    "ai": [
        "Artificial Intelligence is changing the world so fast! It's an exciting time to be alive.",
        "I'm scared of how fast AI is developing. Will we even have jobs in 5 years? 😰",
        "ChatGPT just solved a bug that took me three days. I am absolutely amazed!",
        "AI art is just theft and lacks any human emotion. I hate it.",
        "Had a neutral experience using the new AI search assistant. It's helpful but hallucinates.",
        "The new NLP models are insanely good. The sentiment accuracy is mind-blowing!",
        "Every tech company is just slapping 'AI' on their product and charging double. Annoying.",
        "Tested the new neural network, it's okay, performs similarly to previous architectures.",
        "Wow, the demo for the new real-time AI voice translator is unbelievable! 🤯",
        "Disappointed with the latest AI updates, they feel overhyped and underdelivered."
    ],
    "crypto": [
        "Bitcoin is going to the moon! Best financial decision I ever made 🚀",
        "I lost all my savings in the latest crypto crash. I am absolutely devastated and crying.",
        "Crypto is just a massive environmental disaster and a scam. Ban it already!",
        "Just holding my portfolio and waiting. Neutral about the short term swings.",
        "Wow! Ethereum gas fees dropped to almost zero today. Unexpected surprise!",
        "Scammers are running rampant in Web3. Pisses me off how many people get hurt.",
        "Is anyone else worried about the new regulations on stablecoins? Feeling anxious.",
        "This crypto meme is hilarious 😂, 'Buy high, sell low' describes my life.",
        "The market is moving sideways. No major positive or negative signals.",
        "Absolutely thrilled with the new decentralized app, the interface is premium and smooth."
    ],
    "gaming": [
        "This game is a masterpiece! The graphics, story, and music are pure joy.",
        "The release is full of bugs and glitches. Absolute garbage, refunding immediately.",
        "I am so scared playing this horror game in the dark. My heart is pounding! 😱",
        "It's a solid 7/10. Fun to play with friends, but nothing groundbreaking.",
        "WTF! That plot twist at the end of Chapter 3 completely shocked me! Wow.",
        "I've been playing this for 10 hours straight and I am so happy right now.",
        "The servers have been down for 4 hours. Pissed off, I just wanted to relax after work.",
        "Sad to see the franchise end like this. The ending was so emotional.",
        "The graphics are okay, gameplay is standard. Average shooter game.",
        "Can't wait for the DLC next week! The trailer looked incredible!"
    ]
}

MOCK_USERS = {
    "twitter": [
        {"username": "@tech_enthusiast", "name": "Alex Carter"},
        {"username": "@crypto_whale", "name": "BTC Hodler"},
        {"username": "@gamer_girl99", "name": "Luna"},
        {"username": "@angry_citizen", "name": "John Doe"},
        {"username": "@daily_observer", "name": "Sarah Jenkins"},
        {"username": "@ai_futurist", "name": "Dr. Aris"},
        {"username": "@joyful_soul", "name": "Emily Sunshine"},
        {"username": "@sad_times", "name": "Marcus C."}
    ],
    "reddit": [
        {"username": "u/science_guru", "name": "science_guru"},
        {"username": "u/throwaway9992", "name": "throwaway9992"},
        {"username": "u/gaming_legend", "name": "gaming_legend"},
        {"username": "u/ai_coder", "name": "ai_coder"},
        {"username": "u/crypto_novice", "name": "crypto_novice"},
        {"username": "u/sarcastic_critic", "name": "sarcastic_critic"},
        {"username": "u/happy_camper", "name": "happy_camper"},
        {"username": "u/anxious_coder", "name": "anxious_coder"}
    ],
    "youtube": [
        {"username": "TechReviewChannel", "name": "Tech Reviews"},
        {"username": "LofiBeatsListener", "name": "Lofi Beats"},
        {"username": "ProGamerGameplay", "name": "ProGamer"},
        {"username": "BlockChainBro", "name": "Web3 Explorer"},
        {"username": "CuriousMind", "name": "Curious Mind"},
        {"username": "RantingVlogger", "name": "Ranting Vlogger"},
        {"username": "PositiveVibesOnly", "name": "Positive Vibes"},
        {"username": "NostalgicGamer", "name": "Retro Gamer"}
    ]
}

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "Sentilyze AI Backend"}

@app.post("/api/analyze/single")
def analyze_single_comment(request: TextAnalysisRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    result = analyze_sentiment_and_emotions(request.text)
    return result

@app.post("/api/analyze/bulk")
async def analyze_bulk_comments(
    file: UploadFile = File(...),
    column_name: Optional[str] = Form(None)
):
    # Check file type
    filename = file.filename
    is_csv = filename.endswith('.csv')
    is_json = filename.endswith('.json')
    
    if not (is_csv or is_json):
        raise HTTPException(status_code=400, detail="Only CSV or JSON files are supported")

    # Read data into Pandas DataFrame
    try:
        if is_csv:
            df = pd.read_csv(file.file)
        else:
            df = pd.read_json(file.file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Find the target comments column
    target_col = None
    if column_name and column_name in df.columns:
        target_col = column_name
    else:
        # Auto-detect common column names
        common_names = ['comment', 'text', 'tweet', 'body', 'message', 'review', 'content']
        for col in df.columns:
            if str(col).lower() in common_names:
                target_col = col
                break
        
        # If still not found, take the first string column
        if not target_col:
            for col in df.columns:
                if df[col].dtype == 'object':
                    target_col = col
                    break
        
        # Default fallback to first column
        if not target_col:
            target_col = df.columns[0]

    # Process comments
    results = []
    sentiments = []
    compounds = []
    subjectivities = []
    
    # Track distributions
    sentiment_counts = {"positive": 0, "negative": 0, "neutral": 0}
    emotion_totals = {"joy": 0.0, "sadness": 0.0, "anger": 0.0, "fear": 0.0, "surprise": 0.0, "neutral": 0.0}
    all_hashtags = []
    all_emojis = []
    all_key_phrases = []

    # Limit processing to max 1000 items to prevent server overload in demo
    df_limited = df.head(1000)

    for idx, row in df_limited.iterrows():
        comment_text = str(row[target_col])
        analysis = analyze_sentiment_and_emotions(comment_text)
        
        # Append details for CSV export
        results.append(analysis)
        sentiments.append(analysis['sentiment'])
        compounds.append(analysis['scores']['compound'])
        subjectivities.append(analysis['subjectivity'])
        
        # Update metrics
        sentiment_counts[analysis['sentiment']] += 1
        for emo, val in analysis['emotions'].items():
            emotion_totals[emo] += val
            
        all_hashtags.extend(analysis['hashtags'])
        all_emojis.extend(analysis['emojis'])
        all_key_phrases.extend(analysis['key_phrases'])

    # Add results back to DataFrame for downloading
    df_result = df_limited.copy()
    df_result['sentiment'] = sentiments
    df_result['sentiment_score'] = compounds
    df_result['subjectivity'] = subjectivities
    
    # Save the enriched dataframe
    file_id = str(uuid.uuid4())
    temp_filename = f"sentilyze_report_{file_id}.csv"
    temp_filepath = os.path.join(TEMP_DIR, temp_filename)
    df_result.to_csv(temp_filepath, index=False)
    
    # Store path in database
    REPORTS_DB[file_id] = temp_filepath

    # Summarize top entries
    total_comments = len(df_limited)
    avg_compound = sum(compounds) / total_comments if total_comments > 0 else 0
    avg_subjectivity = sum(subjectivities) / total_comments if total_comments > 0 else 0
    
    # Normalize emotions averages
    avg_emotions = {k: round(v / total_comments, 3) for k, v in emotion_totals.items()} if total_comments > 0 else {}

    # Word Frequency from key phrases
    top_key_phrases = [phrase for phrase, count in Counter(all_key_phrases).most_common(10)]
    top_hashtags = [tag for tag, count in Counter(all_hashtags).most_common(5)]
    top_emojis = [emo for emo, count in Counter(all_emojis).most_common(5)]

    return {
        "file_id": file_id,
        "total_comments": total_comments,
        "target_column": str(target_col),
        "sentiment_distribution": sentiment_counts,
        "average_sentiment_score": round(avg_compound, 3),
        "average_subjectivity": round(avg_subjectivity, 3),
        "average_emotions": avg_emotions,
        "top_keywords": top_key_phrases,
        "top_hashtags": top_hashtags,
        "top_emojis": top_emojis,
        "preview_data": results[:100] # Provide first 100 rows for UI listing
    }

@app.get("/api/download/{file_id}")
def download_report(file_id: str):
    file_path = REPORTS_DB.get(file_id)
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Report not found or expired")
    
    return FileResponse(
        path=file_path,
        media_type="text/csv",
        filename="sentilyze_sentiment_report.csv"
    )

@app.get("/api/simulate/social")
def simulate_comments(platform: str, query: str):
    """
    Simulates streaming social media comments based on platform and query keyword.
    """
    platform = platform.lower()
    if platform not in ["twitter", "reddit", "youtube"]:
        raise HTTPException(status_code=400, detail="Invalid social media platform")

    # Match query to pre-existing categories
    query_lower = query.lower()
    topic = "default"
    if "ai" in query_lower or "bot" in query_lower or "chatgpt" in query_lower or "tech" in query_lower:
        topic = "ai"
    elif "crypto" in query_lower or "btc" in query_lower or "coin" in query_lower or "eth" in query_lower or "money" in query_lower:
        topic = "crypto"
    elif "game" in query_lower or "play" in query_lower or "console" in query_lower or "xbox" in query_lower or "ps5" in query_lower:
        topic = "gaming"

    # Select comment pool and users
    comment_pool = MOCK_TOPICS[topic]
    users_pool = MOCK_USERS[platform]

    # Generate a list of simulated comments with timestamps
    import random
    import time
    
    simulated_comments = []
    random.shuffle(users_pool)
    
    # Return 5-8 comments for each streaming interval
    count = random.randint(5, 8)
    for i in range(count):
        user = users_pool[i % len(users_pool)]
        raw_text = random.choice(comment_pool)
        
        # Inject search query key words for personalization
        if topic == "default" and query.strip():
            raw_text = raw_text.replace("this", f"'{query}'").replace("This", f"'{query}'")
            
        analysis = analyze_sentiment_and_emotions(raw_text)
        
        # Mock times
        mins_ago = random.randint(1, 59)
        time_str = f"{mins_ago}m ago" if mins_ago > 0 else "Just now"
        
        simulated_comments.append({
            "platform": platform,
            "username": user["username"],
            "name": user["name"],
            "timestamp": time_str,
            "text": raw_text,
            "analysis": analysis
        })
        
    return simulated_comments

# Mount the static files for the frontend.
# NOTE: Ensure index.html exists in the frontend folder.
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
else:
    # If starting from backend root directly
    frontend_alt_dir = os.path.abspath("frontend")
    if os.path.exists(frontend_alt_dir):
        app.mount("/", StaticFiles(directory=frontend_alt_dir, html=True), name="frontend")
